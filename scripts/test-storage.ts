/**
 * Script Test — Supabase Storage Service
 * 
 * Teste les uploads de screenshots et HTML vers Supabase Storage.
 * 
 * Prérequis:
 * - Buckets 'screenshots' et 'html-reports' créés dans Supabase
 * - Variables SUPABASE_URL et SUPABASE_ANON_KEY dans .env
 * 
 * Usage:
 *   npm run test:storage
 */

import 'dotenv/config'; // ⚡ Charger les variables .env
import { SupabaseStorageService } from '../src/adapters/storage/supabase.service.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🧪 Test Supabase Storage Service\n');

  // Créer le service
  const service = SupabaseStorageService.getInstance();

  try {
    // Initialiser
    console.log('⏳ Initialisation du service Supabase...');
    await service.initialize();
    console.log('✅ Service prêt\n');

    // Test audit_key déterministe
    const auditKey = `audit_test_${Date.now()}`;
    console.log(`🔑 Audit Key: ${auditKey}\n`);

    // ===== TEST 1: Upload Screenshot =====
    console.log('═'.repeat(60));
    console.log('📸 TEST 1 — Upload Screenshot');
    console.log('═'.repeat(60));

    // Lire un screenshot de test (si existe)
    let screenshotBuffer: Buffer;
    try {
      screenshotBuffer = readFileSync(
        join(process.cwd(), 'temp', 'example-mobile.png')
      );
      console.log(`✅ Screenshot chargé: ${(screenshotBuffer.length / 1024).toFixed(2)} KB`);
    } catch {
      // Si pas de fichier, créer un buffer vide pour le test
      screenshotBuffer = Buffer.from('fake-png-data');
      console.log('⚠️  Pas de screenshot réel trouvé, utilisation de données de test');
    }

    const screenshotResult = await service.uploadScreenshot(
      auditKey,
      'mobile',
      screenshotBuffer
    );

    if (screenshotResult.success) {
      console.log('✅ Upload réussi!');
      console.log(`   • Path: ${screenshotResult.path}`);
      console.log(`   • URL: ${screenshotResult.publicUrl}`);
      console.log(`   • Size: ${(screenshotResult.size / 1024).toFixed(2)} KB`);
      console.log(`   • Cached: ${screenshotResult.cached}`);
    } else {
      console.error('❌ Upload échoué:');
      console.error(`   • Type: ${screenshotResult.error.type}`);
      console.error(`   • Message: ${screenshotResult.error.message}`);
      process.exit(1);
    }

    console.log();

    // ===== TEST 2: Upload HTML =====
    console.log('═'.repeat(60));
    console.log('📄 TEST 2 — Upload HTML');
    console.log('═'.repeat(60));

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Test Report - ${auditKey}</title>
</head>
<body>
  <h1>Test HTML Report</h1>
  <p>Audit Key: ${auditKey}</p>
  <p>Timestamp: ${new Date().toISOString()}</p>
</body>
</html>
    `.trim();

    console.log(`📝 HTML généré: ${(htmlContent.length / 1024).toFixed(2)} KB`);

    const htmlResult = await service.uploadHtml(
      auditKey,
      'mobile',
      htmlContent
    );

    if (htmlResult.success) {
      console.log('✅ Upload réussi!');
      console.log(`   • Path: ${htmlResult.path}`);
      console.log(`   • URL: ${htmlResult.publicUrl}`);
      console.log(`   • Size: ${(htmlResult.size / 1024).toFixed(2)} KB`);
      console.log(`   • Cached: ${htmlResult.cached}`);
    } else {
      console.error('❌ Upload échoué:');
      console.error(`   • Type: ${htmlResult.error.type}`);
      console.error(`   • Message: ${htmlResult.error.message}`);
      process.exit(1);
    }

    console.log();

    // ===== TEST 3: Cache Hit (overwrite: false) =====
    console.log('═'.repeat(60));
    console.log('💾 TEST 3 — Cache Hit (overwrite: false)');
    console.log('═'.repeat(60));

    const cacheResult = await service.uploadScreenshot(
      auditKey,
      'mobile',
      screenshotBuffer,
      { overwrite: false } // Ne pas écraser
    );

    if (cacheResult.success) {
      console.log('✅ Cache hit détecté!');
      console.log(`   • Path: ${cacheResult.path}`);
      console.log(`   • URL: ${cacheResult.publicUrl}`);
      console.log(`   • Cached: ${cacheResult.cached ? '✅ YES' : '❌ NO'}`);

      if (cacheResult.cached) {
        console.log('   🎉 Le fichier existant a été retourné (pas de re-upload)');
      } else {
        console.warn('   ⚠️  Fichier uploadé à nouveau (comportement inattendu)');
      }
    } else {
      console.error('❌ Test cache hit échoué:');
      console.error(`   • Type: ${cacheResult.error.type}`);
      console.error(`   • Message: ${cacheResult.error.message}`);
    }

    console.log();

    // ===== TEST 4: Desktop Viewport =====
    console.log('═'.repeat(60));
    console.log('🖥️  TEST 4 — Upload Desktop Viewport');
    console.log('═'.repeat(60));

    const desktopResult = await service.uploadScreenshot(
      auditKey,
      'desktop',
      screenshotBuffer
    );

    if (desktopResult.success) {
      console.log('✅ Upload Desktop réussi!');
      console.log(`   • Path: ${desktopResult.path}`);
      console.log(`   • URL: ${desktopResult.publicUrl}`);
    } else {
      console.error('❌ Upload Desktop échoué:');
      console.error(`   • Message: ${desktopResult.error.message}`);
    }

    console.log();

    // ===== RÉSUMÉ =====
    console.log('═'.repeat(60));
    console.log('✅ TOUS LES TESTS TERMINÉS');
    console.log('═'.repeat(60));

    console.log('\n📊 Résumé des URLs générées:');
    if (screenshotResult.success) {
      console.log(`\n📸 Screenshot Mobile:`);
      console.log(`   ${screenshotResult.publicUrl}`);
    }
    if (desktopResult.success) {
      console.log(`\n📸 Screenshot Desktop:`);
      console.log(`   ${desktopResult.publicUrl}`);
    }
    if (htmlResult.success) {
      console.log(`\n📄 HTML Report:`);
      console.log(`   ${htmlResult.publicUrl}`);
    }

    console.log('\n💡 Ces URLs peuvent être utilisées dans EvidenceV2.details.storage_path');
    console.log();

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
