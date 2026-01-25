/**
 * Script Test — AuditService (Orchestrateur Pipeline)
 * 
 * Teste l'exécution complète d'un audit SOLO :
 * - Génération des clés déterministes
 * - Cache check
 * - Capture Playwright (Mobile + Desktop)
 * - Upload Supabase
 * - Persistence Prisma
 * 
 * Usage:
 *   npm run test:audit
 */

import 'dotenv/config';
import { AuditService } from '../src/core/pipeline/audit.service.js';

// URL de test (site léger pour tests rapides)
const TEST_URL = 'https://www.allbirds.com/products/mens-tree-runners';

async function main() {
  console.log('🧪 Test AuditService — Pipeline Complet\n');

  const service = new AuditService();

  console.log('════════════════════════════════════════════════════════════');
  console.log('📋 TEST 1 — Première exécution (Cache Miss)');
  console.log('════════════════════════════════════════════════════════════\n');

  const startTime1 = Date.now();
  const result1 = await service.runSoloAudit(TEST_URL, {
    locale: 'en',
    copyReady: false,
    captureTimeout: 20000,
    blockResources: true,
  });
  const duration1 = Date.now() - startTime1;

  console.log('\n📊 Résultat Test 1:');
  console.log('   • Status:', result1.status);
  console.log('   • From Cache:', result1.fromCache);
  console.log('   • Duration:', result1.duration, 'ms');
  console.log('   • Total Duration:', duration1, 'ms');
  console.log('   • Errors:', result1.errors.length);

  if (result1.errors.length > 0) {
    console.log('\n⚠️  Erreurs détectées:');
    result1.errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. [${err.stage}] ${err.code}: ${err.message}`);
    });
  }

  console.log('\n🔑 Clés générées:');
  console.log('   • Product Key:', result1.keys.productKey);
  console.log('   • Snapshot Key:', result1.keys.snapshotKey);
  console.log('   • Run Key:', result1.keys.runKey);
  console.log('   • Audit Key:', result1.keys.auditKey);

  if (result1.exports) {
    console.log('\n📦 Exports:');
    console.log('   • Tickets:', result1.exports.tickets.length);
    console.log('   • Evidences:', result1.exports.evidences.length);

    if (result1.exports.tickets.length > 0) {
      console.log('\n📝 Premier ticket:');
      const ticket = result1.exports.tickets[0];
      if (ticket) {
        console.log('   • Ticket ID:', ticket.ticket_id);
        console.log('   • Title:', ticket.title);
        console.log('   • Category:', ticket.category);
        console.log('   • Impact:', ticket.impact);
        console.log('   • Confidence:', ticket.confidence);
      }
    }
  }

  if (result1.artifacts) {
    console.log('\n📸 Artifacts (URLs Supabase):');
    console.log(
      '   • Mobile Screenshot:',
      result1.artifacts.screenshots.mobile?.above_fold || 'N/A'
    );
    console.log(
      '   • Desktop Screenshot:',
      result1.artifacts.screenshots.desktop?.above_fold || 'N/A'
    );
    console.log(
      '   • Mobile HTML:',
      result1.artifacts.html_refs?.mobile || 'N/A'
    );
    console.log(
      '   • Desktop HTML:',
      result1.artifacts.html_refs?.desktop || 'N/A'
    );
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🔄 TEST 2 — Deuxième exécution (Cache Hit attendu)');
  console.log('════════════════════════════════════════════════════════════\n');

  const startTime2 = Date.now();
  const result2 = await service.runSoloAudit(TEST_URL, {
    locale: 'en',
    copyReady: false,
  });
  const duration2 = Date.now() - startTime2;

  console.log('\n📊 Résultat Test 2:');
  console.log('   • Status:', result2.status);
  console.log('   • From Cache:', result2.fromCache);
  console.log('   • Duration:', result2.duration, 'ms');
  console.log('   • Total Duration:', duration2, 'ms');

  if (result2.fromCache) {
    console.log('\n✅ CACHE HIT CONFIRMÉ!');
    console.log(
      `   Gain de temps: ${duration1 - duration2}ms (${(
        ((duration1 - duration2) / duration1) *
        100
      ).toFixed(1)}% plus rapide)`
    );
  } else {
    console.log('\n⚠️  Cache hit attendu mais pas détecté.');
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('📋 TEST 3 — Nouvelle URL (Cache Miss attendu)');
  console.log('════════════════════════════════════════════════════════════\n');

  const TEST_URL_2 = 'https://www.allbirds.com/products/mens-wool-runners';

  const startTime3 = Date.now();
  const result3 = await service.runSoloAudit(TEST_URL_2, {
    locale: 'en',
    copyReady: false,
  });
  const duration3 = Date.now() - startTime3;

  console.log('\n📊 Résultat Test 3:');
  console.log('   • URL:', TEST_URL_2);
  console.log('   • Status:', result3.status);
  console.log('   • From Cache:', result3.fromCache);
  console.log('   • Duration:', result3.duration, 'ms');
  console.log('   • Total Duration:', duration3, 'ms');
  console.log('   • Product Key:', result3.keys.productKey);

  if (!result3.fromCache) {
    console.log('\n✅ CACHE MISS CONFIRMÉ (nouvelle URL)!');
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('✅ TOUS LES TESTS TERMINÉS');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('📊 Résumé:');
  console.log(`   • Test 1 (Cache Miss): ${duration1}ms`);
  console.log(`   • Test 2 (Cache Hit): ${duration2}ms`);
  console.log(`   • Test 3 (Cache Miss URL 2): ${duration3}ms`);
  console.log(
    `   • Gain Cache Hit: ${(((duration1 - duration2) / duration1) * 100).toFixed(1)}%`
  );

  console.log('\n💡 Prochaines étapes:');
  console.log('   1. Implémenter les détecteurs (src/core/detectors/)');
  console.log('   2. Brancher le scoring engine (src/core/scoring/)');
  console.log('   3. Générer le rapport HTML SSOT');
  console.log('   4. Créer l\'API publique (app/api/audit-solo/route.ts)');
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
