#!/usr/bin/env python3
"""
Batch download product images from DME product data.

Usage:
    python3 image_downloader.py --input products.json --output images/
    
Or using defaults:
    python3 image_downloader.py
"""

import json
import os
import argparse
import time
import requests
from urllib.parse import urlparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

def download_image(url, output_path, timeout=10):
    """Download a single image."""
    try:
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return True, os.path.getsize(output_path)
    except Exception as e:
        return False, str(e)

def get_filename_from_url(url):
    """Extract filename from URL."""
    parsed = urlparse(url)
    filename = os.path.basename(parsed.path)
    if not filename or '.' not in filename:
        filename = f"image_{hash(url) % 10000}.jpg"
    return filename

def download_images(input_file="products.json", output_dir="images", max_workers=4):
    """
    Download product images.
    
    Args:
        input_file: JSON file with product data
        output_dir: Output directory for images
        max_workers: Number of concurrent downloads
    """
    
    print("=" * 70)
    print("DME Image Downloader")
    print("=" * 70)
    
    # Load products
    if not os.path.exists(input_file):
        print(f"❌ File not found: {input_file}")
        return False
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            products = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {input_file}: {e}")
        return False
    
    if not isinstance(products, list):
        print(f"❌ Expected list of products, got {type(products)}")
        return False
    
    print(f"\n📦 Loaded {len(products)} products from {input_file}")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Filter products with images
    products_with_images = [p for p in products if p.get('image_url')]
    print(f"📷 Found {len(products_with_images)} products with images")
    
    if not products_with_images:
        print("⚠️  No images to download")
        return True
    
    # Organize by category
    by_category = {}
    for product in products_with_images:
        category = product.get('category', 'uncategorized')
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(product)
    
    print(f"📂 Organizing {len(by_category)} categories:")
    for cat in sorted(by_category.keys())[:5]:
        print(f"   • {cat}: {len(by_category[cat])} images")
    if len(by_category) > 5:
        print(f"   ... and {len(by_category) - 5} more")
    
    # Download images
    print(f"\n⏳ Downloading images (max {max_workers} concurrent)...")
    
    downloaded = 0
    failed = 0
    total_size = 0
    errors = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        
        for product in products_with_images:
            image_url = product.get('image_url')
            category = product.get('category', 'uncategorized')
            
            # Create category subdirectory
            category_dir = os.path.join(output_dir, category.replace('/', '_').replace('\\', '_'))
            os.makedirs(category_dir, exist_ok=True)
            
            # Get filename
            filename = get_filename_from_url(image_url)
            output_path = os.path.join(category_dir, filename)
            
            # Skip if already exists
            if os.path.exists(output_path):
                downloaded += 1
                total_size += os.path.getsize(output_path)
                continue
            
            # Submit download task
            future = executor.submit(download_image, image_url, output_path)
            futures[future] = (image_url, output_path, product.get('name'))
        
        # Wait for downloads
        for i, future in enumerate(as_completed(futures), 1):
            url, path, name = futures[future]
            try:
                success, result = future.result()
                if success:
                    downloaded += 1
                    total_size += result
                    if i % 10 == 0:
                        print(f"   ✓ Downloaded {i}/{len(products_with_images)}")
                else:
                    failed += 1
                    errors.append(f"Failed: {name} - {result}")
            except Exception as e:
                failed += 1
                errors.append(f"Error downloading {name}: {e}")
    
    # Summary
    print(f"\n📊 Download Summary:")
    print(f"   ✓ Successfully downloaded: {downloaded}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📊 Total size: {total_size / (1024*1024):.2f} MB")
    
    if errors:
        error_file = input_file.replace('.json', '_download_errors.log')
        with open(error_file, 'w') as f:
            f.write('\n'.join(errors))
        print(f"   ⚠️  {error_file} ({len(errors)} errors)")
    
    print(f"\n💾 Images saved to: {os.path.abspath(output_dir)}")
    print(f"✅ Download complete!")
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download product images from DME product data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 image_downloader.py
  python3 image_downloader.py --input products.json --output images/
  python3 image_downloader.py -i all_products.json -o ./product_images -w 8
        """
    )
    
    parser.add_argument(
        '-i', '--input',
        default='products.json',
        help='Input JSON file with product data (default: products.json)'
    )
    
    parser.add_argument(
        '-o', '--output',
        default='images',
        help='Output directory for images (default: images/)'
    )
    
    parser.add_argument(
        '-w', '--workers',
        type=int,
        default=4,
        help='Number of concurrent downloads (default: 4)'
    )
    
    args = parser.parse_args()
    
    try:
        success = download_images(args.input, args.output, args.workers)
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Download interrupted by user")
        exit(1)
