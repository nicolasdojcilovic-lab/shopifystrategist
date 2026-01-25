/**
 * Script Test — Site Shopify Léger
 * 
 * Teste la performance sur un site Shopify standard (plus léger que Gymshark).
 * Objectif: Valider <10s
 * 
 * Usage:
 *   PLAYWRIGHT_BROWSERS_PATH=0 npm run test:shopify:light
 */

import { PlaywrightService } from '../src/adapters/capture/playwright.service';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🎯 Test Playwright — Site Shopify Léger\n');
  console.log('Objectif: <10 secondes\n');

  // URLs Shopify standards (plus légers que Gymshark)
  const testUrls = [
    {
      name: 'Allbirds',
      url: 'https://www.allbirds.com/products/mens-tree-runners',
    },
    {
      name: 'Bombas',
      url: 'https://bombas.com/products/mens-lightweight-ankle-sock',
    },
  ];

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

    for (const test of testUrls) {
      console.log('═'.repeat(60));
      console.log(`📍 ${test.name}`);
      console.log(`🔗 ${test.url}`);
      console.log('─'.repeat(60));

      // Capture Mobile
      console.log('\n📱 Capture Mobile...');
      const startTime = Date.now();
      
      const result = await service.capturePage(test.url, 'mobile', {
        timeout: 60000,
        blockResources: true,
      });
      
      const duration = Date.now() - startTime;

      if (result.success) {
        const durationSeconds = (duration / 1000).toFixed(1);
        const screenshotSizeKB = (result.screenshot.length / 1024).toFixed(2);
        const htmlSizeKB = (result.html.length / 1024).toFixed(2);

        console.log(`   ⏱️  Durée: ${durationSeconds}s`);
        console.log(`   📸 Screenshot: ${screenshotSizeKB} KB`);
        console.log(`   📄 HTML: ${htmlSizeKB} KB`);
        console.log(`   📏 Hauteur: ${result.metadata.fullPageHeight}px`);
        console.log(`   ⏰ Timestamp: ${result.timestamp}`);

        // Sauvegarder
        const filename = `${test.name.toLowerCase()}-mobile.png`;
        const screenshotPath = join(tempDir, filename);
        writeFileSync(screenshotPath, result.screenshot);
        console.log(`   💾 Sauvegardé: temp/${filename}`);

        // Vérifier objectif <10s
        if (duration <= 10000) {
          console.log(`\n   ✅ OBJECTIF ATTEINT! (<10s) 🎉`);
        } else {
          const overtime = ((duration - 10000) / 1000).toFixed(1);
          console.log(`\n   ⚠️  Objectif manqué de ${overtime}s`);
        }
      } else {
        console.error(`\n   ❌ Échec: ${result.error.type} - ${result.error.message}`);
      }

      console.log();
    }

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('═'.repeat(60));
    console.log('🧹 Fermeture du navigateur...');
    await service.close();
    console.log('✅ Test terminé\n');
  }
}

main();
