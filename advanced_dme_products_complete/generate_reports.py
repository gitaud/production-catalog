#!/usr/bin/env python3
"""
Generate analytics and reports from DME product data.

Usage:
    python3 generate_reports.py --input products.json --output reports/
    
Or using defaults:
    python3 generate_reports.py
"""

import json
import csv
import os
import argparse
from datetime import datetime
from collections import defaultdict, Counter

def generate_reports(input_file="products.json", output_dir="reports"):
    """
    Generate various reports from product data.
    
    Args:
        input_file: JSON file with product data
        output_dir: Output directory for reports
    """
    
    print("=" * 70)
    print("DME Analytics Report Generator")
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
    
    print(f"\n📊 Analyzing {len(products)} products...")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Analysis
    categories = Counter()
    products_by_category = defaultdict(list)
    products_with_images = 0
    products_with_descriptions = 0
    
    for product in products:
        category = product.get('category', 'Uncategorized')
        categories[category] += 1
        products_by_category[category].append(product)
        
        if product.get('image_url'):
            products_with_images += 1
        if product.get('description'):
            products_with_descriptions += 1
    
    # Generate category report
    print(f"\n📁 Generating category report...")
    category_file = os.path.join(output_dir, "categories_report.csv")
    with open(category_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Category', 'Product Count', 'With Images', 'With Descriptions'])
        
        for category in sorted(categories.keys()):
            products_list = products_by_category[category]
            with_images = sum(1 for p in products_list if p.get('image_url'))
            with_desc = sum(1 for p in products_list if p.get('description'))
            writer.writerow([category, len(products_list), with_images, with_desc])
    
    print(f"   ✓ {category_file}")
    
    # Generate summary report
    print(f"\n📈 Generating summary report...")
    summary_file = os.path.join(output_dir, "summary_report.txt")
    
    summary_text = f"""
DME PRODUCTS ANALYSIS REPORT
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

OVERVIEW
{'='*70}
Total Products:                    {len(products):,}
Total Categories:                  {len(categories)}
Products with Images:              {products_with_images} ({products_with_images*100//len(products)}%)
Products with Descriptions:        {products_with_descriptions} ({products_with_descriptions*100//len(products)}%)

TOP 10 CATEGORIES
{'='*70}
"""
    
    for i, (category, count) in enumerate(categories.most_common(10), 1):
        summary_text += f"{i:2d}. {category:<40} {count:>5} products\n"
    
    summary_text += f"""

DATA QUALITY METRICS
{'='*70}
Complete records (name + URL):      {sum(1 for p in products if p.get('name') and p.get('url'))} ({sum(1 for p in products if p.get('name') and p.get('url'))*100//len(products)}%)
Records with image URLs:           {products_with_images} ({products_with_images*100//len(products)}%)
Records with descriptions:         {products_with_descriptions} ({products_with_descriptions*100//len(products)}%)

MISSING DATA
{'='*70}
Missing category:                  {sum(1 for p in products if not p.get('category'))} ({sum(1 for p in products if not p.get('category'))*100//len(products)}%)
Missing image URL:                 {len(products) - products_with_images} ({(len(products) - products_with_images)*100//len(products)}%)
Missing description:               {len(products) - products_with_descriptions} ({(len(products) - products_with_descriptions)*100//len(products)}%)

FILE INFORMATION
{'='*70}
Source File:                       {input_file}
Report Generated:                  {datetime.now().isoformat()}
Total Report Size:                 {sum(1 for p in products)} records
"""
    
    with open(summary_file, 'w') as f:
        f.write(summary_text)
    
    print(f"   ✓ {summary_file}")
    
    # Generate HTML report
    print(f"\n📄 Generating HTML report...")
    html_file = os.path.join(output_dir, "analytics_report.html")
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DME Products Analytics Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #d4534f; border-bottom: 3px solid #d4534f; padding-bottom: 10px; }}
        h2 {{ color: #333; margin-top: 30px; }}
        .metric {{ display: inline-block; background: #f9f9f9; padding: 15px 20px; margin: 10px; border-left: 4px solid #d4534f; border-radius: 4px; }}
        .metric-value {{ font-size: 24px; font-weight: bold; color: #d4534f; }}
        .metric-label {{ font-size: 12px; color: #666; margin-top: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th {{ background: #d4534f; color: white; padding: 12px; text-align: left; }}
        td {{ padding: 10px; border-bottom: 1px solid #eee; }}
        tr:hover {{ background: #f9f9f9; }}
        .stat-row {{ padding: 10px; background: #f9f9f9; margin: 5px 0; border-radius: 4px; }}
        .good {{ color: #27ae60; }}
        .warning {{ color: #f39c12; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🏥 DME Products Analytics Report</h1>
        
        <h2>Executive Summary</h2>
        <div class="metric">
            <div class="metric-value">{len(products):,}</div>
            <div class="metric-label">Total Products</div>
        </div>
        <div class="metric">
            <div class="metric-value">{len(categories)}</div>
            <div class="metric-label">Categories</div>
        </div>
        <div class="metric">
            <div class="metric-value">{products_with_images*100//len(products)}%</div>
            <div class="metric-label">Products with Images</div>
        </div>
        <div class="metric">
            <div class="metric-value">{products_with_descriptions*100//len(products)}%</div>
            <div class="metric-label">Products with Descriptions</div>
        </div>
        
        <h2>Top Categories</h2>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Products</th>
                    <th>With Images</th>
                    <th>With Descriptions</th>
                </tr>
            </thead>
            <tbody>
"""
    
    for category, count in categories.most_common(15):
        products_list = products_by_category[category]
        with_images = sum(1 for p in products_list if p.get('image_url'))
        with_desc = sum(1 for p in products_list if p.get('description'))
        html_content += f"""                <tr>
                    <td>{category}</td>
                    <td>{count}</td>
                    <td>{with_images} ({with_images*100//count}%)</td>
                    <td>{with_desc} ({with_desc*100//count}%)</td>
                </tr>
"""
    
    html_content += """            </tbody>
        </table>
        
        <h2>Data Quality</h2>
        <div class="stat-row">
            <strong class="good">✓ Complete Records:</strong> """ + str(sum(1 for p in products if p.get('name') and p.get('url'))) + f""" ({sum(1 for p in products if p.get('name') and p.get('url'))*100//len(products)}%)
        </div>
        <div class="stat-row">
            <strong class="good">✓ With Images:</strong> {products_with_images} ({products_with_images*100//len(products)}%)
        </div>
        <div class="stat-row">
            <strong class="good">✓ With Descriptions:</strong> {products_with_descriptions} ({products_with_descriptions*100//len(products)}%)
        </div>
        
        <div class="footer">
            Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br>
            Source: {input_file}<br>
            Advanced DME Supplies Analytics Tool v1.0
        </div>
    </div>
</body>
</html>
"""
    
    with open(html_file, 'w') as f:
        f.write(html_content)
    
    print(f"   ✓ {html_file}")
    
    # Print summary
    print(f"\n{'='*70}")
    print(f"ANALYSIS COMPLETE")
    print(f"{'='*70}")
    print(f"✓ Total products analyzed: {len(products):,}")
    print(f"✓ Categories: {len(categories)}")
    print(f"✓ Data quality: {products_with_images*100//len(products)}% with images, {products_with_descriptions*100//len(products)}% with descriptions")
    print(f"\n📂 Reports saved to: {os.path.abspath(output_dir)}")
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate analytics reports from DME product data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 generate_reports.py
  python3 generate_reports.py --input products.json --output reports/
  python3 generate_reports.py -i all_products.json -o ./analytics
        """
    )
    
    parser.add_argument(
        '-i', '--input',
        default='products.json',
        help='Input JSON file with product data (default: products.json)'
    )
    
    parser.add_argument(
        '-o', '--output',
        default='reports',
        help='Output directory for reports (default: reports/)'
    )
    
    args = parser.parse_args()
    
    success = generate_reports(args.input, args.output)
    exit(0 if success else 1)
