#!/usr/bin/env bash
# =============================================================================
#  DME Products - Puppeteer Extraction Pipeline (Phase A + Phase B + extras)
#
#  Phase A: extract_products.js          -> products_page_1..N.json   (listing)
#  Phase B: extract_product_details.js   -> products_enriched.json    (descriptions + hi-res images)
#  Phase C (optional, best-effort): reuse existing Python scripts
#             consolidate_products.py    -> products_consolidated.json/.csv
#             image_downloader.py        -> images/   (from products_enriched.json)
#             link_images_to_products.py -> products_final.json/.csv
#             generate_reports.py        -> reports/
#
#  IMPORTANT: The site blocks plain headless browsers, so Phase A / Phase B run
#  a real (headful) Chromium window. If there is no DISPLAY, this script wraps
#  them in xvfb-run.
#
#  Quick smoke test (first 2 listing pages + 10 product pages):
#     ./run_extraction.sh --smoke
#  Full extraction:
#     ./run_extraction.sh
# =============================================================================
set -uo pipefail

cd "$(dirname "$0")"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say()  { echo -e "${BLUE}[run]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC}  $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[err]${NC}  $*"; }

SMOKE=0
for arg in "$@"; do
  case "$arg" in
    --smoke) SMOKE=1 ;;
  esac
done

# --- Environment checks -----------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  err "Node.js not found. Install Node 18+ first."; exit 1
fi
if [ ! -d node_modules/puppeteer ]; then
  say "Installing Puppeteer (one-time Chromium download)..."
  npm install puppeteer >/dev/null 2>&1 || { err "npm install puppeteer failed."; exit 1; }
fi
ok "Node $(node --version), Puppeteer present"

# Headful browsers need a display; use xvfb-run when none is set.
RUN_NODE="node"
if [ -z "${DISPLAY:-}" ] && command -v xvfb-run >/dev/null 2>&1; then
  RUN_NODE="xvfb-run -a node"
  ok "No DISPLAY set - using xvfb-run for the headful browser"
fi

# --- Phase A: listing crawl ------------------------------------------------
say "Phase A: crawling shop listings with Puppeteer..."
A_EXTRA=""
[ "$SMOKE" = "1" ] && A_EXTRA="--end 2"
$RUN_NODE extract_products.js $A_EXTRA
if [ $? -ne 0 ]; then err "Phase A failed. Aborting before Phase B."; exit 1; fi
ok "Phase A done"

# --- Phase B: per-product detail crawl -------------------------------------
say "Phase B: crawling individual product pages for full descriptions + hi-res images..."
B_EXTRA=""
[ "$SMOKE" = "1" ] && B_EXTRA="--limit 10"
$RUN_NODE extract_product_details.js $B_EXTRA
if [ $? -ne 0 ]; then err "Phase B failed. products_enriched.json may be incomplete."; fi
ok "Phase B done (products_enriched.json)"

# --- Phase C: download EVERY product image via the Puppeteer session ---------
# This is the reliable image downloader: it uses the headful browser session
# (which already passed the bot check) so Imperva doesn't block the downloads —
# the Python image_downloader.py is blocked and would save HTML placeholders.
say "Phase C: downloading all product image files through the Puppeteer session..."
C_EXTRA=""
[ "$SMOKE" = "1" ] && C_EXTRA="--limit 12"
$RUN_NODE extract_images.js $C_EXTRA
if [ $? -ne 0 ]; then warn "image download completed with some failures. Retry: node extract_images.js"; fi
ok "Phase C done (images/<category>/...)"

# --- Phase D: optional reuse of the existing Python pipeline -----------------
if ! command -v python3 >/dev/null 2>&1; then
  warn "python3 not found - skipping Phase D (consolidation/link/reports)."
  warn "products_enriched.json + images/ already contain every product and image."
  exit 0
fi
PY=python3
$PY -c "import requests" >/dev/null 2>&1 || { warn "installing 'requests' dependency..."; $PY -m pip install -q requests || true; }

say "Phase D: consolidation into a fresh file (does not touch existing products.json)..."
$PY consolidate_products.py -o products_consolidated.json || warn "consolidation step failed (non-fatal)"

say "Phase D: linking downloaded images to products -> products_final.json..."
node map_images_to_products.js || warn "image mapping failed (non-fatal)"
# Remove any HTML placeholder files the old Python downloader may have left.
find images -type f \( -name '*.html' -o -size -500c \) -delete 2>/dev/null || true

say "Phase D: generating analytics reports..."
$PY generate_reports.py --input products_final.json -o reports/ || \
  warn "report generation failed (non-fatal)"

echo
echo "============================================================"
echo -e "${GREEN}Extraction complete!${NC}"
echo "  products_page_*.json     (all listing pages)"
echo "  products_enriched.json   (full descriptions + hi-res image URLs)"
echo "  images/                  (downloaded image files for ALL products)"
echo "  products_consolidated.json/.csv  (fresh consolidation)"
echo "  products_final.json/.csv (linked, best-effort)"
echo "  reports/                 (analytics, best-effort)"
echo "============================================================"
