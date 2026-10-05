#!/usr/bin/env node
/**
 * Phase C — Download ALL product image files through the Puppeteer browser.
 *
 * Reads the listing extractions (products_page_*.json) and overlays the
 * enriched data (products_enriched.json, if present) to pick up the hi-res
 * image_url where available. It then downloads each distinct image file via an
 * in-page fetch, reusing the headful Chromium session (.puppeteer-profile) that
 * already holds the cleared challenge cookie — this is what makes downloads
 * succeed where plain Python `requests` gets blocked by the site's bot check.
 *
 * Files are saved to:  images/<CATEGORY>/<filename-from-url>
 * Matches the folder layout produced by the existing image_downloader.py.
 *
 * Usage:
 *   node extract_images.js                     # all images
 *   node extract_images.js --limit 20          # smoke test
 *   node extract_images.js --workers 6         # concurrency (default 4)
 *   node extract_images.js --out product_images
 *   node extract_images.js --no-resume         # re-download everything
 *   node extract_images.js --input products_enriched.json
 */

'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SITE_ROOT = 'https://advanceddmesupplies.com';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    inputs: [],
    outDir: 'images',
    workers: 4,
    limit: null,
    resume: true,
    headless: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--input': case '-i': opts.inputs.push(next()); break;
      case '--out': case '-o': opts.outDir = next(); break;
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
const sanitizeCategory = (c) =>
  (c || 'uncategorized').replace(/[\/\\:*?"<>|]/g, '_').trim() || 'uncategorized';

function sortedGlob() {
  return fs
    .readdirSync('.')
    .filter((f) => /^products_page_\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
}

// Load listing products, then overlay enriched (hi-res) image_url where present.
function loadProducts(opts) {
  let files = opts.inputs.length ? opts.inputs : sortedGlob();
  if (!files.length) {
    const alt = 'products_enriched.json';
    if (fs.existsSync(alt)) files = [alt];
  }

  let items = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.warn(`  ⚠ input file not found: ${f}`); continue; }
    const arr = JSON.parse(fs.readFileSync(f, 'utf-8'));
    if (Array.isArray(arr)) items.push(...arr);
  }

  // Overlay enriched data for hi-res URLs / fuller categories.
  if (fs.existsSync('products_enriched.json')) {
    let enriched = [];
    try { enriched = JSON.parse(fs.readFileSync('products_enriched.json', 'utf-8')); } catch (e) {}
    const byUrl = new Map();
    enriched.forEach((p) => { if (p.url) byUrl.set(p.url, p); });
    items = items.map((p) => (byUrl.has(p.url) ? { ...p, ...byUrl.get(p.url) } : p));
  }

  // Dedupe by URL.
  const seen = new Set();
  const unique = [];
  for (const p of items) {
    if (p.url && !seen.has(p.url)) { seen.add(p.url); unique.push(p); }
  }
  return unique;
}

// Detect Imperva challenge text (in case a request comes back as a challenge).
function isChallenge(page) {
  /* global document */
  return page.evaluate(() => {
    const t = (document.body && document.body.innerText || '').trim() + ' ' + document.title;
    return /robot challenge|checking the site connection|verify you are human|attention required/i.test(t.toLowerCase());
  });
}

// Validate the downloaded bytes are actually an image (magic-number check).
function isImage(buf) {
  if (!buf || buf.length < 4) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // WebP (RIFF....WEBP) / other RIFF
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  // BMP
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  // AVIF / HEIC / other ISO BMFF (bytes 4..8 == 'ftyp')
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') return true;
  // SVG (XML/< ... svg)
  if (buf[0] === 0x3c && /svg/i.test(buf.slice(0, 200).toString('latin1'))) return true;
  return false;
}

// Derive a filesystem-safe filename from an image URL.
function filenameFromUrl(url, fallbackName) {
  let base = '';
  try { base = path.basename(new URL(url).pathname); } catch (e) {}
  base = decodeURIComponent(base).replace(/[\/\\:*?"<>|]/g, '_');
  if (!base || base.indexOf('.') === -1) {
    const slug = (fallbackName || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    base = `${slug || 'image'}.jpg`;
  }
  return base;
}

// In-page fetch that reuses the browser session cookies, returns base64 bytes.
async function downloadImageInPage(page, url) {
  return page.evaluate(async (u) => {
    try {
      const res = await fetch(u, {
        credentials: 'include',
        cache: 'no-store',
        redirect: 'follow',
      });
      if (!res.ok) {
        return { ok: false, status: res.status, type: res.headers.get('content-type') };
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      let binary = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < buf.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
      }
      return {
        ok: true,
        b64: btoa(binary),
        type: res.headers.get('content-type') || '',
        bytes: buf.length,
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }, url);
}

// Navigate a worker page onto the site origin once, so in-page fetches to the
// same domain carry the session cookies (and defeat the bot challenge).
async function primeSession(page) {
  try {
    await page.goto(SITE_ROOT + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) { /* tolerate challenge redirects */ }
  // Give the challenge a moment to clear / set cookies.
  await sleep(3000);
  return !(await isChallenge(page));
}


// ---------------------------------------------------------------------------
// Main download
// ---------------------------------------------------------------------------
async function downloadAll(opts) {
  const products = loadProducts(opts);
  if (!products.length) {
    console.error('❌ No products found. Pass --input or run Phase A first.');
    return false;
  }
  if (opts.limit != null) products.splice(opts.limit);

  // Build a distinct set of image URLs -> { category, name }. The enriched
  // hi-res URLs overwrite listing thumbnails via the earlier overlay.
  const images = new Map(); // imageUrl -> { category, name }
  let productsWithImg = 0;
  for (const p of products) {
    if (!p.image_url || !/^https?:\/\//.test(p.image_url)) continue;
    productsWithImg += 1;
    if (!images.has(p.image_url)) {
      images.set(p.image_url, { category: sanitizeCategory(p.category), name: p.name || 'image' });
    }
  }

  console.log('='.repeat(70));
  console.log('DME Products — Phase C: Image Downloader (Puppeteer session)');
  console.log('='.repeat(70));
  console.log(`  Products loaded : ${products.length}`);
  console.log(`  With an image   : ${productsWithImg}`);
  console.log(`  Distinct images : ${images.size}`);
  console.log(`  Output dir      : ${path.resolve(opts.outDir)}`);
  console.log(`  Workers         : ${opts.workers}`);
  console.log(`  Browser         : ${opts.headless ? 'headless' : 'headful (session for bot-check)'}\n`);

  fs.mkdirSync(opts.outDir, { recursive: true });

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

  const workerCount = Math.max(1, Math.min(opts.workers, images.size || 1));
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

  const imageEntries = Array.from(images.entries());
  let index = 0;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let completed = 0;
  let totalBytes = 0;

  async function workerLoop(workerPage) {
    await primeSession(workerPage); // establish session/cookies once per worker

    while (true) {
      const myIdx = index;
      index += 1;
      if (myIdx >= imageEntries.length) break;

      const [imageUrl, meta] = imageEntries[myIdx];
      const categoryDir = path.join(opts.outDir, meta.category);
      const filename = filenameFromUrl(imageUrl, meta.name);
      const outPath = path.join(categoryDir, filename);

      if (opts.resume && fs.existsSync(outPath)) {
        // Only skip if the existing file is a genuinely valid image — the old
        // Python downloader left Imperva challenge HTML saved as .jpg/.png, so
        // re-download anything that isn't a real image.
        const existing = fs.readFileSync(outPath);
        if (isImage(existing)) {
          skipped += 1;
          completed += 1;
          if (completed % 50 === 0) {
            console.log(`  ⏳ ${completed}/${imageEntries.length} (${downloaded} dl, ${skipped} skip, ${failed} fail)`);
          }
          continue;
        }
        console.warn(`  ♻  ${filename}: existing file is a corrupted placeholder (${existing.length} bytes) — re-downloading`);
      }

      const result = await downloadImageInPage(workerPage, imageUrl);
      if (result.ok && result.b64) {
        const buf = Buffer.from(result.b64, 'base64');
        if (isImage(buf)) {
          fs.mkdirSync(categoryDir, { recursive: true });
          fs.writeFileSync(outPath, buf);
          totalBytes += buf.length;
          downloaded += 1;
        } else {
          failed += 1;
          console.warn(`  ⚠ ${filename}: received non-image bytes (${result.type || 'unknown'})`);
        }
      } else {
        failed += 1;
        console.warn(`  ⚠ ${meta.name}: ${result.error || `HTTP ${result.status}`}`);
      }

      completed += 1;
      if (completed % 50 === 0 || completed === imageEntries.length) {
        console.log(`  ⏳ ${completed}/${imageEntries.length} (${downloaded} dl, ${skipped} skip, ${failed} fail)`);
      }
      await sleep(120 + Math.floor(Math.random() * 280)); // modest pacing
    }
  }

  await Promise.all(workers.map((w) => workerLoop(w)));
  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log('Phase C complete');
  console.log('='.repeat(70));
  console.log(`  Distinct images   : ${imageEntries.length}`);
  console.log(`  Downloaded        : ${downloaded}`);
  console.log(`  Skipped (on disk) : ${skipped}`);
  console.log(`  Failures          : ${failed}`);
  console.log(`  Total size        : ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  Saved to          : ${path.resolve(opts.outDir)}`);
  return failed === 0;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
(async () => {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const ok = await downloadAll(opts);
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(2);
  }
})();

