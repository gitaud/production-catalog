// Advanced DME Supplies Product Extraction Script
// Run this in the browser console (F12) to extract products from any shop page

(function() {
  'use strict';
  
  const config = {
    baseUrl: 'https://www.advanceddmesupplies.com/shop/',
    productSelector: 'a.woocommerce-LoopProduct-link'
  };
  
  function extractProducts() {
    const products = [];
    const links = document.querySelectorAll(config.productSelector);
    
    console.log(`\n📦 Extracting ${links.length} products...`);
    
    links.forEach((link, idx) => {
      const container = link.closest('li.product') || link.parentElement;
      const product = {};
      
      // Name
      const titleElem = container.querySelector('h2');
      product.name = titleElem ? titleElem.textContent.trim() : link.textContent.trim();
      
      // URL
      product.url = link.href;
      
      // Category
      const catElem = container.querySelector('a[rel="tag"]');
      if (catElem) product.category = catElem.textContent.trim();
      
      // Image
      const img = container.querySelector('img');
      if (img) {
        product.image_url = img.src || img.dataset.src;
        product.image_alt = img.alt;
      }
      
      // Description
      const desc = container.querySelector('.woo-loop-product__short-description');
      if (desc) product.description = desc.textContent.trim();
      
      if (product.name) products.push(product);
    });
    
    return products;
  }
  
  const result = extractProducts();
  
  console.log(`✓ Extracted ${result.length} products`);
  console.log('\n📋 JSON Output:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(result, null, 2));
  console.log('='.repeat(60));
  
  // Copy to clipboard
  const json = JSON.stringify(result, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    console.log('\n✅ JSON copied to clipboard!');
  }).catch(err => {
    console.log('\n⚠️  Could not copy to clipboard. Select and copy manually.');
  });
  
  return result;
})();
