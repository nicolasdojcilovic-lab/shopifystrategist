/**
 * Script de Debug — Moteur de Clés Déterministes
 * 
 * Démontre le fonctionnement du système de cache multi-couches.
 * Prouve le déterminisme : URL différentes mais normalisées identiques → mêmes clés.
 * 
 * Usage:
 *   npm run debug:keys
 *   ou
 *   tsx scripts/debug-keys.ts
 */

import {
  normalizeUrl,
  generateProductKey,
  generateSnapshotKey,
  generateRunKey,
  generateAuditKey,
  generateRenderKey,
  analyzeKey,
} from '@/core/engine/keys';

// Couleurs console pour meilleure lisibilité
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function separator() {
  log('\n' + '='.repeat(80), colors.cyan);
}

function header(title: string) {
  separator();
  log(`  ${title}`, colors.bright + colors.cyan);
  separator();
}

/**
 * Test avec une URL propre
 */
function testCleanUrl() {
  header('TEST 1: URL Propre (Gymshark)');

  const url = 'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23';
  
  log(`\n📍 URL Originale:`, colors.yellow);
  log(`   ${url}`, colors.bright);

  // 1. Normalisation
  const normalized = normalizeUrl(url);
  log(`\n🔧 URL Normalisée:`, colors.green);
  log(`   ${normalized}`, colors.bright);

  if (url === normalized) {
    log(`   ✅ Identique (déjà propre)`, colors.green);
  } else {
    log(`   ⚠️  Différente (normalisée)`, colors.yellow);
  }

  // 2. Product Key
  log(`\n🔑 Génération des Clés (SOLO mode):`, colors.blue);
  
  const productKey = generateProductKey({
    mode: 'solo',
    urls: { page_a: url },
  });
  
  const productAnalysis = analyzeKey(productKey);
  log(`   product_key:  ${productKey}`, colors.bright);
  log(`   └─ prefix: ${productAnalysis.prefix}, hash: ${productAnalysis.hash}`, colors.cyan);

  // 3. Snapshot Key
  const snapshotKey = generateSnapshotKey({
    productKey,
    locale: 'fr',
    viewports: {
      mobile: { width: 390, height: 844 },
      desktop: { width: 1440, height: 900 },
    },
  });
  
  const snapshotAnalysis = analyzeKey(snapshotKey);
  log(`   snapshot_key: ${snapshotKey}`, colors.bright);
  log(`   └─ prefix: ${snapshotAnalysis.prefix}, hash: ${snapshotAnalysis.hash}`, colors.cyan);

  // 4. Run Key
  const runKey = generateRunKey({
    snapshotKey,
    mode: 'solo',
  });
  
  const runAnalysis = analyzeKey(runKey);
  log(`   run_key:      ${runKey}`, colors.bright);
  log(`   └─ prefix: ${runAnalysis.prefix}, hash: ${runAnalysis.hash}`, colors.cyan);

  // 5. Audit Key
  const auditKey = generateAuditKey({
    runKey,
    copyReady: false,
    whiteLabel: null,
  });
  
  const auditAnalysis = analyzeKey(auditKey);
  log(`   audit_key:    ${auditKey}`, colors.bright);
  log(`   └─ prefix: ${auditAnalysis.prefix}, hash: ${auditAnalysis.hash}`, colors.cyan);

  // 6. Render Key
  const renderKey = generateRenderKey({
    auditKey,
  });
  
  const renderAnalysis = analyzeKey(renderKey);
  log(`   render_key:   ${renderKey}`, colors.bright);
  log(`   └─ prefix: ${renderAnalysis.prefix}, hash: ${renderAnalysis.hash}`, colors.cyan);

  return {
    url,
    normalized,
    productKey,
    snapshotKey,
    runKey,
    auditKey,
    renderKey,
  };
}

/**
 * Test avec URL "sale" (UTM, ancres, etc.)
 */
function testDirtyUrl() {
  header('TEST 2: URL "Sale" (UTM + Paramètres + Ancres)');

  const dirtyUrl = 'https://FR.GYMSHARK.COM/Products/gymshark-crest-straight-leg-joggers-black-aw23/?utm_source=test&utm_medium=cpc&utm_campaign=winter&variant=123&gclid=abc123&fbclid=def456#reviews';
  
  log(`\n📍 URL Originale (SALE):`, colors.yellow);
  log(`   ${dirtyUrl}`, colors.bright);
  log(`   └─ Contient: UTM, gclid, fbclid, variant, ancre #reviews`, colors.red);

  // 1. Normalisation
  const normalized = normalizeUrl(dirtyUrl);
  log(`\n🔧 URL Normalisée:`, colors.green);
  log(`   ${normalized}`, colors.bright);
  log(`   └─ UTM/tracking supprimés, minuscule, sans ancre, sans /`, colors.green);

  // 2. Product Key
  log(`\n🔑 Génération des Clés (SOLO mode):`, colors.blue);
  
  const productKey = generateProductKey({
    mode: 'solo',
    urls: { page_a: dirtyUrl },
  });
  
  const productAnalysis = analyzeKey(productKey);
  log(`   product_key:  ${productKey}`, colors.bright);
  log(`   └─ prefix: ${productAnalysis.prefix}, hash: ${productAnalysis.hash}`, colors.cyan);

  // 3. Snapshot Key
  const snapshotKey = generateSnapshotKey({
    productKey,
    locale: 'fr',
    viewports: {
      mobile: { width: 390, height: 844 },
      desktop: { width: 1440, height: 900 },
    },
  });
  
  const snapshotAnalysis = analyzeKey(snapshotKey);
  log(`   snapshot_key: ${snapshotKey}`, colors.bright);
  log(`   └─ prefix: ${snapshotAnalysis.prefix}, hash: ${snapshotAnalysis.hash}`, colors.cyan);

  // 4. Run Key
  const runKey = generateRunKey({
    snapshotKey,
    mode: 'solo',
  });
  
  const runAnalysis = analyzeKey(runKey);
  log(`   run_key:      ${runKey}`, colors.bright);
  log(`   └─ prefix: ${runAnalysis.prefix}, hash: ${runAnalysis.hash}`, colors.cyan);

  // 5. Audit Key
  const auditKey = generateAuditKey({
    runKey,
    copyReady: false,
    whiteLabel: null,
  });
  
  const auditAnalysis = analyzeKey(auditKey);
  log(`   audit_key:    ${auditKey}`, colors.bright);
  log(`   └─ prefix: ${auditAnalysis.prefix}, hash: ${auditAnalysis.hash}`, colors.cyan);

  // 6. Render Key
  const renderKey = generateRenderKey({
    auditKey,
  });
  
  const renderAnalysis = analyzeKey(renderKey);
  log(`   render_key:   ${renderKey}`, colors.bright);
  log(`   └─ prefix: ${renderAnalysis.prefix}, hash: ${renderAnalysis.hash}`, colors.cyan);

  return {
    url: dirtyUrl,
    normalized,
    productKey,
    snapshotKey,
    runKey,
    auditKey,
    renderKey,
  };
}

/**
 * Comparaison des résultats (preuve de déterminisme)
 */
function compareResults(test1: any, test2: any) {
  header('COMPARAISON: Preuve de Déterminisme');

  log(`\n📊 URLs Originales:`, colors.yellow);
  log(`   Test 1: ${test1.url}`, colors.bright);
  log(`   Test 2: ${test2.url}`, colors.bright);

  log(`\n🔧 URLs Normalisées:`, colors.green);
  const normalizedMatch = test1.normalized === test2.normalized;
  log(`   Test 1: ${test1.normalized}`, colors.bright);
  log(`   Test 2: ${test2.normalized}`, colors.bright);
  log(`   └─ ${normalizedMatch ? '✅ IDENTIQUES' : '❌ DIFFÉRENTES'}`, 
    normalizedMatch ? colors.green : colors.red);

  log(`\n🔑 Clés Générées:`, colors.blue);

  // Comparaison de chaque couche
  const layers = [
    { name: 'product_key ', key1: test1.productKey, key2: test2.productKey },
    { name: 'snapshot_key', key1: test1.snapshotKey, key2: test2.snapshotKey },
    { name: 'run_key     ', key1: test1.runKey, key2: test2.runKey },
    { name: 'audit_key   ', key1: test1.auditKey, key2: test2.auditKey },
    { name: 'render_key  ', key1: test1.renderKey, key2: test2.renderKey },
  ];

  let allMatch = true;

  for (const layer of layers) {
    const match = layer.key1 === layer.key2;
    allMatch = allMatch && match;
    
    log(`   ${layer.name}: ${match ? '✅ IDENTIQUES' : '❌ DIFFÉRENTES'}`, 
      match ? colors.green : colors.red);
    
    if (!match) {
      log(`      Test 1: ${layer.key1}`, colors.bright);
      log(`      Test 2: ${layer.key2}`, colors.bright);
    } else {
      log(`      Clé: ${layer.key1}`, colors.cyan);
    }
  }

  separator();
  
  if (allMatch) {
    log(`\n🎉 DÉTERMINISME CONFIRMÉ !`, colors.bright + colors.green);
    log(`   URLs différentes → URLs normalisées identiques → Clés identiques`, colors.green);
    log(`   Le système de cache fonctionnera correctement.`, colors.green);
  } else {
    log(`\n❌ DÉTERMINISME ÉCHOUÉ !`, colors.bright + colors.red);
    log(`   Les clés devraient être identiques mais ne le sont pas.`, colors.red);
  }

  separator();
}

/**
 * Test bonus : Changement de paramètres (preuve de cache miss)
 */
function testDifferentParams() {
  header('TEST BONUS: Changement de Paramètres (Cache Miss)');

  const baseUrl = 'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23';
  
  log(`\n🔄 Scénarios de Cache Miss:`, colors.magenta);

  // Scénario 1: Mode différent
  const key1Solo = generateProductKey({
    mode: 'solo',
    urls: { page_a: baseUrl },
  });

  const key1Duo = generateProductKey({
    mode: 'duo_ab',
    urls: {
      page_a: baseUrl,
      page_b: 'https://competitor.com/product',
    },
  });

  log(`\n   1️⃣  Mode SOLO vs DUO AB:`, colors.yellow);
  log(`      SOLO:   ${key1Solo}`, colors.cyan);
  log(`      DUO AB: ${key1Duo}`, colors.cyan);
  log(`      └─ ${key1Solo !== key1Duo ? '✅ DIFFÉRENTES (attendu)' : '❌ IDENTIQUES (erreur)'}`, 
    key1Solo !== key1Duo ? colors.green : colors.red);

  // Scénario 2: Locale différente (snapshot_key)
  const productKey = key1Solo;
  
  const snapFr = generateSnapshotKey({
    productKey,
    locale: 'fr',
    viewports: {
      mobile: { width: 390, height: 844 },
      desktop: { width: 1440, height: 900 },
    },
  });

  const snapEn = generateSnapshotKey({
    productKey,
    locale: 'en',
    viewports: {
      mobile: { width: 390, height: 844 },
      desktop: { width: 1440, height: 900 },
    },
  });

  log(`\n   2️⃣  Locale FR vs EN:`, colors.yellow);
  log(`      FR: ${snapFr}`, colors.cyan);
  log(`      EN: ${snapEn}`, colors.cyan);
  log(`      └─ ${snapFr !== snapEn ? '✅ DIFFÉRENTES (attendu)' : '❌ IDENTIQUES (erreur)'}`, 
    snapFr !== snapEn ? colors.green : colors.red);

  // Scénario 3: copy_ready true vs false (audit_key)
  const runKey = generateRunKey({
    snapshotKey: snapFr,
    mode: 'solo',
  });

  const auditNoCopy = generateAuditKey({
    runKey,
    copyReady: false,
  });

  const auditWithCopy = generateAuditKey({
    runKey,
    copyReady: true,
  });

  log(`\n   3️⃣  copy_ready: false vs true:`, colors.yellow);
  log(`      false: ${auditNoCopy}`, colors.cyan);
  log(`      true:  ${auditWithCopy}`, colors.cyan);
  log(`      └─ ${auditNoCopy !== auditWithCopy ? '✅ DIFFÉRENTES (attendu)' : '❌ IDENTIQUES (erreur)'}`, 
    auditNoCopy !== auditWithCopy ? colors.green : colors.red);

  separator();
}

/**
 * Main
 */
function main() {
  console.clear();
  
  log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ShopifyStrategist — Debug Moteur de Clés Déterministes                 ║
║   Référence: docs/DB_SCHEMA.md sections 3 & 4                            ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
`, colors.bright + colors.cyan);

  // Test 1: URL propre
  const test1 = testCleanUrl();

  // Test 2: URL "sale"
  const test2 = testDirtyUrl();

  // Comparaison (preuve déterminisme)
  compareResults(test1, test2);

  // Test bonus (cache miss)
  testDifferentParams();

  // Footer
  log(`\n💡 Tips:`, colors.yellow);
  log(`   - Même URL "sale" → Même URL normalisée → Mêmes clés (CACHE HIT)`, colors.cyan);
  log(`   - Paramètres changeants (mode, locale, copy_ready) → Clés différentes (CACHE MISS)`, colors.cyan);
  log(`   - Versions SSOT incluses dans clés → Bump version = invalidation automatique`, colors.cyan);

  log(`\n📚 Docs:`, colors.yellow);
  log(`   - src/core/engine/README.md`, colors.cyan);
  log(`   - docs/DB_SCHEMA.md sections 3 & 4`, colors.cyan);

  log(`\n✅ Script terminé avec succès!\n`, colors.green);
}

// Exécution
main();
