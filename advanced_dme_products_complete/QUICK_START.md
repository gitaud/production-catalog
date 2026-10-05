# ⚡ Quick Start - 3 Minutes to Complete Data

## Fastest Path: Using the Shell Script

### Mac / Linux Users
```bash
chmod +x run_all.sh
./run_all.sh
```

### Windows Users
```cmd
run_all.bat
```

**That's it!** The script will:
1. ✓ Install Python dependencies
2. ✓ Consolidate extracted products
3. ✓ Download all product images
4. ✓ Generate analytics reports

---

## Manual Steps (if preferred)

### 1️⃣ Consolidate Products (30 seconds)
```bash
python3 consolidate_products.py
```
Creates: `products.json` and `products.csv`

### 2️⃣ Download Images (5-60 minutes, depending on count)
```bash
python3 image_downloader.py
```
Creates: `images/` folder organized by category

### 3️⃣ Generate Reports (1 minute)
```bash
python3 generate_reports.py
```
Creates: `reports/` folder with analytics

---

## What You Get

| File | Format | Use |
|------|--------|-----|
| `products.json` | JSON | Code/API integration |
| `products.csv` | CSV | Excel/Google Sheets |
| `images/` | JPG/PNG | Product galleries |
| `reports/analytics_report.html` | HTML | Business analytics (open in browser) |

---

## VS Code? No Problem

1. Open folder in VS Code
2. Terminal → `Ctrl+``
3. Run: `python3 run_all.sh` (Mac/Linux) or `run_all.bat` (Windows)
4. Watch progress in terminal

---

## Troubleshooting

**"Python not found"**
- Install from python.org
- Use `python` instead of `python3` on Windows

**"ModuleNotFoundError: requests"**
- Run: `pip3 install requests`
- Then run the script again

**"No products_page files found"**
- Extract pages first using EXTRACTION_GUIDE.md
- Save as: `products_page_1.json`, `products_page_2.json`, etc.

---

## Next: Read Full Documentation

- **EXECUTION_GUIDE.md** - Detailed step-by-step instructions
- **EXTRACTION_GUIDE.md** - How to extract products from website
- **README.md** - Complete project overview

---

**Ready to start?** Run `./run_all.sh` now! 🚀
