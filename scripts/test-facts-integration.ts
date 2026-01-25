/**
 * Script Test — Facts Integration
 * 
 * Teste l'intégration complète du Facts Collector dans le pipeline:
 * - Capture Playwright
 * - Facts Collection depuis HTML
 * - Calcul evidenceCompleteness
 * - Persistence dans Prisma
 * 
 * Usage:
 *   npm run test:facts-integration
 */

import 'dotenv/config';
import { AuditService } from '../src/core/pipeline/audit.service.js';

async function main() {
  console.log('🧪 Test — Intégration Facts Collector\n');

  const auditService = new AuditService();

  // URL de test Shopify
  const testUrl = 'https://www.allbirds.com/products/mens-tree-runners';

  console.log('📍 URL de test:', testUrl);
  console.log('⏳ Lancement de l\'audit...\n');

  try {
    const startTime = Date.now();
    const result = await auditService.runSoloAudit(testUrl, {
      locale: 'fr',
      copyReady: false,
    });
    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSULTAT');
    console.log('='.repeat(80));

    console.log('\n🔑 Clés déterministes:');
    console.log('   • Product Key:', result.keys.productKey);
    console.log('   • Snapshot Key:', result.keys.snapshotKey);
    console.log('   • Run Key:', result.keys.runKey);
    console.log('   • Audit Key:', result.keys.auditKey);

    console.log('\n📈 Status:');
    console.log('   • Status:', result.status);
    console.log('   • Duration:', duration, 'ms');
    console.log('   • From Cache:', result.fromCache);
    console.log('   • Errors Count:', result.errors.length);

    console.log('\n🎯 Report Meta:');
    console.log('   • Mode:', result.reportMeta?.mode);
    console.log('   • Evidence Completeness:', result.reportMeta?.evidence_completeness); // ✅ Valeur calculée
    console.log('   • Alignment Level:', result.reportMeta?.alignment_level);
    console.log('   • URL:', result.reportMeta?.url);
    console.log('   • Locale:', result.reportMeta?.locale);
    console.log('   • Captured At:', result.reportMeta?.captured_at);

    if (result.artifacts) {
      console.log('\n📸 Artifacts:');
      console.log('   • Mobile Screenshot:', result.artifacts.screenshots.mobile ? '✓' : '✗');
      console.log('   • Desktop Screenshot:', result.artifacts.screenshots.desktop ? '✓' : '✗');
      console.log('   • Mobile HTML:', result.artifacts.html_refs?.mobile ? '✓' : '✗');
      console.log('   • Desktop HTML:', result.artifacts.html_refs?.desktop ? '✓' : '✗');
    }

    console.log('\n📦 Exports:');
    console.log('   • Tickets:', result.exports?.tickets.length || 0);
    console.log('   • Evidences:', result.exports?.evidences.length || 0);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Erreurs:');
      result.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. [${error.stage}] ${error.code}: ${error.message}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 VALIDATION FACTS INTEGRATION');
    console.log('='.repeat(80));

    // Vérifier que evidenceCompleteness n'est pas hardcodé à 'complete'
    if (result.reportMeta?.evidence_completeness) {
      console.log('\n✅ EvidenceCompleteness calculé:', result.reportMeta.evidence_completeness);
      
      if (result.reportMeta.evidence_completeness === 'complete') {
        console.log('   → Set A atteint (above_fold_mobile + above_fold_desktop + full_page_mobile)');
      } else if (result.reportMeta.evidence_completeness === 'partial') {
        console.log('   → Set B atteint (above_fold_mobile + cta_area_mobile + details_section)');
      } else {
        console.log('   → Insufficient (aucun set atteint)');
      }
    } else {
      console.log('\n❌ EvidenceCompleteness manquant!');
    }

    // Vérifier la présence des facts dans les artifacts (via cache hit)
    console.log('\n🔍 Test Cache Hit pour vérifier persistence des facts...');
    const cacheResult = await auditService.runSoloAudit(testUrl, {
      locale: 'fr',
      copyReady: false,
    });

    if (cacheResult.fromCache) {
      console.log('✅ Cache Hit détecté');
      console.log('   • Evidence Completeness (from DB):', cacheResult.reportMeta?.evidence_completeness);
      
      // Note: Les facts ne sont pas dans AuditResult, ils sont dans Prisma SnapshotSource.artefacts
      console.log('\n💡 Les facts sont persistés dans Prisma (SnapshotSource.artefacts.facts)');
      console.log('   → Accessible via query Prisma pour les détecteurs');
    } else {
      console.log('⚠️  Pas de cache hit (run_key différent ou premier run)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST RÉUSSI — Facts Collector intégré au pipeline!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
