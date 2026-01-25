/**
 * Script Benchmark — Performance Playwright
 * 
 * Compare les performances avec/sans blocage de ressources.
 * 
 * Usage:
 *   PLAYWRIGHT_BROWSERS_PATH=0 npm run benchmark:capture
 */

import { PlaywrightService } from '../src/adapters/capture/playwright.service';

interface BenchmarkResult {
  url: string;
  viewport: 'mobile' | 'desktop';
  withBlocking: boolean;
  success: boolean;
  durationMs: number;
  screenshotSizeKB: number;
  htmlSizeKB: number;
}

async function benchmarkCapture(
  service: PlaywrightService,
  url: string,
  viewport: 'mobile' | 'desktop',
  withBlocking: boolean
): Promise<BenchmarkResult> {
  const startTime = Date.now();
  
  const result = await service.capturePage(url, viewport, {
    timeout: 60000,
    blockResources: withBlocking,
  });
  
  const durationMs = Date.now() - startTime;
  
  if (result.success) {
    return {
      url,
      viewport,
      withBlocking,
      success: true,
      durationMs,
      screenshotSizeKB: result.screenshot.length / 1024,
      htmlSizeKB: result.html.length / 1024,
    };
  } else {
    return {
      url,
      viewport,
      withBlocking,
      success: false,
      durationMs,
      screenshotSizeKB: 0,
      htmlSizeKB: 0,
    };
  }
}

async function main() {
  console.log('⚡ BENCHMARK — Playwright Performance\n');
  
  // URLs de test Shopify
  const testUrls = [
    'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23',
    'https://www.allbirds.com/products/mens-tree-runners',
  ];
  
  const service = PlaywrightService.getInstance();
  const results: BenchmarkResult[] = [];
  
  try {
    await service.initialize();
    console.log('✅ Navigateur prêt\n');
    
    for (const url of testUrls) {
      const domain = new URL(url).hostname;
      console.log(`\n📍 Test: ${domain}`);
      console.log('─'.repeat(60));
      
      // Test 1: SANS blocage
      console.log('\n🔴 Sans blocage de ressources...');
      const withoutBlocking = await benchmarkCapture(service, url, 'mobile', false);
      console.log(`   ⏱️  Durée: ${withoutBlocking.durationMs}ms`);
      console.log(`   📸 Screenshot: ${withoutBlocking.screenshotSizeKB.toFixed(2)} KB`);
      console.log(`   📄 HTML: ${withoutBlocking.htmlSizeKB.toFixed(2)} KB`);
      results.push(withoutBlocking);
      
      // Attendre 2s entre les tests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test 2: AVEC blocage
      console.log('\n🟢 Avec blocage de ressources...');
      const withBlocking = await benchmarkCapture(service, url, 'mobile', true);
      console.log(`   ⏱️  Durée: ${withBlocking.durationMs}ms`);
      console.log(`   📸 Screenshot: ${withBlocking.screenshotSizeKB.toFixed(2)} KB`);
      console.log(`   📄 HTML: ${withBlocking.htmlSizeKB.toFixed(2)} KB`);
      results.push(withBlocking);
      
      // Calculer le gain
      if (withoutBlocking.success && withBlocking.success) {
        const gain = ((withoutBlocking.durationMs - withBlocking.durationMs) / withoutBlocking.durationMs * 100);
        const gainSeconds = (withoutBlocking.durationMs - withBlocking.durationMs) / 1000;
        
        console.log(`\n   🎯 Gain: ${gain.toFixed(1)}% (${gainSeconds.toFixed(1)}s plus rapide)`);
        
        if (withBlocking.durationMs <= 10000) {
          console.log(`   ✅ Objectif <10s ATTEINT!`);
        } else {
          console.log(`   ⚠️  Objectif <10s: ${(withBlocking.durationMs / 1000).toFixed(1)}s (manque ${((withBlocking.durationMs - 10000) / 1000).toFixed(1)}s)`);
        }
      }
    }
    
    // Résumé global
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 RÉSUMÉ GLOBAL');
    console.log('═'.repeat(60));
    
    const successWithBlocking = results.filter(r => r.withBlocking && r.success);
    const successWithoutBlocking = results.filter(r => !r.withBlocking && r.success);
    
    if (successWithBlocking.length > 0 && successWithoutBlocking.length > 0) {
      const avgWithBlocking = successWithBlocking.reduce((sum, r) => sum + r.durationMs, 0) / successWithBlocking.length;
      const avgWithoutBlocking = successWithoutBlocking.reduce((sum, r) => sum + r.durationMs, 0) / successWithoutBlocking.length;
      
      const globalGain = ((avgWithoutBlocking - avgWithBlocking) / avgWithoutBlocking * 100);
      
      console.log(`\n🔴 Moyenne SANS blocage: ${(avgWithoutBlocking / 1000).toFixed(1)}s`);
      console.log(`🟢 Moyenne AVEC blocage: ${(avgWithBlocking / 1000).toFixed(1)}s`);
      console.log(`\n🎯 Gain moyen: ${globalGain.toFixed(1)}% (${((avgWithoutBlocking - avgWithBlocking) / 1000).toFixed(1)}s)`);
      
      if (avgWithBlocking <= 10000) {
        console.log(`\n✅ OBJECTIF <10s ATTEINT! 🎉`);
      } else {
        console.log(`\n⚠️  Objectif <10s non atteint (${(avgWithBlocking / 1000).toFixed(1)}s)`);
        console.log(`💡 Suggestions:`);
        console.log(`   • Bloquer plus de domaines tiers`);
        console.log(`   • Réduire le timeout lazy-load (actuellement 2s)`);
        console.log(`   • Utiliser 'domcontentloaded' au lieu de 'load'`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Erreur:', error);
  } finally {
    await service.close();
    console.log('\n✅ Benchmark terminé\n');
  }
}

main();
