/**
 * Script Simple — Test Playwright Service
 * 
 * Teste une capture mobile sur l'URL Gymshark.
 * 
 * Usage:
 *   npm run test:playwright
 */

import { PlaywrightService } from '../src/adapters/capture/playwright.service';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🚀 Test Playwright Service\n');

  // URL de test (Gymshark)
  const url = 'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23';
  
  console.log(`📍 URL: ${url}`);
  console.log(`📱 Viewport: Mobile (390×844)\n`);

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

    // Capture Mobile
    console.log('📸 Capture en cours...');
    const startTime = Date.now();
    
    const result = await service.capturePage(url, 'mobile', {
      timeout: 60000, // 60s pour Gymshark (site lourd)
    });
    
    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ Capture réussie en ${duration}ms\n`);

      // Infos screenshot
      const screenshotSizeKB = (result.screenshot.length / 1024).toFixed(2);
      console.log(`📊 Screenshot:`);
      console.log(`   • Taille: ${screenshotSizeKB} KB`);
      console.log(`   • Dimensions: ${result.metadata.width}×${result.metadata.height}`);
      console.log(`   • Scale: ${result.metadata.deviceScaleFactor}x`);

      // Infos HTML
      const htmlSizeKB = (result.html.length / 1024).toFixed(2);
      console.log(`\n📄 HTML:`);
      console.log(`   • Longueur: ${result.html.length} caractères`);
      console.log(`   • Taille: ${htmlSizeKB} KB`);
      console.log(`   • Hauteur totale page: ${result.metadata.fullPageHeight}px`);

      // Timestamp
      console.log(`\n⏰ Timestamp: ${result.timestamp}`);

      // Sauvegarder le screenshot
      const screenshotPath = join(tempDir, 'gymshark-mobile.png');
      writeFileSync(screenshotPath, result.screenshot);
      
      console.log(`\n💾 Screenshot sauvegardé:`);
      console.log(`   ${screenshotPath}`);

      console.log(`\n✅ Test terminé avec succès!`);
    } else {
      console.error(`\n❌ Échec de la capture:`);
      console.error(`   • Type: ${result.error.type}`);
      console.error(`   • Message: ${result.error.message}`);
      if (result.error.code) {
        console.error(`   • Code: ${result.error.code}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Fermeture du navigateur...');
    await service.close();
    console.log('✅ Nettoyage terminé\n');
  }
}

main();
