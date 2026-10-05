#!/usr/bin/env python3
"""
Consolidate products extracted from individual pages into unified database.

Usage:
    python3 consolidate_products.py --input pages/ --output products.json
    
Or using defaults (looks for products_page_*.json files in current directory):
    python3 consolidate_products.py
"""

import json
import csv
import glob
import os
import argparse
from datetime import datetime
from pathlib import Path

def consolidate_products(input_dir=".", output_file="products.json"):
    """
    Consolidate products from individual page files.
    
    Args:
        input_dir: Directory containing products_page_*.json files
        output_file: Output file for consolidated products
    """
    
    print("=" * 70)
    print("DME Products Consolidation Tool")
    print("=" * 70)
    
    # Find all page files
    pattern = os.path.join(input_dir, "products_page_*.json")
    page_files = sorted(glob.glob(pattern))
    
    if not page_files:
        print(f"❌ No products_page_*.json files found in {input_dir}")
        print("\nExpected file format: products_page_1.json, products_page_2.json, etc.")
        print("\nTo extract pages:")
        print("1. Navigate to https://www.advanceddmesupplies.com/shop/page/X/")
        print("2. Open browser console (F12 → Console tab)")
        print("3. Copy and paste extraction_script.js")
        print("4. Run the script and save output as products_page_X.json")
        return False
    
    print(f"\n📂 Found {len(page_files)} page files:")
    for i, f in enumerate(page_files[:5], 1):
        print(f"   {i}. {os.path.basename(f)}")
    if len(page_files) > 5:
        print(f"   ... and {len(page_files) - 5} more")
    
    all_products = []
    errors = []
    
    print("\n⏳ Processing files...")
    
    for page_file in page_files:
        try:
            with open(page_file, 'r', encoding='utf-8') as f:
                products = json.load(f)
                if isinstance(products, list):
                    page_num = os.path.basename(page_file).split('_')[2].split('.')[0]
                    print(f"   ✓ Page {page_num}: {len(products)} products")
                    all_products.extend(products)
                else:
                    print(f"   ⚠️  {os.path.basename(page_file)}: Invalid format (not a list)")
                    errors.append(f"Invalid format in {os.path.basename(page_file)}")
        except json.JSONDecodeError as e:
            print(f"   ❌ {os.path.basename(page_file)}: Invalid JSON - {e}")
            errors.append(f"JSON error in {os.path.basename(page_file)}: {e}")
        except Exception as e:
            print(f"   ❌ {os.path.basename(page_file)}: {e}")
            errors.append(f"Error reading {os.path.basename(page_file)}: {e}")
    
    print(f"\n📊 Summary:")
    print(f"   Total products: {len(all_products)}")
    print(f"   Total pages: {len(page_files)}")
    if errors:
        print(f"   Errors: {len(errors)}")
    
    # Deduplicate by URL
    seen_urls = set()
    unique_products = []
    duplicates = 0
    
    for product in all_products:
        if product.get('url') not in seen_urls:
            unique_products.append(product)
            seen_urls.add(product.get('url'))
        else:
            duplicates += 1
    
    if duplicates > 0:
        print(f"   Duplicates removed: {duplicates}")
    
    # Save as JSON
    output_dir = os.path.dirname(output_file) or "."
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n💾 Saving consolidated data...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(unique_products, f, indent=2, ensure_ascii=False)
    print(f"   ✓ {output_file} ({len(unique_products)} products)")
    
    # Save as CSV
    csv_file = output_file.replace('.json', '.csv')
    if unique_products:
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['name', 'category', 'description', 'url', 'image_url', 'image_alt']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for product in unique_products:
                writer.writerow({k: product.get(k, '') for k in fieldnames})
        print(f"   ✓ {csv_file} (spreadsheet format)")
    
    # Create metadata
    metadata = {
        "consolidation_date": datetime.now().isoformat(),
        "total_products": len(unique_products),
        "total_pages": len(page_files),
        "duplicates_removed": duplicates,
        "categories": len(set(p.get('category', '') for p in unique_products)),
        "errors": len(errors)
    }
    
    metadata_file = output_file.replace('.json', '_metadata.json')
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"   ✓ {metadata_file} (metadata)")
    
    if errors:
        error_file = output_file.replace('.json', '_errors.log')
        with open(error_file, 'w') as f:
            f.write('\n'.join(errors))
        print(f"   ⚠️  {error_file} ({len(errors)} errors)")
    
    print(f"\n✅ Consolidation complete!")
    print(f"   Output directory: {os.path.abspath(output_dir)}")
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Consolidate DME product extractions into unified database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 consolidate_products.py
  python3 consolidate_products.py --input pages/ --output data/all_products.json
  python3 consolidate_products.py -i ./extractions -o ./output/consolidated.json
        """
    )
    
    parser.add_argument(
        '-i', '--input',
        default='.',
        help='Input directory containing products_page_*.json files (default: current directory)'
    )
    
    parser.add_argument(
        '-o', '--output',
        default='products.json',
        help='Output JSON file (default: products.json)'
    )
    
    args = parser.parse_args()
    
    success = consolidate_products(args.input, args.output)
    exit(0 if success else 1)
