#!/usr/bin/env node
/**
 * Generate analytics reports from products_final.json.
 *
 * Unlike generate_reports.py (which reads `image_url` / `description` fields),
 * this reads the final schema used in products_final.json:
 *   name, category, url, full_description, image_alt, image_file, image_filename
 *
 * Writes into ./reports/:
 *   summary_report.txt       - text overview
 *   categories_report.csv    - category breakdown
 *   analytics_report.html    - interactive/pretty overview
 *
 * Usage:
 *   node generate_reports.js
 *   node generate_reports.js --input products_final.json
 *   node generate_reports.js -o reports
 */

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const opts = { input: 'products_final.json', outDir: 'reports' };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--input': case '-i': opts.input = argv[++i]; break;
      case '--out': case '-o': opts.outDir = argv[++i]; break;
    }
  }
  return opts;
}

function classifyImage(imageFile) {
  if (!imageFile) return { type: 'NONE' };
  const ext = path.extname(String(imageFile)).toLowerCase().replace('.', '');
  if (/^(jpe?g|png|gif|webp|avif|heic|bmp|svg)$/.test(ext)) {
    return { type: ext === 'jpeg' ? 'jpg' : ext };
  }
  return { type: 'OTHER' };
}

function main(opts) {
  if (!fs.existsSync(opts.input)) {
    console.error(`❌ Input not found: ${opts.input}`);
    return 1;
  }
  const products = JSON.parse(fs.readFileSync(opts.input, 'utf-8'));
  if (!Array.isArray(products)) {
    console.error('❌ Input is not a JSON array.');
    return 1;
  }

  fs.mkdirSync(opts.outDir, { recursive: true });

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const total = products.length;

  // Category aggregation
  const catMap = new Map();
  for (const p of products) {
    const cat = p.category || 'Uncategorized';
    if (!catMap.has(cat)) catMap.set(cat, { count: 0, withImg: 0, withDesc: 0 });
    const c = catMap.get(cat);
    c.count += 1;
    if (p.image_file) c.withImg += 1;
    if (p.full_description) c.withDesc += 1;
  }

  const cats = Array.from(catMap.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.count - a.count);

  const withImg = products.filter((p) => p.image_file).length;
  const withDesc = products.filter((p) => p.full_description).length;
  const withNameUrl = products.filter((p) => p.name && p.url).length;

  // Image format breakdown
  const fmt = new Map();
  for (const p of products) {
    const t = classifyImage(p.image_file).type;
    fmt.set(t, (fmt.get(t) || 0) + 1);
  }

  // ---------------- summary_report.txt ----------------
  let summary = 'DME PRODUCTS ANALYSIS REPORT\n';
  summary += '============================================================\n';
  summary += `Generated: ${now}\n`;
  summary += `Source: ${opts.input}\n\n`;
  summary += `Total Products:                     ${total.toLocaleString()}\n`;
  summary += `Total Categories:                   ${cats.length.toLocaleString()}\n`;
  summary += `Products linked to an image:        ${withImg.toLocaleString()} (${Math.round((withImg / total) * 100)}%)\n`;
  summary += `Products with a description:        ${withDesc.toLocaleString()} (${Math.round((withDesc / total) * 100)}%)\n`;
  summary += `Complete records (name + url):      ${withNameUrl.toLocaleString()}\n\n`;
  summary += 'IMAGE FORMAT BREAKDOWN\n';
  summary += '------------------------------------------------------------\n';
  [...fmt.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    summary += `  ${String(k).padEnd(8)}${v.toLocaleString()}\n`;
  });

  summary += '\nTOP 15 CATEGORIES\n';
  summary += '------------------------------------------------------------\n';
  cats.slice(0, 15).forEach((c, i) => {
    summary += `${String(i + 1).padStart(2)}. ${c.name.padEnd(55)}${String(c.count).padStart(5)} products\n`;
  });

  fs.writeFileSync(path.join(opts.outDir, 'summary_report.txt'), summary);

  // ---------------- categories_report.csv ----------------
  const csvLines = ['Category,Product Count,With Images,With Descriptions'];
  for (const c of cats) {
    csvLines.push(`"${c.name.replace(/"/g, '""')}",${c.count},${c.withImg},${c.withDesc}`);
  }
  fs.writeFileSync(path.join(opts.outDir, 'categories_report.csv'), csvLines.join('\n'));

  // ---------------- analytics_report.html ----------------
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const topCats = cats.slice(0, 20);
  const maxCat = topCats.length ? topCats[0].count : 1;
  const catRows = topCats.map((c) => `      <tr><td>${esc(c.name)}</td><td>${c.count}</td><td>${c.withImg}</td><td>${c.withDesc}</td><td class="barcell"><div class="bar" style="width:${Math.round((c.count / maxCat) * 100)}%"></div></td></tr>`).join('\n');
  const fmtRows = [...fmt.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `      <tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('\n');
  const samples = products.slice(0, 12).map((p) => `      <div class="card"><div class="img">${p.image_file ? `<img src="../${esc(p.image_file)}" alt="${esc(p.image_alt || p.name)}" loading="lazy">` : '<span class="noimg">no image</span>'}</div><div class="nm">${esc(p.name)}</div><div class="ct">${esc(p.category || '')}</div></div>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DME Products Analytics Report</title>
<style>body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#f4f6f8;color:#222}
.wrap{max-width:1100px;margin:0 auto;padding:24px}header{background:#0b5fa5;color:#fff;padding:20px 24px;border-radius:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}
.stat{background:#fff;border-radius:8px;padding:14px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.stat b{font-size:26px;display:block;color:#0b5fa5}table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left;font-size:14px}th{background:#0b5fa5;color:#fff}
.barcell{width:30%}.bar{height:12px;background:#0b5fa5;border-radius:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.card .img{height:130px;display:flex;align-items:center;justify-content:center;background:#eef}
.card img{max-width:100%;max-height:130px}.card .nm{font-size:12px;font-weight:bold;padding:6px 8px 0}
.card .ct{font-size:11px;color:#666;padding:0 8px 8px}.noimg{color:#999;font-size:12px}
h2{margin-top:28px}footer{color:#777;font-size:12px;margin:24px 0}</style></head>
<body><div class="wrap">
<header><h1>DME Products Analytics Report</h1><div>Generated: ${now} &nbsp;|&nbsp; Source: ${esc(opts.input)}</div></header>
<div class="stats">
<div class="stat"><b>${total.toLocaleString()}</b>Products</div>
<div class="stat"><b>${cats.length}</b>Categories</div>
<div class="stat"><b>${withImg.toLocaleString()}</b>With images (${Math.round((withImg / total) * 100)}%)</div>
<div class="stat"><b>${withDesc.toLocaleString()}</b>With descriptions (${Math.round((withDesc / total) * 100)}%)</div>
</div>
<h2>Top 20 Categories</h2>
<table><tr><th>Category</th><th>Products</th><th>With images</th><th>With desc.</th><th></th></tr>
${catRows}</table>
<h2>Image Formats</h2>
<table><tr><th>Format</th><th>Count</th></tr>
${fmtRows}</table>
<h2>Sample Products</h2>
<div class="grid">
${samples}</div>
<footer>Advanced DME Supplies catalog export.</footer>
</div></body></html>`;

  fs.writeFileSync(path.join(opts.outDir, 'analytics_report.html'), html);

  console.log(`✅ Reports written to ${opts.outDir}/`);
  console.log(`   products=${total}, categories=${cats.length}, withImg=${withImg}, withDesc=${withDesc}`);
  console.log('   - summary_report.txt\n   - categories_report.csv\n   - analytics_report.html');
  return 0;
}

if (require.main === module) {
  process.exit(main(parseArgs(process.argv.slice(2))) || 0);
}