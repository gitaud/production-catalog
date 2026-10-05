# 🚀 Execution Guide - DME Products Automation Scripts

Complete instructions for running the automation scripts using VS Code or command line.

## Quick Start

**Recommended:** Terminal/Command Line (fastest and simplest)

```bash
# 1. Consolidate extracted pages into single JSON
python3 consolidate_products.py --input pages/ --output products.json

# 2. Download product images
python3 image_downloader.py --input products.json --output images/

# 3. Generate analytics reports
python3 generate_reports.py --input products.json --output reports/
```

---

## Method 1: Terminal / Command Line (⭐ RECOMMENDED)

### Prerequisites
- Python 3.6+ installed
- Terminal/Command Prompt access
- `requests` library (for image downloads)

### Install Dependencies
```bash
pip3 install requests
```

Or on Windows:
```bash
pip install requests
```

### Step-by-Step

#### 1. **Consolidate Products from Extracted Pages**

Extract products from all 88 pages using the browser console (see EXTRACTION_GUIDE.md), saving each as:
- `products_page_1.json`
- `products_page_2.json`
- ... up to `products_page_88.json`

Then run:
```bash
python3 consolidate_products.py
```

**What it does:**
- Finds all `products_page_*.json` files
- Merges them into single `products.json`
- Removes duplicates
- Creates `products.csv` for spreadsheets
- Generates metadata file

**Output:**
```
products.json              ← Main consolidated data
products.csv              ← Excel/spreadsheet format
products_metadata.json    ← Extraction statistics
```

**With custom paths:**
```bash
python3 consolidate_products.py --input ./extracted_pages/ --output ./consolidated/all_products.json
```

Or short form:
```bash
python3 consolidate_products.py -i ./pages -o products.json
```

#### 2. **Download Product Images**

After consolidation:
```bash
python3 image_downloader.py
```

**What it does:**
- Reads `products.json`
- Downloads images from all products
- Organizes by category folders
- Handles failures gracefully
- Shows progress

**Output:**
```
images/
├── CANES AND CRUTCHES/
│   ├── product1.jpg
│   └── product2.jpg
├── WALKERS/
│   └── walker1.jpg
├── ROLLATORS/
│   └── rollator1.jpg
└── ... (one folder per category)
```

**Customize:**
```bash
# Use 8 concurrent downloads (default is 4)
python3 image_downloader.py --workers 8

# Custom input and output
python3 image_downloader.py -i ./data/products.json -o ./product_images

# Short form
python3 image_downloader.py -i products.json -o images -w 6
```

#### 3. **Generate Analytics Reports**

```bash
python3 generate_reports.py
```

**What it does:**
- Analyzes all products
- Creates category breakdown
- Calculates data quality metrics
- Generates 3 report formats

**Output:**
```
reports/
├── summary_report.txt          ← Text summary
├── categories_report.csv       ← Category statistics
└── analytics_report.html       ← Interactive HTML report (open in browser!)
```

**Customize:**
```bash
python3 generate_reports.py -i products.json -o reports
```

---

## Method 2: Visual Studio Code

### Prerequisites
- VS Code installed
- Python extension installed (Microsoft)
- Python 3.6+ installed

### Setup

#### 1. **Install Python Extension**
- Open VS Code
- Click Extensions (Ctrl+Shift+X or Cmd+Shift+X)
- Search for "Python"
- Install by Microsoft

#### 2. **Configure Python Interpreter**
- Press Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (Mac)
- Type "Python: Select Interpreter"
- Choose your Python 3 installation

#### 3. **Create Terminal**
- View → Terminal (or Ctrl+`)
- Terminal opens at bottom

### Running Scripts

#### **Option A: Via Terminal (inside VS Code)**

```bash
# 1. Navigate to the scripts directory
cd path/to/advanced_dme_products_complete

# 2. Run consolidation
python3 consolidate_products.py

# 3. Run image download
python3 image_downloader.py

# 4. Generate reports
python3 generate_reports.py
```

#### **Option B: Run Individual Script Files**

1. **Open script in editor**
   - File → Open → `consolidate_products.py`

2. **Edit parameters (optional)**
   - Find this section:
   ```python
   if __name__ == "__main__":
       parser = argparse.ArgumentParser(...)
   ```
   - Modify default paths if needed

3. **Run the script**
   - Right-click in editor → "Run Python File in Terminal"
   - Or press Ctrl+Alt+N (with Code Runner extension)
   - Or press F5 (with debugger)

4. **View output**
   - Terminal at bottom shows results
   - Errors displayed clearly

### VS Code Workflow Example

```
1. Open Folder: File → Open Folder → select advanced_dme_products_complete
2. Open Terminal: Ctrl+`
3. Install dependencies: pip3 install requests
4. Run script: python3 consolidate_products.py
5. Monitor output in terminal
6. Check created files in Explorer (left sidebar)
7. Open reports in browser: Right-click → Open in Default Browser
```

### Debugging in VS Code

If script fails:

1. **Set breakpoints**
   - Click line number to create breakpoint
   - Red dot appears

2. **Run with debugger**
   - Press F5
   - Execution pauses at breakpoint
   - Inspect variables

3. **View console output**
   - Terminal shows print() statements
   - Errors shown in red

---

## Complete Workflow: From Extraction to Delivery

### Full Automation Pipeline

```bash
#!/bin/bash
# save as: run_all.sh

echo "DME Products Complete Pipeline"
echo "=============================="

# 1. Consolidate
echo "Step 1: Consolidating products..."
python3 consolidate_products.py --input pages/ --output products.json

# 2. Download images
echo "Step 2: Downloading images..."
python3 image_downloader.py --input products.json --output images/ --workers 8

# 3. Generate reports
echo "Step 3: Generating reports..."
python3 generate_reports.py --input products.json --output reports/

# 4. Create final package
echo "Step 4: Creating ZIP package..."
zip -r DME_Products_Complete.zip products.json products.csv images/ reports/

echo "✅ Complete! Package ready: DME_Products_Complete.zip"
```

**Run it:**
```bash
chmod +x run_all.sh
./run_all.sh
```

---

## Troubleshooting

### "Command not found: python3"
**Solution:**
- Windows: Use `python` instead of `python3`
- Mac/Linux: Install Python from python.org or use package manager
- Check: `python --version`

### "ModuleNotFoundError: No module named 'requests'"
**Solution:**
```bash
pip3 install requests
# or
pip install requests
```

### "No products_page_*.json files found"
**Problem:** Extraction files not created yet
**Solution:** 
1. Run the browser extraction script first (see EXTRACTION_GUIDE.md)
2. Save each page as `products_page_1.json`, `products_page_2.json`, etc.
3. Put files in same directory as `consolidate_products.py`
4. Run consolidation again

### Script hangs on image download
**Problem:** Slow internet or large number of images
**Solution:**
- Reduce worker threads: `python3 image_downloader.py --workers 2`
- Check internet connection
- Try again later

### Permission denied error
**Solution:**
```bash
chmod +x consolidate_products.py
chmod +x image_downloader.py
chmod +x generate_reports.py
```

### JSON errors in consolidated file
**Problem:** One or more extracted page files has invalid JSON
**Solution:**
1. Check which file has error (shown in output)
2. Open that file in text editor
3. Verify it's valid JSON (use jsonlint.com)
4. Fix or delete invalid file
5. Re-run consolidation

---

## Advanced Usage

### Custom File Paths

```bash
# All in different directories
python3 consolidate_products.py \
    --input /path/to/extracted/pages \
    --output /path/to/output/all_products.json

python3 image_downloader.py \
    --input /path/to/output/all_products.json \
    --output /path/to/images \
    --workers 8

python3 generate_reports.py \
    --input /path/to/output/all_products.json \
    --output /path/to/reports
```

### Parallel Processing

For large extractions, speed up downloads:
```bash
# Use 16 concurrent connections (careful: might trigger rate limits)
python3 image_downloader.py --workers 16
```

### Integration with Other Tools

**Import consolidated data into database:**
```bash
# MySQL/MariaDB
mysql -u user -p database < load_products.sql

# PostgreSQL
psql -U user -d database -f load_products.sql
```

**Process with pandas (Python data analysis):**
```python
import pandas as pd
df = pd.read_json('products.json')
df.to_excel('products_analysis.xlsx')
```

---

## File Descriptions

### consolidate_products.py
- **Purpose:** Merge individual page extractions
- **Input:** `products_page_*.json` files
- **Output:** `products.json`, `products.csv`, metadata
- **Time:** ~5-10 seconds for 88 pages
- **Memory:** Minimal

### image_downloader.py
- **Purpose:** Download product images from URLs
- **Input:** `products.json`
- **Output:** `images/` directory organized by category
- **Time:** Varies (depends on image count and internet speed)
- **Memory:** High (manages concurrent downloads)

### generate_reports.py
- **Purpose:** Create analytics and statistics
- **Input:** `products.json`
- **Output:** Text, CSV, and HTML reports
- **Time:** ~5-30 seconds
- **Memory:** Medium

---

## Performance Tips

1. **Consolidation:** Single-threaded, usually instant
2. **Downloads:** Use 4-8 workers for balance (default 4)
3. **Reports:** Usually fast, even with 5000+ products
4. **Overall:** 
   - Small dataset (< 1000 products): < 5 minutes
   - Medium dataset (1000-5000): 10-30 minutes
   - Large dataset (5000+): 30+ minutes

---

## Next Steps

After running these scripts:

1. **Review reports** - Open `reports/analytics_report.html` in browser
2. **Verify data** - Check `products.csv` in spreadsheet app
3. **Test integration** - Load `products.json` into your application
4. **Package for delivery** - Zip everything for client

```bash
zip -r DME_Complete_Export_$(date +%Y%m%d).zip \
    products.json \
    products.csv \
    images/ \
    reports/
```

---

**Questions?** Check the specific script's built-in help:
```bash
python3 consolidate_products.py --help
python3 image_downloader.py --help
python3 generate_reports.py --help
```

Happy data processing! 🚀
