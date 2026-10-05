# 🎯 Complete Visual Studio Code Setup & Execution Guide

**Step-by-step guide to run the entire extraction in Visual Studio Code**

---

## ✅ What You Need (Pre-requisites)

Before starting, make sure you have:
- [ ] **Python 3.7+** installed on your computer
- [ ] **Visual Studio Code (VS Code)** installed
- [ ] Internet connection (for downloading images)

---

## 📥 PART 1: Download & Extract the Package

### Step 1: Download the ZIP
1. Download: `Advanced_DME_Supplies_Products_COMPLETE.zip`
2. Right-click → **"Extract All"** (or double-click on Mac)
3. Choose location (e.g., Desktop or Documents)
4. You'll have a folder: `advanced_dme_products_complete/`

---

## 🚀 PART 2: Open in Visual Studio Code

### Step 2: Open VS Code
1. Open **Visual Studio Code**
2. Click **File** → **Open Folder**
3. Navigate to and select: `advanced_dme_products_complete/`
4. Click **"Open"**

**You should see:**
```
advanced_dme_products_complete
├── 📄 START_HERE.md
├── 📄 consolidate_products.py
├── 📄 fetch_full_descriptions.py
├── 📄 image_downloader.py
├── 📄 link_images_to_products.py
├── 📄 generate_reports.py
└── ... (other files)
```

### Step 3: Install Python Extension (First Time Only)
1. Click the **Extensions** icon (4 squares icon on left sidebar)
2. Search for: `Python`
3. Install the one by **Microsoft** (blue icon)
4. Wait for installation to complete

**You'll see:**
```
Python
Microsoft
Version 2024.x.x
⚙️ Manage | Uninstall
```

---

## ⚙️ PART 3: Configure Python Interpreter

### Step 4: Select Python Interpreter
1. Press **Ctrl + Shift + P** (Windows/Linux) or **Cmd + Shift + P** (Mac)
2. Type: `Python: Select Interpreter`
3. Choose your **Python 3.x.x** installation
4. Click it to confirm

**Tip:** If you don't see Python listed:
- Install Python from **python.org** 
- Choose "Add Python to PATH" during installation
- Restart VS Code
- Try again

---

## 📖 PART 4: Read the Guides

### Step 5: Understand the Workflow
1. In VS Code, open **START_HERE.md** (click on it in left panel)
2. Read the quick overview
3. Then open **FINAL_OUTPUT_WITH_ACTUAL_IMAGES.md**
4. Understand what you'll get

---

## 🖥️ PART 5: Open Terminal in VS Code

### Step 6: Open Integrated Terminal
1. Click **Terminal** menu (top menu bar)
2. Click **New Terminal**
3. A terminal window opens at the **bottom** of VS Code

**You should see:**
```
PS C:\Users\YourName\Desktop\advanced_dme_products_complete>  (Windows)
or
username@MacBook advanced_dme_products_complete % (Mac)
or
user@computer:~/advanced_dme_products_complete$  (Linux)
```

**The `>` or `$` prompt means terminal is ready!**

---

## 📦 PART 6: Install Python Dependencies

### Step 7: Install Required Libraries
In the terminal, type this command and press **Enter**:

```bash
pip install -r requirements.txt
```

**What you'll see:**
```
Collecting requests
  Downloading requests-2.31.0-py3-none-any.whl (62 kB)
Installing collected packages: requests
Successfully installed requests-2.31.0
```

**This installs the `requests` library needed for downloading images.**

---

## 🎬 PART 7: Run Step 1 - Consolidate Products

### Step 8: Run consolidate_products.py

In the terminal, type:

```bash
python consolidate_products.py
```

Press **Enter**.

**What happens:**
```
======================================================================
DME Products Consolidation Tool
======================================================================

📂 Found 0 page files:

Note: This is EXPECTED for first run!
You need to extract pages first using the browser.
```

**Don't worry if it says "0 page files"** - you'll need to extract from the website first.

**To extract products from the website:**
1. Open this guide: **COMPLETE_WORKFLOW_WITH_DESCRIPTIONS.md**
2. Scroll to: **Step 1: Extract Product URLs from Shop Pages**
3. Follow the browser extraction instructions
4. Save extracted files as: `products_page_1.json`, `products_page_2.json`, etc.
5. Put them in the same folder as the scripts
6. Run the command again

**After extraction, you'll see:**
```
✓ Page 1: 24 products
✓ Page 2: 12 products
... (continues for all pages)

✅ Consolidation complete!
   Output directory: .../products.json
```

---

## 🎬 PART 8: Run Step 2 - Fetch Full Descriptions

### Step 9: Run fetch_full_descriptions.py

After Step 1 completes, in the terminal type:

```bash
python fetch_full_descriptions.py
```

Press **Enter**.

**What happens:**
```
======================================================================
DME Product Description Enrichment Tool
======================================================================

📦 Loaded 24 products (from page 1 sample)
⏳ Fetching descriptions from product pages...

✓ Processed 5/24 products (4 with descriptions)
✓ Processed 10/24 products (9 with descriptions)
... (continues)

✅ Enrichment complete!
   ✓ products_enriched.json
   ✓ products_detailed.csv
```

**Time: 5-15 minutes (depends on number of products)**

**Note:** The script pauses between page loads to be nice to the website server.

---

## 🎬 PART 9: Run Step 3 - Download Actual Images

### Step 10: Run image_downloader.py

After Step 2 completes, in the terminal type:

```bash
python image_downloader.py --input products_enriched.json
```

Press **Enter**.

**What happens:**
```
======================================================================
DME Image Downloader
======================================================================

📦 Loaded 24 products from products_enriched.json
📷 Found 24 products with images

⏳ Downloading images (max 4 concurrent)...
   ✓ Downloaded 10/24
   ✓ Downloaded 20/24
   ✓ Downloaded 24/24

📊 Download Summary:
   ✓ Successfully downloaded: 24
   ❌ Failed: 0
   📊 Total size: 12.45 MB

💾 Images saved to: .../images
✅ Download complete!
```

**Time: 5-60 minutes (depends on number of images)**

**In left panel, you'll see the `images/` folder filling up with images:**
```
images/
├── ALUMINUM QUAD CANES/
│   ├── image1.jpg ✓
│   └── image2.jpg ✓
├── CANES AND CRUTCHES/
│   └── crutches.jpg ✓
```

---

## 🎬 PART 10: Run Step 4 - Link Images to Products

### Step 11: Run link_images_to_products.py

After Step 3 completes, in the terminal type:

```bash
python link_images_to_products.py
```

Press **Enter**.

**What happens:**
```
======================================================================
DME Image-Product Linking Tool
======================================================================

📦 Loaded 24 products
📁 Images directory: .../images
🖼️  Total image files: 24

🔗 Linking images to products...
   ✓ Processed 10/24 (10 with images)
   ✓ Processed 20/24 (20 with images)
   ✓ Processed 24/24 (24 with images)

📊 Results:
   ✓ Products with images: 24/24
   ⚠ Without images: 0

💾 Saving final product data...
   ✓ products_final.json        ← WITH actual image files!
   ✓ products_final.csv         ← Spreadsheet format

✅ Linking complete!
```

---

## 🎬 PART 11: Generate Reports (Optional)

### Step 12: Run generate_reports.py

In the terminal type:

```bash
python generate_reports.py --input products_final.json
```

Press **Enter**.

**What happens:**
```
======================================================================
DME Analytics Report Generator
======================================================================

📊 Analyzing 24 products...

📁 Generating category report...
   ✓ categories_report.csv

📈 Generating summary report...
   ✓ summary_report.txt

📄 Generating HTML report...
   ✓ analytics_report.html

✅ Analysis complete!
   ✓ Products analyzed: 24
   ✓ Categories: 8
   ✓ Data quality: 100% with images
```

**New files created:**
```
reports/
├── analytics_report.html     ← Open in browser!
├── summary_report.txt
└── categories_report.csv
```

---

## 📊 PART 12: View Your Final Data

### Step 13: Open Final Products File

In VS Code left panel, click on:
```
products_final.json
```

**You'll see:**
```json
[
  {
    "name": "Aluminum Small base Quad Canes",
    "category": "ALUMINUM QUAD CANES",
    "full_description": "Small base design allows for a faster pace...",
    "image_file": "images/ALUMINUM QUAD CANES/quad-canes-1.jpg",  ← ACTUAL FILE!
    "image_filename": "quad-canes-1.jpg",
    "url": "https://advanceddmesupplies.com/product/aluminum-quad-canes/"
  },
  ... (more products)
]
```

### Step 14: View Images Folder
In left panel, expand the **images/** folder:
```
images/
├── ALUMINUM QUAD CANES/
│   ├── image1.jpg       ← Real image file!
│   ├── image2.jpg       ← Real image file!
│   └── image3.jpg       ← Real image file!
├── CANES AND CRUTCHES/
│   ├── crutches.jpg     ← Real image file!
│   └── offset.jpg       ← Real image file!
```

Right-click any image → **"Open Preview"** to see it!

### Step 15: Open HTML Report
In left panel, expand **reports/** folder:
```
reports/
└── analytics_report.html
```

Right-click → **"Open with Default Browser"**

Beautiful analytics report opens in your browser! 📊

---

## 🔄 COMPLETE WORKFLOW: All Steps at Once

Instead of running each script separately, you can create a **batch script** to run everything:

### Create a batch file (Windows):

1. In VS Code, right-click in left panel
2. Click **"New File"**
3. Name it: `run_everything.bat`
4. Paste this:

```batch
@echo off
echo Running complete DME extraction workflow...
python consolidate_products.py
python fetch_full_descriptions.py
python image_downloader.py --input products_enriched.json
python link_images_to_products.py
python generate_reports.py --input products_final.json
echo Done! Check products_final.json and images/ folder
pause
```

5. Save (**Ctrl+S**)
6. In terminal, type: `run_everything.bat` and press **Enter**

---

## ❌ TROUBLESHOOTING in VS Code

### Problem: "Python not found"

**Solution:**
1. Install Python from **python.org**
2. Make sure to check: ✓ "Add Python to PATH"
3. Restart VS Code
4. Try again

### Problem: "ModuleNotFoundError: No module named 'requests'"

**Solution:**
In terminal, run:
```bash
pip install requests
```

### Problem: Script won't run / "Command not recognized"

**Solution:**
1. Make sure you're in the correct folder
2. In terminal, type: `pwd` (or `cd` on Windows) to check location
3. Should show: `.../advanced_dme_products_complete`
4. Try running script again

### Problem: Terminal shows errors but I don't understand them

**Solution:**
1. Copy the error message
2. Paste it in the VS Code terminal
3. Read it carefully - usually tells you what's wrong
4. Check the **Troubleshooting** section in EXECUTION_GUIDE.md

---

## 📋 QUICK REFERENCE: All Commands

**Copy-paste these in VS Code terminal:**

```bash
# Install dependencies
pip install -r requirements.txt

# Step 1: Consolidate
python consolidate_products.py

# Step 2: Fetch descriptions
python fetch_full_descriptions.py

# Step 3: Download images
python image_downloader.py --input products_enriched.json

# Step 4: Link images
python link_images_to_products.py

# Step 5: Generate reports
python generate_reports.py --input products_final.json
```

---

## ✅ FINAL CHECKLIST

After completing all steps in VS Code:

- [ ] **products_final.json** created (open it to verify)
- [ ] **products_final.csv** created (spreadsheet format)
- [ ] **images/** folder populated with actual image files
- [ ] **reports/** folder with analytics
- [ ] Can see in VS Code explorer:
  - [ ] products_final.json
  - [ ] images/ folder with subfolders
  - [ ] reports/ folder
- [ ] Opened analytics_report.html in browser - looks good
- [ ] Ready to use your data!

---

## 🎉 YOU'RE DONE!

Your complete product dataset is ready:
- ✅ 1000+ products with names
- ✅ Full descriptions from website
- ✅ Actual downloaded image files
- ✅ All organized in JSON, CSV, and image folders
- ✅ Analytics reports
- ✅ All done in Visual Studio Code!

**Next:** Use `products_final.json` in your application! 🚀

---

## 💡 Pro Tips for VS Code

**1. Multiple Terminals:**
- Click **+** next to terminal name to open another
- Run multiple scripts side-by-side

**2. View Output Live:**
- Terminal shows progress as scripts run
- Scroll up to see all messages

**3. Edit Scripts (Advanced):**
- Click any `.py` file to view it
- If you want to change settings, edit the script
- Press **Ctrl+S** to save

**4. Keyboard Shortcuts:**
- **Ctrl+`** = Open/close terminal
- **Ctrl+Shift+P** = Command palette
- **Ctrl+S** = Save file
- **Ctrl+F** = Find in file

---

**Questions?** Every script has built-in help:
```bash
python consolidate_products.py --help
python fetch_full_descriptions.py --help
python image_downloader.py --help
```

Type the command + `--help` to see options!

**Ready to start? Open VS Code and begin!** 🎯
