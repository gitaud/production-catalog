# Puppeteer Extraction Tool — Usage Guide

Adds a fully automated Puppeteer (Node/Chromium) replacement for the manual
**browser-console step** (`extraction_script.js`) and for `fetch_full_descriptions.py`.

## New files

| File | Purpose |
|------|---------|
| `extract_products.js` | **Phase A** — crawls all `/shop/page/N/` listings → `products_page_1.json` … `N.json` |
| `extract_product_details.js` | **Phase B** — visits each product URL → full description + hi-res image → `products_enriched.json` |
| `extract_images.js` | **Phase C** — downloads the actual image **files** for every product → `images/<category>/…` |
| `run_extraction.sh` | One-command driver (Phase A → B → C → optional reuse of existing Python scripts) |
| `package.json` / `package-lock.json` | npm metadata; `puppeteer` dependency |
| `.puppeteer-profile/` | Cached browser session/cookie so the bot-challenge is passed only once |

Existing scripts (`consolidate_products.py`, `fetch_full_descriptions.py`,
`image_downloader.py`, `link_images_to_products.py`, `generate_reports.py`) are
**not modified** — they are reused as-is.

## Important: headful browser is required

This site is protected by Imperva's **"Robot Challenge Screen"**. Testing showed
plain headless Chromium is **blocked**, but a real (headful) visible window
passes. Both scripts therefore default to **headful** and reuse the session
profile so the challenge is solved only once. `run_extraction.sh` automatically
wraps them in `xvfb-run` when no `DISPLAY` is available.

## Quick start

```bash
# one-time setup
npm install                 # installs puppeteer (downloads Chromium)

# smoke test (2 listing pages + 10 product pages)
./run_extraction.sh --smoke

# full extraction (all pages + all products)
./run_extraction.sh
```

## Manual usage

```bash
# Phase A: listings
node extract_products.js                         # all pages (auto-detect end)
node extract_products.js --start 40 --end 60     # resume a partial run
node extract_products.js --page 3                # just page 3
node extract_products.js --delay 2000            # pace requests; default 3–5 s
node extract_products.js --out pages/            # write into a subfolder

# Phase B: details (descriptions + hi-res images)
node extract_product_details.js                          # auto-detect inputs
node extract_product_details.js --input products.json
node extract_product_details.js --workers 4              # concurrency (default 3)
node extract_product_details.js --limit 20               # debug subset
node extract_product_details.js --no-resume              # re-process everything
```

Both scripts resume automatically by default (they skip already-done pages/URLs),
so an interrupted run can simply be re-invoked.

## Phase C — downloading the actual image files

The listing pages already carry an image URL for **every** product, and
`extract_images.js` downloads the real files for all of them:

```bash
node extract_images.js                    # all images
node extract_images.js --workers 6        # more concurrency
node extract_images.js --limit 20         # smoke test
node extract_images.js --no-resume        # re-download everything
```

- Downloads happen **through the Puppeteer session** (not Python `requests`),
  which is what lets them succeed past the site's bot check. The default
  `image_downloader.py` gets blocked and can save HTML challenge pages as images.
- Output goes to `images/<CATEGORY>/<filename-from-URL>` (same folder layout the
  Python scripts expect).
- It **skips files already on disk only if they are genuinely valid images** —
  it detects and re-downloads any corrupted `.html`-placeholder files left by
  earlier `requests`-based downloads.
- Recognized formats include JPEG, PNG, GIF, WebP, AVIF/HEIC, BMP, SVG.
- Deduplicates images shared by multiple products and resumes automatically.

## Output schema

`products_enriched.json` (the primary result) — one object per product:

```jsonc
{
  "name": "Aluminum Small base Quad Canes",
  "category": "ALUMINUM QUAD CANES",
  "url": "https://advanceddmesupplies.com/product/aluminum-quad-canes/",
  "full_description": "Small base design allows for a faster pace; ...",
  "image_url": "https://advanceddmesupplies.com/wp-content/uploads/2017/07/aluminum-quad-cane1.jpg",
  "image_alt": "Aluminum Small base Quad Canes"
}
```

`image_url` is the **full-resolution** image (not the `-247x300` thumbnail).

## Notes & known caveats

- A few product pages contain **no descriptive text** (only an image and
  buy-box) — those entries keep `category`, `url`, `name`, and `image_url`, and
  `full_description` will be empty. This mirrors the source site.
- The existing `image_downloader.py` / `link_images_to_products.py` reuse logic
  that maps by **category folder**, so a product may be linked to the *first*
  image in its category rather than its exact image. `products_enriched.json`
  always holds the exact per-product `image_url`, so prefer that for accuracy.
- `fetch_full_descriptions.py` is now redundant (it uses plain `urllib`, which
  this site blocks) — Phase B replaces it.
- Respect the site's terms of service and keep request pacing polite.
