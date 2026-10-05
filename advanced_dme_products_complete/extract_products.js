#!/usr/bin/env node
/**
 * Phase A — Paginated listing crawler for advanceddmesupplies.com /shop/.
 *
 * Reuses the proven selectors from extraction_script.js and drives a real
 * headless Chromium via Puppeteer, so JavaScript browser-challenges are handled
 * exactly like they would be in a normal browser.
 *
 * Writes one JSON file per shop page: products_page_1.json, products_page_2.json, ...
 * The existing consolidate_products.py consumes this exact naming convention.
 *
 * Usage:
 *   node extract_products.js               # crawl all pages, starting at page 1 (headful browser)
 *   node extract_products.js --start 5     # begin at page 5
 *   node extract_products.js --end 10      # stop after page 10
 *   node extract_products.js --page 3      # only page 3
 *   node extract_products.js --no-resume   # overwrite already-existing page files
 *   node extract_products.js --headless    # force headless (may be blocked by the site's bot check)
 *   node extract_products.js --delay 3000  # fixed delay (ms) between pages
 *   node extract_products.js --out pages/  # write page files into this directory
 *
 * NOTE: Defaults to a headful (visible) Chromium window because Imperva's
 * "Robot Challenge Screen" blocks plain headless browsers on this site. The
 * site's session cookie is cached in .puppeteer-profile so the challenge only
 * needs to be passed once.
 */

'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.advanceddmesupplies.com';
const SHOP_URL = `${BASE_URL}/shop/`;
const PRODUCT_SELECTOR = 'a.woocommerce-LoopProduct-link';

const DEFAULT_MIN_DELAY = 3000;
const DEFAULT_MAX_DELAY = 5000;
const MAX_RETRIES = 4;
const NAV_TIMEOUT = 60000;
const SELECTOR_TIMEOUT = 25000;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    start: null,
    end: null,
    page: null,
    resume: true,
    headful: true, // default to headful: Imperva blocks plain headless
    headless: false,
    delay: null,
    outDir: '.',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--start': opts.start = parseInt(next(), 10); break;
      case '--end': opts.end = parseInt(next(), 10); break;
      case '--page': opts.page = parseInt(next(), 10); break;
      case '--delay': opts.delay = parseInt(next(), 10); break;
      case '--out': opts.outDir = next(); break;
      case '--no-resume': opts.resume = false; break;
      case '--headful': opts.headful = true; opts.headless = false; break;
      case '--headless': opts.headless = true; opts.headful = false; break;
      default:
        break;
    }
  }

  if (opts.page != null) {
    opts.start = opts.page;
    opts.end = opts.page;
  }
  if (opts.start == null) opts.start = 1;

  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function randomDelay(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

function ensureDir(dir) {
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
}

// This function runs inside the page (Puppeteer serialize): MUST NOT reference
// any outer-scope variables except embedded constants.
function makeExtractFn() {
  // Browser-side extraction. The shop pages use the Flatsome theme: each product
  // card is a div.product-small (NOT li.product). Structure per card:
  //   .product-small.box > .box-image (>< a > img)  +  .box-text (title + category)
  /* global document */
  return () => {
    const products = [];
    const links = document.querySelectorAll('a.woocommerce-LoopProduct-link');

    links.forEach((link) => {
      // Card container: the .product-small.box div wraps both image and text.
      const card = link.closest('.product-small, .box, [class*="product-small"]');
      const product = {};

      // Name + URL
      const titleElem =
        card && card.querySelector('.box-text .name a, .woocommerce-loop-product__title a');
      product.name = titleElem
        ? titleElem.textContent.trim()
        : (link.textContent || '').trim();
      product.url = link.href || (link.getAttribute('href') || '');

      // Category: prefer the primary product_cat-* class on the OUTER card
      // (matches the sample's UPPERCASE convention), fall back to the visible
      // p.category text.
      if (card) {
        // Find the ancestor that carries the WooCommerce product_cat-* classes.
        let outer = null;
        let el = card;
        while (el && el.tagName !== 'BODY') {
          if (typeof el.className === 'string' && /product_cat-/.test(el.className)) {
            outer = el;
            break;
          }
          el = el.parentElement;
        }
        if (outer) {
          const cats = (outer.className.match(/product_cat-[a-z0-9-_]+/g) || []).map((c) =>
            c.replace('product_cat-', '').replace(/-/g, ' ').toUpperCase()
          );
          if (cats.length) product.category = cats[0];
        }
        if (!product.category) {
          const catText = card.querySelector('.box-text p.category, p.category');
          if (catText) product.category = catText.textContent.trim().toUpperCase();
        }
      }

      // Image
      if (card) {
        const img = card.querySelector('.box-image img, img');
        if (img) {
          product.image_url =
            img.src ||
            img.dataset.src ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-lazy-src') ||
            '';
          product.image_alt = img.alt ? img.alt.trim() : '';
        }
      }

      // Short description (Flatsome listing pages generally don't show one)
      if (card) {
        const desc = card.querySelector(
          '.woo-loop-product__short-description, .box-text .description, div[class*="short-description"]'
        );
        if (desc) product.description = desc.textContent.trim();
      }

      if (product.name) products.push(product);
    });

    return products;
  };
}

// Returns the "next" pagination href, or null on the last page.
function makeNextLinkFn() {
  /* global document */
  return () => {
    const next = document.querySelector(
      'a.next.page-numbers, a.next, .woocommerce-pagination a.next'
    );
    return next ? next.getAttribute('href') : null;
  };
}

// Returns body-size + title + a flag so we can reliably detect Imperva's
// "Robot Challenge Screen" (which has a non-trivial body, so length alone is
// insufficient — we match on known challenge text instead).
function isChallenge(page) {
  /* global document */
  return page.evaluate(() => {
    const bodyText = (document.body && document.body.innerText || '').trim();
    const title = document.title || '';
    const lower = (bodyText + ' ' + title).toLowerCase();
    const isChallenge =
      /robot challenge|checking the site connection|verify you are human|checking your browser|attention required/i.test(
        lower
      );
    return { length: bodyText.length, title, isChallenge, url: location.href };
  });
}

// Navigate to a page and wait until products render (with retries for challenges).
// The Imperva "Robot Challenge Screen" auto-solves and redirects after a variable
// delay. That redirect destroys our execution context mid-evaluate, so we must
// tolerate those errors and keep polling.
async function waitForProducts(page, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await page.waitForSelector(PRODUCT_SELECTOR, { timeout: 2500 });
      return true;
    } catch (e) {
      // Selector not yet present — may be mid-challenge redirect. Keep polling.
    }
  }
  return false;
}

async function loadPage(page, url) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // The challenge may interrupt the initial navigation with its own redirect,
      // which makes page.goto throw. That is expected — swallow and keep going.
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      } catch (e) {
        if (!/Navigation|net::|Execution context/i.test(String(e.message))) throw e;
      }

      const found = await waitForProducts(page, 40000);

      if (found) return { ok: true, empty: false };

      // Products never appeared. Distinguish a challenge from a legitimate
      // empty/last page.
      let probe = { length: 9999, title: '', isChallenge: false };
      try {
        probe = await isChallenge(page);
      } catch (e) {
        // Context destroyed by a late challenge-redirect; treat as retryable.
        throw new Error('page navigated during challenge (retryable): ' + e.message);
      }

      if (probe.isChallenge) {
        throw new Error(
          `bot-challenge detected (title "${probe.title}", body ${probe.length} chars)`
        );
      }

      // Legitimate empty page (no challenge, no products) — end of catalog.
      return { ok: true, empty: true };
    } catch (err) {
      lastError = err;
      console.warn(`  ⚠ attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${err.message}`);
      await sleep(6000 * attempt);
    }
  }

  return { ok: false, error: lastError && lastError.message };
}

// ---------------------------------------------------------------------------
// Main crawl
// ---------------------------------------------------------------------------
async function crawl(opts) {
  ensureDir(opts.outDir);

  // Persistent profile so the Imperva challenge cookie (and any session state)
  // only needs to be solved once and carries across pages and future runs.
  const PROFILE_DIR = path.join(__dirname, '.puppeteer-profile');
  // Best-effort cleanup of stale locks left by an aborted earlier run, which
  // otherwise makes headful Chrome refuse to launch ("ProcessSingleton" error).
  try {
    for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      const p = path.join(PROFILE_DIR, f);
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
  } catch (e) {
    /* ignore cleanup errors */
  }

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

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1366, height: 900 });

  let pageNumber = opts.start;

  console.log('='.repeat(70));
  console.log('DME Products — Phase A: Listing Crawler (Puppeteer)');
  console.log('='.repeat(70));
  console.log(`  Shop URL : ${SHOP_URL}`);
  console.log(
    `  Start    : page ${pageNumber}` +
      `${opts.end ? ` (end page ${opts.end})` : ' (auto-detect end)'}`
  );
  console.log(`  Resume   : ${opts.resume ? 'YES (skip existing files)' : 'NO (overwrite all)'}`);
  console.log(`  Browser  : ${opts.headless ? 'headless' : 'headful (required: Imperva blocks plain headless)'}`);
  console.log(`  Output   : ${path.resolve(opts.outDir)}/products_page_*.json\n`);

  let totalProducts = 0;
  let extractedPages = 0;
  let erroredPages = 0;

  // First URL: page 1 has no /page/ segment.
  let url = pageNumber === 1 ? SHOP_URL : `${SHOP_URL}page/${pageNumber}/`;

  while (true) {
    // Honor --end even when earlier pages are resumed/skipped.
    if (opts.end != null && pageNumber > opts.end) {
      console.log(`  ⏹ reached configured end page ${opts.end}.`);
      break;
    }

    const outFile = path.join(opts.outDir, `products_page_${pageNumber}.json`);

    if (opts.resume && fs.existsSync(outFile)) {
      let existing = [];
      try {
        existing = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
      } catch (e) {
        existing = [];
      }
      totalProducts += existing.length;
      extractedPages += 1;
      console.log(`  ⏭  page ${pageNumber} already extracted (${existing.length} products) — skipping`);
    } else {
      const result = await loadPage(page, url);

      if (!result.ok) {
        erroredPages += 1;
        console.error(`  ❌ page ${pageNumber} failed after ${MAX_RETRIES} attempts: ${result.error}`);
        break;
      }

      if (result.empty) {
        console.log(`  ⏹  page ${pageNumber} returned no products — end of catalog reached.`);
        break;
      }

      const products = await page.evaluate(makeExtractFn());
      fs.writeFileSync(outFile, JSON.stringify(products, null, 2));
      totalProducts += products.length;
      extractedPages += 1;

      console.log(
        `  ✓ page ${pageNumber}: ${String(products.length).padStart(3)} products ` +
          `(running total ${totalProducts})`
      );

      // Detect end-of-catalog via missing next link.
      const nextHref = await page.evaluate(makeNextLinkFn());
      if (!nextHref) {
        console.log(`  ⏹ page ${pageNumber} has no "next" link — last page reached.`);
        break;
      }
    }

    // Advance to the next page.
    pageNumber += 1;
    url = `${SHOP_URL}page/${pageNumber}/`;

    const delayMs =
      opts.delay != null ? opts.delay : randomDelay(DEFAULT_MIN_DELAY, DEFAULT_MAX_DELAY);
    await sleep(delayMs);
  }

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log('Phase A complete');
  console.log('='.repeat(70));
  console.log(`  Pages visited/processed : ${extractedPages}`);
  console.log(`  Pages with errors       : ${erroredPages}`);
  console.log(`  Total products captured : ${totalProducts}`);
  console.log(`  Files written to        : ${path.resolve(opts.outDir)}`);
  console.log('\nNext: node extract_product_details.js');

  return erroredPages === 0;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
(async () => {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const ok = await crawl(opts);
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(2);
  }
})();