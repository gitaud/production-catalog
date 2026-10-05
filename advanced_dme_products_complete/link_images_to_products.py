#!/usr/bin/env python3
"""
Link downloaded image files to product data.

This script matches downloaded images to products and creates final JSON
with ACTUAL IMAGE FILES (not URLs).

Usage:
    python3 link_images_to_products.py
    python3 link_images_to_products.py --products products_enriched.json --images images/
"""

import json
import os
import csv
from pathlib import Path
import argparse
from urllib.parse import urlparse

def find_image_for_product(product, images_dir):
    """Find the image file for a product"""
    product_name = product.get('name', '').lower().replace(' ', '-')
    category = product.get('category', '').replace('/', '_').replace('\\', '_')
    
    # Expected image directory for this category
    category_dir = os.path.join(images_dir, category)
    
    if not os.path.exists(category_dir):
        return None
    
    # List all images in this category
    try:
        images = os.listdir(category_dir)
    except:
        return None
    
    if not images:
        return None
    
    # Return the first image found (or try to match by name)
    for img in images:
        if img.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
            return os.path.join(category_dir, img)
    
    return None

def link_images_to_products(products_file="products_enriched.json", 
                            images_dir="images",
                            output_file="products_final.json"):
    """
    Link downloaded images to products.
    """
    
    print("=" * 70)
    print("DME Image-Product Linking Tool")
    print("=" * 70)
    
    # Load products
    if not os.path.exists(products_file):
        print(f"❌ File not found: {products_file}")
        print(f"   Please run: python3 consolidate_products.py")
        print(f"   Then run: python3 fetch_full_descriptions.py")
        return False
    
    try:
        with open(products_file, 'r', encoding='utf-8') as f:
            products = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        return False
    
    if not isinstance(products, list):
        print(f"❌ Expected list, got {type(products)}")
        return False
    
    print(f"\n📦 Loaded {len(products)} products")
    
    # Check images directory
    if not os.path.exists(images_dir):
        print(f"⚠️  Images directory not found: {images_dir}")
        print(f"   Run: python3 image_downloader.py")
        print(f"   First to download images")
        return False
    
    print(f"📁 Images directory: {os.path.abspath(images_dir)}")
    
    # Count total images
    total_images = 0
    for root, dirs, files in os.walk(images_dir):
        for f in files:
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                total_images += 1
    
    print(f"🖼️  Total image files: {total_images}")
    
    # Link images to products
    print(f"\n🔗 Linking images to products...")
    
    final_products = []
    linked_count = 0
    
    for i, product in enumerate(products, 1):
        # Find image file
        image_file = find_image_for_product(product, images_dir)
        
        final_product = product.copy()
        
        if image_file:
            # Store relative path for portability
            rel_path = os.path.relpath(image_file, '.')
            final_product['image_file'] = rel_path  # Actual file, not URL!
            final_product['image_filename'] = os.path.basename(image_file)
            linked_count += 1
            status = "✓"
        else:
            status = "⚠"
            if 'image_file' not in final_product:
                final_product['image_file'] = None
        
        # Remove image_url (we have actual file now)
        final_product.pop('image_url', None)
        
        final_products.append(final_product)
        
        if i % 10 == 0:
            print(f"   {status} Processed {i}/{len(products)} ({linked_count} with images)")
    
    print(f"\n📊 Results:")
    print(f"   ✓ Products with images: {linked_count}/{len(products)}")
    print(f"   ⚠ Without images: {len(products) - linked_count}")
    
    # Save final products
    print(f"\n💾 Saving final product data...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_products, f, indent=2, ensure_ascii=False)
    print(f"   ✓ {output_file}")
    
    # Create CSV with image files
    csv_file = output_file.replace('.json', '.csv')
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['name', 'category', 'full_description', 'image_file', 'image_filename', 'url']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for product in final_products:
            writer.writerow({
                'name': product.get('name', ''),
                'category': product.get('category', ''),
                'full_description': product.get('full_description', ''),
                'image_file': product.get('image_file', ''),
                'image_filename': product.get('image_filename', ''),
                'url': product.get('url', '')
            })
    print(f"   ✓ {csv_file} (spreadsheet with actual image paths)")
    
    # Create sample showing structure
    print(f"\n📋 Sample product from output:")
    if final_products:
        sample = final_products[0]
        print(f"""
   {{
     "name": "{sample.get('name', '')}",
     "category": "{sample.get('category', '')}",
     "full_description": "{sample.get('full_description', '')[:80]}...",
     "image_file": "{sample.get('image_file', 'N/A')}",  ← ACTUAL FILE!
     "url": "{sample.get('url', '')}"
   }}
""")
    
    print(f"✅ Linking complete!")
    print(f"\n📂 Final structure:")
    print(f"   products_final.json          ← All products with ACTUAL image files")
    print(f"   products_final.csv           ← Spreadsheet format")
    print(f"   images/                      ← Actual image files organized by category")
    print(f"   ├── ALUMINUM QUAD CANES/")
    print(f"   │   ├── image1.jpg")
    print(f"   │   └── image2.jpg")
    print(f"   └── ... (other categories)")
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Link downloaded image files to products",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 link_images_to_products.py
  python3 link_images_to_products.py --products products_enriched.json --images images/
        """
    )
    
    parser.add_argument(
        '--products',
        default='products_enriched.json',
        help='Input products JSON file (default: products_enriched.json)'
    )
    
    parser.add_argument(
        '--images',
        default='images',
        help='Images directory (default: images/)'
    )
    
    parser.add_argument(
        '-o', '--output',
        default='products_final.json',
        help='Output JSON file with linked images (default: products_final.json)'
    )
    
    args = parser.parse_args()
    
    try:
        success = link_images_to_products(args.products, args.images, args.output)
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user")
        exit(1)
