#!/usr/bin/env node
/**
 * Map every product to its downloaded image file WITHOUT running the browser.
 *
 * Reads the listing extractions (products_page_*.json) + enriched data
 * (products_enriched.json), then links each product to the actual image file in
 * images/ using the SAME filename logic as extract_images.js (URL basename).
 * Unlike the old link_images_to_products.py — which just grabbed the first image
 * in a category folder — this maps the exact per-product image.
 *
 * Writes:
 *   products_final.json   (each product -> image_file / image_filename)
 *   products_final.csv
 *
 * Usage:
 *   node map_images_to_products.js
 *   node map_images_to_products.js --out products_final.json
 *   node map_images_to_products.js --images images
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { outFile: 'products_final.json', imagesDir: 'images' };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--out': case '-o': opts.outFile = argv[++i]; break;
      case '--images': case '-i': opts.imagesDir = argv[++i]; break;
    }
  }
  return opts;
}

// Same filename derivation as extract_images.js.
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

// Load listing products, overlay enriched (hi-res image_url / description).
function loadProducts() {
  const pages = fs
    .readdirSync('.')
    .filter((f) => /^products_page_\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

  let raw = [];
  for (const f of pages) raw = raw.concat(JSON.parse(fs.readFileSync(f, 'utf-8')));

  if (fs.existsSync('products_enriched.json')) {
    let enriched = [];
    try { enriched = JSON.parse(fs.readFileSync('products_enriched.json', 'utf-8')); } catch (e) {}
    const byUrl = new Map();
    enriched.forEach((p) => { if (p.url) byUrl.set(p.url, p); });
    raw = raw.map((p) => {
      const en = byUrl.get(p.url);
      if (!en) return p;
      // Keep the listing thumbnail URL as image_url (that file is downloaded);
      // the hi-res URL goes into image_url_hi (fetched only if present on disk).
      const merged = { ...p, ...en };
      if (en.image_url && en.image_url !== p.image_url) {
        merged.image_url_hi = en.image_url;
        merged.image_url = p.image_url || en.image_url;
      }
      return merged;
    });
  }

  const seen = new Set();
  const unique = [];
  for (const p of raw) {
    if (p.url && !seen.has(p.url)) { seen.add(p.url); unique.push(p); }
  }
  return unique;
}

// Index every image file on disk: basename -> relative paths.
function indexImages(imagesDir) {
  const index = new Map(); // lowercase basename -> [ { rel, dir } ]
  function walk(dir, relDir) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch (e) { return; }
    for (const name of entries) {
      const abs = path.join(dir, name);
      const rel = path.join(relDir, name);
      if (fs.statSync(abs).isDirectory()) {
        walk(abs, rel);
      } else {
        const key = name.toLowerCase();
        if (!index.has(key)) index.set(key, []);
        index.get(key).push({ rel, dir: path.dirname(rel) });
      }
    }
  }
  walk(imagesDir, '');
  return index;
}

const sanitizeCategory = (c) =>
  (c || 'uncategorized').replace(/[\/\\:*?"<>|]/g, '_').trim() || 'uncategorized';

// Try the exact filename first, then a version with WooCommerce size suffixes
// (e.g. "foo-247x300.jpg" -> "foo.jpg") in case of hi-res/thumbnail mismatch.
function findInIndex(index, fileName) {
  const exact = index.get(fileName.toLowerCase());
  if (exact && exact.length) return exact;
  const stripped = fileName.replace(/-\d+x\d+(\.\w+)$/i, '$1'); // {ext}
  if (stripped !== fileName) {
    const alt = index.get(stripped.toLowerCase());
    if (alt && alt.length) return alt;
  }
  return null;
}

function main(opts) {
  if (!fs.existsSync(opts.imagesDir)) {
    console.error(`❌ images dir not found: ${opts.imagesDir}`);
    return 1;
  }

  const products = loadProducts();
  const index = indexImages(opts.imagesDir);

  const finalProducts = [];
  let linked = 0;
  const missing = [];

  for (const product of products) {
    const rec = {
      name: product.name || '',
      category: product.category || '',
      url: product.url || '',
      full_description: product.full_description || product.description || '',
      image_alt: product.image_alt || '',
    };

    const imageUrl = product.image_url || '';
    // Prefer the hi-res URL only when its file actually exists on disk;
    // otherwise fall back to the listing thumbnail URL.
    const candidates = (() => {
      for (const u of [product.image_url_hi, product.image_url]) {
        if (!u) continue;
        const found = findInIndex(index, filenameFromUrl(u, product.name));
        if (found && found.length) return { found, u };
      }
      return null;
    })();
    if (candidates) {
      const ownDir = sanitizeCategory(product.category);
      const chosen =
        candidates.found.find((c) => c.dir === ownDir) ||
        candidates.found.find((c) => c.dir.toLowerCase() === ownDir.toLowerCase()) ||
        candidates.found.find((c) => !c.dir.includes(path.sep)) ||
        candidates.found[0];
      rec.image_file = path.join(opts.imagesDir, chosen.rel);
      rec.image_filename = chosen.rel.split(path.sep).pop();
      linked += 1;
    } else {
      missing.push({ name: product.name, category: product.category, url: product.url, image_url: imageUrl || null });
    }

    finalProducts.push(rec);
  }

  fs.writeFileSync(opts.outFile, JSON.stringify(finalProducts, null, 2));

  const csvFile = opts.outFile.replace(/\.json$/, '.csv');
  const fieldnames = ['name', 'category', 'full_description', 'image_file', 'image_filename', 'url'];
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [fieldnames.join(',')];
  for (const r of finalProducts) lines.push(fieldnames.map((f) => esc(r[f])).join(','));
  fs.writeFileSync(csvFile, lines.join('\n'));

  const pct = products.length ? ((linked / products.length) * 100).toFixed(1) : '0';
  console.log('='.repeat(70));
  console.log('Image-to-product mapping complete');
  console.log('='.repeat(70));
  console.log(`  Products total   : ${products.length}`);
  console.log(`  Linked to image  : ${linked} (${pct}%)`);
  console.log(`  Missing/no image : ${missing.length}`);
  console.log(`  JSON written to  : ${path.resolve(opts.outFile)}`);
  console.log(`  CSV  written to  : ${path.resolve(csvFile)}`);

  if (missing.length) {
    console.log('\n❓ Products without a linked image (first 40):');
    missing.slice(0, 40).forEach((m) =>
      console.log(`   - ${m.name} | ${m.category} | ${m.image_url || 'NO_IMAGE_URL'}`)
    );
  }

  return missing.length === 0 ? 0 : 2;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  try {
    process.exit(main(opts));
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(3);
  }
})();

