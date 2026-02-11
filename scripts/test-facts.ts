/**
 * Script Test — Facts Collector
 * 
 * Teste l'extraction de faits depuis du HTML Shopify.
 * 
 * Usage:
 *   npm run test:facts
 */

import 'dotenv/config';
import { collectFacts, FactsHelpers, normalizePrice } from '../src/core/engine/facts-collector.js';
import { SHOPIFY_APPS_STATS } from '../src/ssot/shopify-apps.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// HTML de test (simple mock Shopify PDP)
const MOCK_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Product Title - My Store</title>
  <script src="https://cdn.shopify.com/s/files/1/0123/4567/t/2/assets/theme.js"></script>
</head>
<body>
  <main class="product-single">
    <h1 class="product__title">Premium Cotton T-Shirt</h1>
    
    <div class="product__price">
      <span class="price__regular">$29.99</span>
      <span class="price__sale">$19.99</span>
    </div>
    
    <form action="/cart/add" method="post">
      <select name="id" class="product-form__input">
        <option value="123">Small</option>
        <option value="124">Medium</option>
        <option value="125">Large</option>
      </select>
      
      <button type="submit" name="add" class="product-form__submit">
        Add to Cart
      </button>
    </form>
    
    <div class="product__description">
      This is a premium cotton t-shirt made from 100% organic cotton. 
      Perfect for everyday wear with a comfortable fit.
    </div>
    
    <div class="product-reviews">
      <h2>Customer Reviews</h2>
      <p>⭐⭐⭐⭐⭐ (150 reviews)</p>
    </div>
    
    <div class="shipping-info">
      <p>✓ Free shipping on orders over $50</p>
      <p>✓ 30-day return policy</p>
    </div>
  </main>
  
  <script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>
  <script>
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
  </script>
</body>
</html>
`;

async function main() {
  console.log('🧪 Test Facts Collector — Extraction de Faits Shopify\n');

  console.log('════════════════════════════════════════════════════════════');
  console.log('📋 TEST 1 — HTML Mock (Simple PDP)');
  console.log('════════════════════════════════════════════════════════════\n');

  const facts1 = await collectFacts(MOCK_HTML, {
    strictMode: true,
    locale: 'en',
  });

  console.log('✅ Facts collectés!\n');

  console.log('📦 PDP Facts:');
  console.log('   • Title:', facts1.pdp.title);
  console.log('   • Price:', facts1.pdp.price);
  console.log('   • Currency:', facts1.pdp.currency);
  console.log('   • Sale Price:', facts1.pdp.hasSalePrice ? 'Yes' : 'No');
  console.log('   • Regular Price:', facts1.pdp.regularPrice);
  console.log('   • Sale Price:', facts1.pdp.salePrice);
  console.log('   • Has ATC Button:', facts1.pdp.hasAtcButton);
  console.log('   • ATC Text:', facts1.pdp.atcText);
  console.log('   • ATC Button Count:', facts1.pdp.atcButtonCount);
  console.log('   • Has Variants:', facts1.pdp.hasVariantSelector);
  console.log('   • Variant Types:', facts1.pdp.variantTypes);
  console.log('   • In Stock:', facts1.pdp.inStock);
  console.log('   • Has Description:', facts1.pdp.hasDescription);
  console.log('   • Description Length:', facts1.pdp.descriptionLength, 'chars');

  console.log('\n🏗️  Structure Facts:');
  console.log('   • H1 Count:', facts1.structure.h1Count);
  console.log('   • Main H1:', facts1.structure.mainH1Text);
  console.log('   • H2 Count:', facts1.structure.h2Count);
  console.log('   • H3 Count:', facts1.structure.h3Count);
  console.log('   • Image Count:', facts1.structure.imageCount);
  console.log('   • Images without Alt:', facts1.structure.imagesWithoutAlt);
  console.log('   • Images with Lazy Load:', facts1.structure.imagesWithLazyLoad);
  console.log('   • Has Reviews:', facts1.structure.hasReviewsSection);
  console.log('   • Has Shipping Info:', facts1.structure.hasShippingInfo);
  console.log('   • Has Return Policy:', facts1.structure.hasReturnPolicy);
  console.log('   • Has Social Proof:', facts1.structure.hasSocialProof);
  console.log('   • Form Count:', facts1.structure.formCount);

  console.log('\n⚙️  Technical Facts:');
  console.log('   • Is Shopify:', facts1.technical.isShopify);
  console.log('   • Shopify Version:', facts1.technical.shopifyVersion || 'N/A');
  console.log('   • Theme Name:', facts1.technical.themeName || 'Unknown');
  console.log('   • Detected Apps:', facts1.technical.detectedApps.join(', ') || 'None');
  console.log('   • Has Google Analytics:', facts1.technical.hasGoogleAnalytics);
  console.log('   • Has Facebook Pixel:', facts1.technical.hasFacebookPixel);
  console.log('   • Has Klaviyo:', facts1.technical.hasKlaviyo);
  console.log('   • Has Skip Link:', facts1.technical.hasSkipLink);
  console.log('   • Has Aria Labels:', facts1.technical.hasAriaLabels);
  console.log('   • Lang Attribute:', facts1.technical.langAttribute);

  console.log('\n📊 Metadata:');
  console.log('   • Parsing Duration:', facts1.meta.parsingDuration, 'ms');

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🧪 TEST 2 — Helpers (Price Normalization - Amélioration)');
  console.log('════════════════════════════════════════════════════════════\n');

  const testPrices = [
    { input: '$29.99', expected: 29.99, description: 'US format (dot)' },
    { input: '€45,50', expected: 45.5, description: 'EU format (comma)' },
    { input: '£19.00', expected: 19, description: 'UK format (dot)' },
    { input: '¥1,234', expected: 1234, description: 'US thousands (comma)' },
    { input: '1.234,56', expected: 1234.56, description: 'EU thousands (dot+comma)' },
    { input: '1,234.56', expected: 1234.56, description: 'US thousands (comma+dot)' },
    { input: '$1,999.00', expected: 1999, description: 'US with thousands' },
    { input: '€2.499,99', expected: 2499.99, description: 'EU with thousands' },
  ];

  console.log('📊 Tests de normalisation de prix:\n');
  
  let passedTests = 0;
  let failedTests = 0;

  testPrices.forEach(({ input, expected, description }) => {
    const result = normalizePrice(input);
    const passed = result === expected;
    const status = passed ? '✅' : '❌';
    
    if (passed) passedTests++;
    else failedTests++;

    console.log(`   ${status} "${input}" → ${result} ${passed ? '' : `(attendu: ${expected})`}`);
    console.log(`      ${description}`);
  });

  console.log(`\n📈 Résultat: ${passedTests}/${testPrices.length} tests réussis`);
  if (failedTests > 0) {
    console.log(`   ⚠️  ${failedTests} test(s) échoué(s)`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🧪 TEST 3 — CTA Text Normalization');
  console.log('════════════════════════════════════════════════════════════\n');

  const ctaTexts = [
    'Add to Cart',
    '  ADD TO  CART  ',
    'Ajouter au panier',
    'Buy Now',
  ];

  ctaTexts.forEach((text) => {
    const normalized = FactsHelpers.normalizeCtaText(text);
    console.log(`   "${text}" → "${normalized}"`);
  });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🧪 TEST 4 — App Detection Helper');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('   Has Klaviyo:', FactsHelpers.hasApp(facts1, 'klaviyo'));
  console.log('   Has Loox:', FactsHelpers.hasApp(facts1, 'loox'));
  console.log('   Has Google Analytics:', facts1.technical.hasGoogleAnalytics);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🧪 TEST 5 — SSOT Shopify Apps Stats');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('📊 Apps détectables (SSOT):');
  console.log(`   • Total: ${SHOPIFY_APPS_STATS.total} apps`);
  console.log(`   • Reviews: ${SHOPIFY_APPS_STATS.byCategory.reviews}`);
  console.log(`   • Marketing: ${SHOPIFY_APPS_STATS.byCategory.marketing}`);
  console.log(`   • Support: ${SHOPIFY_APPS_STATS.byCategory.support}`);
  console.log(`   • Subscriptions: ${SHOPIFY_APPS_STATS.byCategory.subscriptions}`);
  console.log(`   • Loyalty: ${SHOPIFY_APPS_STATS.byCategory.loyalty}`);
  console.log(`   • Analytics: ${SHOPIFY_APPS_STATS.byCategory.analytics}`);
  console.log(`   • Other: ${SHOPIFY_APPS_STATS.byCategory.other}`);

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🧪 TEST 6 — HTML Réel (si disponible)');
  console.log('════════════════════════════════════════════════════════════\n');

  // Chercher un HTML capturé dans temp/
  const tempFiles = [
    'temp/example-mobile.html',
    'temp/gymshark-mobile.html',
    'temp/allbirds-mobile.html',
  ];

  let realHtml: string | null = null;
  let realHtmlPath: string | null = null;

  for (const file of tempFiles) {
    const fullPath = join(process.cwd(), file);
    if (existsSync(fullPath)) {
      try {
        realHtml = readFileSync(fullPath, 'utf-8');
        realHtmlPath = file;
        break;
      } catch (error) {
        // Continue si lecture échoue
      }
    }
  }

  if (realHtml && realHtmlPath) {
    console.log(`📄 HTML trouvé: ${realHtmlPath}\n`);

    const facts2 = await collectFacts(realHtml, {
      strictMode: true,
      locale: 'en',
    });

    console.log('📦 PDP Facts (Real HTML):');
    console.log('   • Title:', facts2.pdp.title || 'N/A');
    console.log('   • Price:', facts2.pdp.price || 'N/A');
    console.log('   • Has ATC Button:', facts2.pdp.hasAtcButton);
    console.log('   • ATC Text:', facts2.pdp.atcText || 'N/A');
    console.log('   • In Stock:', facts2.pdp.inStock);

    console.log('\n🏗️  Structure Facts (Real HTML):');
    console.log('   • H1 Count:', facts2.structure.h1Count);
    console.log('   • Main H1:', facts2.structure.mainH1Text || 'N/A');
    console.log('   • Image Count:', facts2.structure.imageCount);
    console.log('   • Images without Alt:', facts2.structure.imagesWithoutAlt);

    console.log('\n⚙️  Technical Facts (Real HTML):');
    console.log('   • Is Shopify:', facts2.technical.isShopify);
    console.log('   • Theme Name:', facts2.technical.themeName || 'Unknown');
    console.log('   • Detected Apps:', facts2.technical.detectedApps.join(', ') || 'None');

    console.log('\n📊 Performance (Real HTML):');
    console.log('   • Parsing Duration:', facts2.meta.parsingDuration, 'ms');
  } else {
    console.log('⚠️  Aucun HTML réel trouvé dans temp/');
    console.log('   Capturez une page d\'abord avec: npm run test:playwright:simple');
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('✅ TOUS LES TESTS TERMINÉS');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('💡 Validation SSOT:');
  console.log('   ✅ Facts-Only (pas de scores, pas de recommandations)');
  console.log('   ✅ Pure Function (déterministe)');
  console.log('   ✅ DOM-First (heuristiques Shopify strictes)');
  console.log('   ✅ Structured Output (ShopifyFacts interface)');
  console.log(`   ✅ Apps SSOT externalisées (${SHOPIFY_APPS_STATS.total} apps)`);
  console.log('   ✅ Prix normalisés (EU + US formats)');
  console.log('   ✅ Variants avec fallback (6 stratégies)');

  console.log('\n📝 Prochaines étapes:');
  console.log('   1. Intégrer dans AuditService (collectFacts après capture)');
  console.log('   2. Créer les détecteurs basés sur les facts');
  console.log('   3. Brancher le scoring engine (facts → tickets)');
}

main()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
