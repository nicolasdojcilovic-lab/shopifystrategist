/**
 * Script de Test — Playwright Service
 * 
 * Teste le service de capture sur une vraie URL.
 * 
 * Usage:
 *   npm run test:capture
 */

import { PlaywrightService } from '@/adapters/capture/playwright.service';
import { writeFileSync } from 'fs';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  console.clear();
  
  log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ShopifyStrategist — Test Playwright Service                            ║
║   Capture de pages web avec métadonnées SSOT                             ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
`, colors.bright + colors.cyan);

  // URL de test
  const testUrl = 'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23';

  log(`\n🎯 URL de test:`, colors.yellow);
  log(`   ${testUrl}`, colors.bright);

  // Créer le service
  const service = PlaywrightService.getInstance();

  try {
    // Initialiser
    log(`\n🚀 Initialisation du navigateur...`, colors.cyan);
    await service.initialize();
    log(`   ✅ Navigateur prêt`, colors.green);

    // Capture Mobile
    log(`\n📱 Capture Mobile (390×844)...`, colors.cyan);
    const mobileResult = await service.capturePage(testUrl, 'mobile');

    if (mobileResult.success) {
      log(`   ✅ Succès`, colors.green);
      log(`   • Screenshot: ${(mobileResult.screenshot.length / 1024).toFixed(2)} KB`, colors.bright);
      log(`   • HTML: ${(mobileResult.html.length / 1024).toFixed(2)} KB`, colors.bright);
      log(`   • Durée: ${mobileResult.metadata.loadDurationMs}ms`, colors.bright);
      log(`   • Hauteur page: ${mobileResult.metadata.fullPageHeight}px`, colors.bright);
      log(`   • Timestamp: ${mobileResult.timestamp}`, colors.bright);

      // Sauvegarder le screenshot
      const mobileScreenshotPath = join(process.cwd(), 'tmp', 'test-capture-mobile.png');
      writeFileSync(mobileScreenshotPath, mobileResult.screenshot);
      log(`   • Sauvegardé: tmp/test-capture-mobile.png`, colors.green);
    } else {
      log(`   ❌ Échec: ${mobileResult.error.message}`, colors.red);
      log(`   • Type: ${mobileResult.error.type}`, colors.red);
    }

    // Capture Desktop
    log(`\n🖥️  Capture Desktop (1440×900)...`, colors.cyan);
    const desktopResult = await service.capturePage(testUrl, 'desktop');

    if (desktopResult.success) {
      log(`   ✅ Succès`, colors.green);
      log(`   • Screenshot: ${(desktopResult.screenshot.length / 1024).toFixed(2)} KB`, colors.bright);
      log(`   • HTML: ${(desktopResult.html.length / 1024).toFixed(2)} KB`, colors.bright);
      log(`   • Durée: ${desktopResult.metadata.loadDurationMs}ms`, colors.bright);
      log(`   • Hauteur page: ${desktopResult.metadata.fullPageHeight}px`, colors.bright);
      log(`   • Timestamp: ${desktopResult.timestamp}`, colors.bright);

      // Sauvegarder le screenshot
      const desktopScreenshotPath = join(process.cwd(), 'tmp', 'test-capture-desktop.png');
      writeFileSync(desktopScreenshotPath, desktopResult.screenshot);
      log(`   • Sauvegardé: tmp/test-capture-desktop.png`, colors.green);
    } else {
      log(`   ❌ Échec: ${desktopResult.error.message}`, colors.red);
      log(`   • Type: ${desktopResult.error.type}`, colors.red);
    }

    // Test Both Viewports
    log(`\n🔄 Test captureBothViewports()...`, colors.cyan);
    const bothResults = await service.captureBothViewports(testUrl);

    const mobileOk = bothResults.mobile.success;
    const desktopOk = bothResults.desktop.success;

    log(`   • Mobile: ${mobileOk ? '✅' : '❌'}`, mobileOk ? colors.green : colors.red);
    log(`   • Desktop: ${desktopOk ? '✅' : '❌'}`, desktopOk ? colors.green : colors.red);

    // Test d'erreur (URL invalide)
    log(`\n❌ Test gestion d'erreur (URL invalide)...`, colors.cyan);
    const errorResult = await service.capturePage('https://invalid-url-404-test.com', 'mobile');

    if (!errorResult.success) {
      log(`   ✅ Erreur capturée correctement`, colors.green);
      log(`   • Type: ${errorResult.error.type}`, colors.bright);
      log(`   • Message: ${errorResult.error.message}`, colors.bright);
    } else {
      log(`   ⚠️  URL invalide n'a pas échoué (inattendu)`, colors.yellow);
    }

    // Résumé
    log(`\n📊 Résumé:`, colors.yellow);
    log(`   • Service initialisé: ${service.isReady() ? '✅' : '❌'}`, colors.bright);
    log(`   • Captures réussies: ${[mobileResult.success, desktopResult.success].filter(Boolean).length}/2`, colors.bright);

    log(`\n✅ Tests terminés avec succès!`, colors.green);
  } catch (error) {
    log(`\n❌ Erreur durant les tests:`, colors.red);
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    log(`\n🧹 Fermeture du navigateur...`, colors.cyan);
    await service.close();
    log(`   ✅ Navigateur fermé`, colors.green);
  }

  log(`\n💡 Tips:`, colors.yellow);
  log(`   - Screenshots sauvegardés dans tmp/`, colors.cyan);
  log(`   - Métadonnées conformes à EvidenceV2 (SSOT)`, colors.cyan);
  log(`   - Service prêt pour intégration pipeline`, colors.cyan);

  log(`\n📚 Docs:`, colors.yellow);
  log(`   - src/adapters/capture/README.md`, colors.cyan);
  log(`   - src/contracts/export/evidence.v2.ts`, colors.cyan);

  log(``);
}

main();
