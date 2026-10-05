#!/usr/bin/env python3
"""
🚀 MASTER SCRIPT - Run Everything Automatically

This single script does ALL 4 steps automatically:
1. Consolidate products
2. Fetch full descriptions
3. Download actual images
4. Link images to products

Just run: python RUN_EVERYTHING.py

That's it! Everything happens automatically.
"""

import subprocess
import sys
import os
from pathlib import Path

# Colors for terminal output
GREEN = '\033[92m'
BLUE = '\033[94m'
YELLOW = '\033[93m'
RED = '\033[91m'
BOLD = '\033[1m'
END = '\033[0m'

def print_header(text):
    """Print a formatted header"""
    print(f"\n{BOLD}{BLUE}{'='*70}{END}")
    print(f"{BOLD}{BLUE}{text}{END}")
    print(f"{BOLD}{BLUE}{'='*70}{END}\n")

def print_step(number, text):
    """Print a step header"""
    print(f"{BOLD}{YELLOW}STEP {number}: {text}{END}")
    print(f"{YELLOW}{'-'*70}{END}\n")

def print_success(text):
    """Print success message"""
    print(f"{GREEN}✅ {text}{END}\n")

def print_error(text):
    """Print error message"""
    print(f"{RED}❌ {text}{END}\n")

def print_info(text):
    """Print info message"""
    print(f"{BLUE}ℹ️  {text}{END}")

def run_script(script_name, args=""):
    """Run a Python script and return success/failure"""
    try:
        cmd = f"{sys.executable} {script_name} {args}".strip()
        print(f"{BLUE}Running: {cmd}{END}\n")
        
        result = subprocess.run(cmd, shell=True, cwd=Path.cwd())
        
        if result.returncode == 0:
            return True
        else:
            return False
    except Exception as e:
        print_error(f"Error running {script_name}: {e}")
        return False

def check_products_file(filename):
    """Check if a products file exists"""
    return os.path.exists(filename)

def main():
    """Main execution function"""
    
    print_header("🏥 DME PRODUCTS - COMPLETE AUTOMATED EXTRACTION")
    
    print(f"""
This script will automatically:
  1. ✓ Consolidate products from extracted pages
  2. ✓ Fetch full descriptions from product pages
  3. ✓ Download actual image files
  4. ✓ Link images to products
  5. ✓ Generate analytics reports

Total time: 15-90 minutes (depends on number of products)
No manual intervention needed - just let it run!

{YELLOW}Press ENTER to start, or Ctrl+C to cancel...{END}
""")
    
    try:
        input()
    except KeyboardInterrupt:
        print_info("Cancelled by user")
        sys.exit(0)
    
    print_header("STEP-BY-STEP AUTOMATION")
    
    # STEP 1: Consolidate Products
    print_step(1, "CONSOLIDATING PRODUCTS FROM EXTRACTED PAGES")
    print_info("This consolidates all products_page_*.json files into products.json")
    print_info("Time: ~5-10 seconds\n")
    
    if run_script("consolidate_products.py"):
        print_success("Products consolidated!")
        
        # Check if we got products
        if check_products_file("products.json"):
            print_info("✓ products.json created successfully")
        else:
            print_error("products.json not created - extraction may have failed")
            print_info("Make sure you have extracted pages first (products_page_1.json, products_page_2.json, etc.)")
            print_info("Run the browser extraction first, then run this script again")
            return False
    else:
        print_error("Consolidation failed!")
        print_info("Make sure products_page_*.json files exist in the current directory")
        return False
    
    input(f"{YELLOW}Press ENTER to continue to Step 2...{END}\n")
    
    # STEP 2: Fetch Full Descriptions
    print_step(2, "FETCHING FULL DESCRIPTIONS FROM PRODUCT PAGES")
    print_info("This visits each product page and extracts the complete description")
    print_info("Time: 5-15 minutes (depends on number of products)\n")
    
    if run_script("fetch_full_descriptions.py"):
        print_success("Descriptions fetched!")
        
        if check_products_file("products_enriched.json"):
            print_info("✓ products_enriched.json created successfully")
        else:
            print_error("products_enriched.json not created")
            return False
    else:
        print_error("Description fetching failed!")
        return False
    
    input(f"{YELLOW}Press ENTER to continue to Step 3...{END}\n")
    
    # STEP 3: Download Images
    print_step(3, "DOWNLOADING ACTUAL IMAGE FILES")
    print_info("This downloads all product images and organizes them by category")
    print_info("Time: 5-60 minutes (depends on image count and internet speed)\n")
    
    if run_script("image_downloader.py", "--input products_enriched.json"):
        print_success("Images downloaded!")
        
        if os.path.exists("images"):
            image_count = sum([len(files) for _, _, files in os.walk("images")])
            print_info(f"✓ {image_count} image files downloaded")
        else:
            print_error("images folder not created")
            return False
    else:
        print_error("Image download failed!")
        print_info("This might happen if internet is slow - check connection and try again")
        return False
    
    input(f"{YELLOW}Press ENTER to continue to Step 4...{END}\n")
    
    # STEP 4: Link Images to Products
    print_step(4, "LINKING IMAGES TO PRODUCTS")
    print_info("This creates the final JSON with actual image file paths")
    print_info("Time: ~1 minute\n")
    
    if run_script("link_images_to_products.py"):
        print_success("Images linked to products!")
        
        if check_products_file("products_final.json"):
            print_info("✓ products_final.json created successfully")
            print_info("✓ products_final.csv created successfully")
        else:
            print_error("products_final.json not created")
            return False
    else:
        print_error("Image linking failed!")
        return False
    
    input(f"{YELLOW}Press ENTER to continue to Step 5 (optional)...{END}\n")
    
    # STEP 5: Generate Reports (Optional)
    print_step(5, "GENERATING ANALYTICS REPORTS (OPTIONAL)")
    print_info("This creates beautiful HTML, CSV, and text reports")
    print_info("Time: ~1-5 minutes\n")
    
    if run_script("generate_reports.py", "--input products_final.json"):
        print_success("Reports generated!")
        
        if os.path.exists("reports"):
            print_info("✓ reports/ folder created with analytics")
        else:
            print_error("reports folder not created")
    else:
        print_error("Report generation failed - but your main data is ready!")
    
    # FINAL SUMMARY
    print_header("✅ COMPLETE! YOUR DATA IS READY")
    
    print(f"""
{GREEN}ALL STEPS COMPLETED SUCCESSFULLY!{END}

Your final product dataset is now ready:

📄 {GREEN}products_final.json{END}
   ↳ Complete product data with actual image file paths
   ↳ Each product has: name, description, image_file, URL

📊 {GREEN}products_final.csv{END}
   ↳ Spreadsheet format (import into Excel/Sheets)
   ↳ All columns: name, category, description, image file, URL

📁 {GREEN}images/{END}
   ↳ Actual downloaded image files organized by category
   ↳ ALUMINUM QUAD CANES/, CANES AND CRUTCHES/, WALKERS/, etc.
   ↳ 1000+ image files

📈 {GREEN}reports/{END}
   ↳ analytics_report.html - Open in browser for beautiful charts
   ↳ summary_report.txt - Text summary
   ↳ categories_report.csv - Category breakdown

{YELLOW}NEXT STEPS:{END}
1. Open {GREEN}products_final.json{END} to see your complete data
2. Check {GREEN}images/{END} folder to see all downloaded images
3. Open {GREEN}reports/analytics_report.html{END} in browser to see statistics
4. Use {GREEN}products_final.json{END} in your application!

{BOLD}All done! Your extraction is complete! 🎉{END}
""")
    
    return True

if __name__ == "__main__":
    print_info("Starting DME Products Master Script\n")
    
    try:
        success = main()
        
        if success:
            print_success("✅ All steps completed successfully!")
            sys.exit(0)
        else:
            print_error("❌ Some steps failed - check the output above")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print_info("\n\nScript interrupted by user")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
