#!/bin/bash

# DME Products Complete Processing Pipeline
# Run all automation scripts in sequence

set -e  # Exit on any error

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   DME Products - Complete Processing Pipeline                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'  # No Color

# Check Python
echo -e "${BLUE}[1/5]${NC} Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo -e "${RED}✗ Python not found! Install Python 3.6+ and try again.${NC}"
        exit 1
    fi
    PYTHON="python"
else
    PYTHON="python3"
fi
PYTHON_VERSION=$($PYTHON --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION"
echo ""

# Install dependencies
echo -e "${BLUE}[2/5]${NC} Installing dependencies..."
$PYTHON -m pip install -q requests 2>/dev/null || true
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Step 1: Consolidate
echo -e "${BLUE}[3/5]${NC} Consolidating products from extracted pages..."
if $PYTHON consolidate_products.py; then
    echo -e "${GREEN}✓${NC} Consolidation complete"
else
    echo -e "${YELLOW}⚠${NC} Consolidation failed or no page files found"
    echo "   Create products_page_1.json, products_page_2.json, etc. first"
fi
echo ""

# Step 2: Download images
if [ -f "products.json" ]; then
    echo -e "${BLUE}[4/5]${NC} Downloading product images..."
    if $PYTHON image_downloader.py; then
        echo -e "${GREEN}✓${NC} Image download complete"
    else
        echo -e "${YELLOW}⚠${NC} Image download had issues (check error log)"
    fi
    echo ""
    
    # Step 3: Generate reports
    echo -e "${BLUE}[5/5]${NC} Generating analytics reports..."
    if $PYTHON generate_reports.py; then
        echo -e "${GREEN}✓${NC} Report generation complete"
    else
        echo -e "${YELLOW}⚠${NC} Report generation failed"
    fi
else
    echo -e "${YELLOW}⚠${NC} Skipping image download and reports (no products.json found)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✓ Pipeline Complete!${NC}${YELLOW}                                 ${NC}║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Generated files:"
echo "   • products.json         - Consolidated product data"
echo "   • products.csv          - Spreadsheet format"
echo "   • images/               - Organized product images"
echo "   • reports/              - Analytics and statistics"
echo ""
echo "📖 Next steps:"
echo "   1. Review reports/analytics_report.html in your browser"
echo "   2. Check products.csv in Excel/Sheets"
echo "   3. Integrate products.json into your system"
echo ""
