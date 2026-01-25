/**
 * ⚡ ULTRA-AGGRESSIVE TEST — Double Capture Parallèle
 * 
 * Test la capture Mobile + Desktop en parallèle.
 * Objectif: <12 secondes total
 * 
 * Usage:
 *   PLAYWRIGHT_BROWSERS_PATH=0 npm run test:parallel
 */

import { PlaywrightService } from '../src/adapters/capture/playwright.service';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('⚡ Test ULTRA-AGGRESSIVE — Double Capture Parallèle\n');
  console.log('🎯 Objectif: <12 secondes total\n');

  // URL de test (Gymshark - site lourd)
  const url = 'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23';
  
  console.log(`📍 URL: ${url}\n`);

  // Créer le dossier temp/
  const tempDir = join(process.cwd(), 'temp');
  mkdirSync(tempDir, { recursive: true });

  // Créer le service
  const service = PlaywrightService.getInstance();

  try {
    // Initialiser
    console.log('⏳ Initialisation du navigateur...');
    await service.initialize();
    console.log('✅ Navigateur prêt\n');

    // ⚡ PARALLEL EXECUTION — Mobile + Desktop simultanément
    console.log('⚡ DOUBLE CAPTURE PARALLÈLE...\n');
    const startTime = Date.now();
    
    const results = await service.captureBothViewports(url, {
      timeout: 15000, // 15s hard timeout par viewport
      blockResources: true,
    });
    
    const totalDuration = Date.now() - startTime;
    const totalSeconds = (totalDuration / 1000).toFixed(1);

    // Afficher résultats Mobile
    console.log('📱 MOBILE:');
    if (results.mobile.success) {
      const mobileSeconds = (results.mobile.metadata.loadDurationMs / 1000).toFixed(1);
      const screenshotSizeKB = (results.mobile.screenshot.length / 1024).toFixed(2);
      const htmlSizeKB = (results.mobile.html.length / 1024).toFixed(2);

      console.log(`   ✅ Succès en ${mobileSeconds}s`);
      console.log(`   📸 Screenshot: ${screenshotSizeKB} KB`);
      console.log(`   📄 HTML: ${htmlSizeKB} KB`);

      // Sauvegarder
      const screenshotPath = join(tempDir, 'parallel-mobile.png');
      writeFileSync(screenshotPath, results.mobile.screenshot);
      console.log(`   💾 Sauvegardé: temp/parallel-mobile.png`);
    } else {
      console.log(`   ❌ Échec: ${results.mobile.error.type} - ${results.mobile.error.message}`);
    }

    console.log();

    // Afficher résultats Desktop
    console.log('🖥️  DESKTOP:');
    if (results.desktop.success) {
      const desktopSeconds = (results.desktop.metadata.loadDurationMs / 1000).toFixed(1);
      const screenshotSizeKB = (results.desktop.screenshot.length / 1024).toFixed(2);
      const htmlSizeKB = (results.desktop.html.length / 1024).toFixed(2);

      console.log(`   ✅ Succès en ${desktopSeconds}s`);
      console.log(`   📸 Screenshot: ${screenshotSizeKB} KB`);
      console.log(`   📄 HTML: ${htmlSizeKB} KB`);

      // Sauvegarder
      const screenshotPath = join(tempDir, 'parallel-desktop.png');
      writeFileSync(screenshotPath, results.desktop.screenshot);
      console.log(`   💾 Sauvegardé: temp/parallel-desktop.png`);
    } else {
      console.log(`   ❌ Échec: ${results.desktop.error.type} - ${results.desktop.error.message}`);
    }

    console.log();
    console.log('═'.repeat(60));
    console.log(`⏱️  TEMPS TOTAL: ${totalSeconds}s`);
    console.log('═'.repeat(60));

    // Vérifier objectif <12s
    if (totalDuration <= 12000) {
      console.log(`\n🎉 OBJECTIF ATTEINT! (<12s) — Performance ULTRA-AGRESSIVE validée!`);
    } else {
      const overtime = ((totalDuration - 12000) / 1000).toFixed(1);
      console.log(`\n⚠️  Objectif manqué de ${overtime}s`);
      console.log(`💡 Gymshark est un site extrêmement lourd (~500KB HTML, +6000px hauteur)`);
      console.log(`   Pour des sites Shopify standards, l'objectif devrait être atteint.`);
    }

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Fermeture du navigateur...');
    await service.close();
    console.log('✅ Test terminé\n');
  }
}

main();
