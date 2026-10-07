#!/usr/bin/env node
/**
 * Phase B — Per-product detail crawler.
 *
 * Reads the listing extractions (products.json or products_page_*.json), visits
 * each unique product URL in a real Chromium window, and captures the full
 * description plus a hi-res product image. Writes products_enriched.json.
 *
 * The site sits behind Imperva's "Robot Challenge Screen", which blocks plain
 * headless browsers — so this defaults to a headful window and reuses the
 * session profile created by Phase A (.puppeteer-profile).
 *
 * Usage:
 *   node extract_product_details.js                          # auto-detect inputs
 *   node extract_product_details.js --input products.json
 *   node extract_product_details.js --input products_page_1.json --input products_page_2.json
 *   node extract_product_details.js --workers 4
 *   node extract_product_details.js --limit 10               # smoke test only 10
 *   node extract_product_details.js --out products_enriched.json
 *   node extract_product_details.js --no-resume              # reprocess everything
 */

'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const MAX_RETRIES = 3;
const NAV_TIMEOUT = 60000;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    inputs: [],
    outFile: 'products_enriched.json',
    workers: 3,
    limit: null,
    resume: true,
    headless: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--input': case '-i': opts.inputs.push(next()); break;
      case '--out': case '-o': opts.outFile = next(); break;
      case '--workers': case '-w': opts.workers = parseInt(next(), 10); break;
      case '--limit': opts.limit = parseInt(next(), 10); break;
      case '--resume': opts.resume = true; break;
      case '--no-resume': opts.resume = false; break;
      case '--headful': opts.headless = false; break;
      case '--headless': opts.headless = true; break;
      default: break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sortedGlob(pattern) {
  const dir = path.dirname(pattern) || '.';
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('products_page_') && f.endsWith('.json'))
    .sort((a, b) => {
      const na = parseInt(a.match(/products_page_(\d+)\.json$/)[1], 10);
      const nb = parseInt(b.match(/products_page_(\d+)\.json$/)[1], 10);
      return na - nb;
    })
    .map((f) => path.join(dir, f));
}

function loadProducts(opts) {
  let files;
  if (opts.inputs.length) {
    files = opts.inputs;
  } else if (fs.existsSync('products.json')) {
    files = ['products.json'];
  } else {
    files = sortedGlob('products_page_*.json');
  }

  const products = [];
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.warn(`  ⚠ input file not found: ${f}`);
      continue;
    }
    const arr = JSON.parse(fs.readFileSync(f, 'utf-8'));
    if (Array.isArray(arr)) products.push(...arr);
  }
  return products;
}

// Detect Imperva challenge screen.
function isChallenge(page) {
  /* global document */
  return page.evaluate(() => {
    const body = (document.body && document.body.innerText || '').trim();
    const title = document.title || '';
    const isBot = /robot challenge|checking the site connection|verify you are human|attention required/i.test(
      (body + ' ' + title).toLowerCase()
    );
    return { len: body.length, title, isBot, url: location.href };
  });
}

// Navigate and wait for the product page to render (tolerating the Imperva
// challenge's mid-load redirect that destroys the execution context).
async function loadProductPage(page, url) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      } catch (e) {
        if (!/Navigation|net::|Execution context/i.test(String(e.message))) throw e;
      }

      // Poll for product content.
      const start = Date.now();
      while (Date.now() - start < 40000) {
        try {
          const ok = await page.evaluate(() =>
            !!(
              document.querySelector('#tab-description, .entry-content, h1.product-title') ||
              document.querySelector('.products li, .product-small')
            )
          );
          if (ok) return { ok: true };
        } catch (e) {
          // context destroyed by challenge redirect — keep polling
        }
        await sleep(1500);
      }

      const probe = await isChallenge(page).catch(() => ({ isBot: false, title: '', url }));
      if (probe.isBot) throw new Error(`bot challenge: "${probe.title}"`);
      return { ok: true }; // loaded enough, may have limited content
    } catch (err) {
      lastError = err;
      console.warn(`    ⚠ attempt ${attempt}/${MAX_RETRIES} for ${url}: ${err.message}`);
      await sleep(5000 * attempt);
    }
  }
  return { ok: false, error: lastError && lastError.message };
}

// Browser-side extraction of full description + hi-res image.
function makeDetailExtractFn() {
  /* global document */
  return () => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    let full_description = '';
    const reviewsLike = /there are no reviews yet|your rating|your review|save my name, email/i;

    // 1) Canonical WooCommerce description tab / panel.
    for (const sel of ['#tab-description', '.woocommerce-Tabs-panel--description']) {
      const el = document.querySelector(sel);
      if (el) {
        const t = clean(el.innerText);
        if (t && !reviewsLike.test(t)) { full_description = t; break; }
      }
    }

    // 2) Short description shown near the "Add to cart" summary. Flatsome theme
    //    (used on this site) renders the product copy in .product-short-description.
    if (!full_description) {
      const short = document.querySelector(
        '.product-short-description, .woocommerce-product-details__short-description, .woocommerce-Tabs-panel--description'
      );
      if (short) {
        const t = clean(short.innerText);
        if (t && !reviewsLike.test(t)) full_description = t;
      }
    }

    // 3) Fall back to .entry-content, but strip any trailing reviews section.
    if (!full_description) {
      const entry = document.querySelector('.entry-content');
      if (entry) {
        let t = clean(entry.innerText);
        const cut = t.search(/Reviews/i);
        if (cut > 0) t = t.slice(0, cut).trim();
        if (t && !reviewsLike.test(t)) full_description = t;
      }
    }

    let image_url = '';
    const gallery = document.querySelector(
      '.woocommerce-product-gallery__image img, .woocommerce-product-gallery img, ' +
        'div.images img, .single-product .entry-summary img, .woocommerce-main-image'
    );
    if (gallery) {
      image_url =
        gallery.getAttribute('data-large_image') ||
        gallery.getAttribute('data-src') ||
        gallery.currentSrc ||
        gallery.src ||
        '';
      // Fall back to the largest srcset candidate.
      if (!image_url && gallery.srcset) {
        let best = '';
        let bestW = 0;
        gallery.srcset.split(',').forEach((part) => {
          const bits = part.trim().split(/\s+/);
          const w = parseInt((bits[1] || '').replace('w', ''), 10) || 0;
          if (w > bestW) { bestW = w; best = bits[0]; }
        });
        image_url = best;
      }
    }

    const title = (document.querySelector('h1.product-title, h1') || {}).innerText || '';
    const postedIn = Array.from(
      document.querySelectorAll('.product_meta .posted_in a, .posted_in a')
    )
      .map((a) => clean(a.innerText))
      .filter(Boolean);

    return {
      title: clean(title),
      full_description: full_description.slice(0, 20000),
      image_url,
      posted_categories: postedIn,
    };
  };
}


// ---------------------------------------------------------------------------
// Main enrichment
// ---------------------------------------------------------------------------
async function enrich(opts) {
  const all = loadProducts(opts);
  if (!all.length) {
    console.error('❌ No products found to enrich. Pass --input or run Phase A first.');
    return false;
  }

  // Deduplicate by URL, preferring records that already carry an image.
  const byUrl = new Map();
  for (const p of all) {
    if (!p.url) continue;
    if (!byUrl.has(p.url) || (p.image_url && !byUrl.get(p.url).image_url)) {
      byUrl.set(p.url, p);
    }
  }
  let products = Array.from(byUrl.values());
  if (opts.limit != null) products = products.slice(0, opts.limit);

  // Resume support: seed from any existing output.
  let done = new Set();
  const existingByUrl = new Map();
  if (opts.resume && fs.existsSync(opts.outFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(opts.outFile, 'utf-8'));
      if (Array.isArray(existing)) {
        existing.forEach((p) => {
          if (!p || !p.url) return;
          existingByUrl.set(p.url, p);
          if (p.full_description) done.add(p.url);
        });
        console.log(`  ℹ️  Resuming: ${done.size} URLs already have details (from ${opts.outFile})`);
      }
    } catch (e) {
      console.warn('  ⚠ could not read existing output for resume; will overwrite');
    }
  }

  const PROFILE_DIR = path.join(__dirname, '.puppeteer-profile');
  try {
    for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      const p = path.join(PROFILE_DIR, f);
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
  } catch (e) { /* ignore */ }

  const browser = await puppeteer.launch({
    headless: opts.headless,
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  const workerCount = Math.max(1, Math.min(opts.workers, products.length || 1));
  const workers = [];
  for (let i = 0; i < workerCount; i++) {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1366, height: 900 });
    workers.push(page);
  }

  console.log('='.repeat(70));
  console.log('DME Products — Phase B: Product Detail Crawler (Puppeteer)');
  console.log('='.repeat(70));
  console.log(`  Inputs    : ${opts.inputs.length ? opts.inputs.join(', ') : 'auto-detect'}`);
  console.log(`  Products  : ${products.length} unique URLs`);
  console.log(`  Workers   : ${workerCount}`);
  console.log(`  Browser   : ${opts.headless ? 'headless' : 'headful (required behind Imperva)'}`);
  console.log(`  Output    : ${opts.outFile}\n`);

  const results = new Map(); // url -> product record
  let index = 0;
  let completed = 0;
  let withDesc = 0;
  let withImg = 0;
  let failed = 0;

  async function workerLoop(workerPage) {
    while (true) {
      const myIdx = index;
      index += 1;
      if (myIdx >= products.length) break;
      const product = products[myIdx];
      const url = product.url;

      if (done.has(url)) {
        // Keep the previously enriched record (do not downgrade it to the raw
        // listing record).
        results.set(url, existingByUrl.get(url) || product);
        completed += 1;
        continue;
      }

      const load = await loadProductPage(workerPage, url);
      let record;
      if (load.ok) {
        try {
          const detail = await workerPage.evaluate(makeDetailExtractFn());
          record = {
            ...product,
            full_description: detail.full_description || product.description || '',
            image_url: detail.image_url || product.image_url || '',
            image_alt: product.image_alt || detail.title || '',
          };
          if (record.full_description) withDesc += 1;
          if (record.image_url) withImg += 1;
        } catch (e) {
          record = { ...product, full_description: product.description || '', image_url: product.image_url || '' };
          failed += 1;
        }
      } else {
        record = {
          ...product,
          full_description: product.description || '',
          image_url: product.image_url || '',
          error: load.error,
        };
        failed += 1;
      }
      results.set(url, record);
      completed += 1;

      if (completed % 10 === 0 || completed === products.length) {
        console.log(`  ⏳ ${completed}/${products.length} (${withDesc} desc, ${withImg} imgs, ${failed} fail)`);
      }
      await sleep(300 + Math.floor(Math.random() * 700)); // pacing
    }
  }

  await Promise.all(workers.map((w) => workerLoop(w)));
  await browser.close();

  // Preserve original ordering.
  const ordered = products
    .map((p) => results.get(p.url))
    .filter(Boolean);

  fs.writeFileSync(opts.outFile, JSON.stringify(ordered, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('Phase B complete');
  console.log('='.repeat(70));
  console.log(`  Products processed : ${completed}/${products.length}`);
  console.log(`  With descriptions  : ${withDesc}`);
  console.log(`  With images        : ${withImg}`);
  console.log(`  Failures           : ${failed}`);
  console.log(`  Output written to  : ${path.resolve(opts.outFile)}`);
  return failed === 0;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
(async () => {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const ok = await enrich(opts);
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(2);
  }
})();

