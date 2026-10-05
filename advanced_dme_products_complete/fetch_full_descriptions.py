#!/usr/bin/env python3
"""
Fetch full product descriptions from individual product pages.

This script reads products.json and visits each product URL to extract
the complete description (not the truncated shop listing version).

Usage:
    python3 fetch_full_descriptions.py
    python3 fetch_full_descriptions.py --input products.json --output products_enriched.json
"""

import json
import os
import argparse
import time
from urllib.request import urlopen
from html.parser import HTMLParser
import re

class DescriptionParser(HTMLParser):
    """Extract product description from HTML"""
    def __init__(self):
        super().__init__()
        self.in_description = False
        self.description = ""
        self.capture = False
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        # Look for description section
        if tag == 'div' and attrs_dict.get('class', '').find('description') > -1:
            self.capture = True
        if tag == 'p' and self.capture:
            self.in_description = True
            
    def handle_endtag(self, tag):
        if tag == 'p' and self.in_description:
            self.in_description = False
        if tag == 'div' and self.capture:
            self.capture = False
            
    def handle_data(self, data):
        if self.in_description:
            text = data.strip()
            if text:
                self.description += text + " "

def fetch_description(url):
    """Fetch product description from individual product page"""
    try:
        # Add timeout and user agent
        import urllib.request
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
        
        # Extract description using regex (more reliable than parser)
        # Look for text after "DESCRIPTION" heading or in description div
        patterns = [
            r'<h2[^>]*>\s*DESCRIPTION\s*</h2>\s*<p[^>]*>([^<]+)</p>',
            r'<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)',
            r'<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)</p>',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            if match:
                desc = match.group(1).strip()
                # Clean up HTML entities and extra whitespace
                desc = desc.replace('&nbsp;', ' ').replace('&amp;', '&').replace('\n', ' ')
                desc = ' '.join(desc.split())  # Remove extra spaces
                return desc[:500]  # Max 500 chars
        
        # Fallback: Try to find any paragraph after title
        match = re.search(r'<h1[^>]*>.*?</h1>(.*?)<', html)
        if match:
            desc = match.group(1).strip()
            desc = re.sub(r'<[^>]+>', '', desc)  # Remove HTML tags
            desc = ' '.join(desc.split())
            return desc[:500]
        
        return ""
    except Exception as e:
        print(f"    Error fetching {url}: {e}")
        return ""

def enrich_products(input_file="products.json", output_file="products_enriched.json"):
    """
    Read products.json and enrich with full descriptions from product pages
    """
    
    print("=" * 70)
    print("DME Product Description Enrichment Tool")
    print("=" * 70)
    
    # Load products
    if not os.path.exists(input_file):
        print(f"❌ File not found: {input_file}")
        return False
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            products = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        return False
    
    if not isinstance(products, list):
        print(f"❌ Expected list, got {type(products)}")
        return False
    
    print(f"\n📦 Loaded {len(products)} products")
    print(f"⏳ Fetching descriptions from product pages...")
    print(f"   (This may take 5-15 minutes for all 88 pages)\n")
    
    enriched = []
    success_count = 0
    
    for i, product in enumerate(products, 1):
        if not product.get('url'):
            enriched.append(product)
            continue
        
        url = product['url']
        
        # Fetch description
        description = fetch_description(url)
        
        # Create enriched product with full description
        enriched_product = product.copy()
        if description:
            enriched_product['full_description'] = description
            success_count += 1
            status = "✓"
        else:
            enriched_product['full_description'] = product.get('description', '')
            status = "⚠"
        
        enriched.append(enriched_product)
        
        # Progress indicator
        if i % 5 == 0:
            print(f"   {status} Processed {i}/{len(products)} products ({success_count} with descriptions)")
        
        # Rate limiting - be nice to the server
        time.sleep(0.5)
    
    print(f"\n📊 Results:")
    print(f"   ✓ Products enriched: {success_count}/{len(products)}")
    print(f"   ⚠ Missing descriptions: {len(products) - success_count}")
    
    # Save enriched products
    print(f"\n💾 Saving enriched data...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enriched, f, indent=2, ensure_ascii=False)
    print(f"   ✓ {output_file}")
    
    # Also create updated products_detailed.json
    detailed_output = input_file.replace('.json', '_detailed.json')
    # Create CSV with full descriptions
    import csv
    csv_output = input_file.replace('.json', '_detailed.csv')
    
    with open(csv_output, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['name', 'category', 'url', 'full_description', 'image_url']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for product in enriched:
            writer.writerow({
                'name': product.get('name', ''),
                'category': product.get('category', ''),
                'url': product.get('url', ''),
                'full_description': product.get('full_description', ''),
                'image_url': product.get('image_url', '')
            })
    print(f"   ✓ {csv_output} (with full descriptions)")
    
    print(f"\n✅ Enrichment complete!")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Enrich products with full descriptions from product pages",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 fetch_full_descriptions.py
  python3 fetch_full_descriptions.py --input products.json --output enriched.json
        """
    )
    
    parser.add_argument(
        '-i', '--input',
        default='products.json',
        help='Input JSON file (default: products.json)'
    )
    
    parser.add_argument(
        '-o', '--output',
        default='products_enriched.json',
        help='Output JSON file (default: products_enriched.json)'
    )
    
    args = parser.parse_args()
    
    try:
        success = enrich_products(args.input, args.output)
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user")
        exit(1)
