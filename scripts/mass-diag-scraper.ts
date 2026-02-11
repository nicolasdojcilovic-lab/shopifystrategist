/**
 * ⚠️ MASS DIAGNOSTIC SCRAPER — Test Automatisé Multi-Sites (SSOT)
 * 
 * Script de diagnostic en masse pour tester l'extraction sur plusieurs sites Shopify.
 * 
 * Conformité SSOT:
 * - Respecte strictement REGISTRY.md et .cursorrules
 * - Réutilise PlaywrightService et collectFacts (DRY)
 * - Génère un rapport de synthèse globale avec matrice de comparaison
 * 
 * Usage:
 *   tsx scripts/mass-diag-scraper.ts
 */

import 'dotenv/config';
import { PlaywrightService } from '../src/adapters/capture/playwright.service.js';
import { collectFacts } from '../src/core/engine/facts-collector.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * URLs de test cibles
 */
const TEST_TARGETS = [
  {
    name: 'Gymshark',
    url: 'https://fr.gymshark.com/products/gymshark-straight-leg-pumper-pants-pants',
  },
  {
    name: 'Allbirds',
    url: 'https://www.allbirds.com/products/mens-tree-runners',
  },
  {
    name: 'Huel',
    url: 'https://huel.com/products/huel-ready-to-drink',
  },
  {
    name: 'Kylie',
    url: 'https://kyliejennercosmetics.eu/fr-fr/products/skin-tint-blurring-elixir?variant=48721070555472&_gl=1*1kh23bl*_up*MQ..*_ga*MjM3MDcyNzc5LjE3NzAzMDkzMDQ.*_ga_8YY0JDXYDZ*czE3NzAzMDkzMDMkbzEkZzAkdDE3NzAzMDkzMTgkajQ1JGwwJGgw*_ga_7NZX5MX55K*czE3NzAzMDkzMDMkbzEkZzAkdDE3NzAzMDkzMTgkajQ1JGwwJGg2ODk1MTMxNDQ',
  },
  {
    name: 'Chubbies',
    url: 'https://www.chubbiesshorts.com/products/the-kaleidoscope-the-legacy-shirt',
  },
];

/** Type des facts complètes (pour sortie JSON validation Scoring v1.1) */
type FullFacts = Awaited<ReturnType<typeof collectFacts>>;

/**
 * Interface pour les résultats d'un site
 */
interface SiteResult {
  name: string;
  url: string;
  status: 'OK' | 'KO';
  captureSuccess: boolean;
  captureError?: string;
  factsCollected: boolean;
  price: string | null;
  atcDetected: boolean;
  atcText: string | null;
  descriptionLength: number;
  variantsCount: number;
  responseTimeMs: number;
  captureDurationMs: number;
  parsingDurationMs: number;
  descriptionSource?: string;
  /** Scoring Engine v1.1 */
  stickyAtcPresenceMobile?: boolean;
  variantSelectionComplexityClicks?: number;
  trustBadgesNearAtc?: boolean;
  lcpMs?: number;
  networkBlockingScriptCount?: number;
  fullFacts?: FullFacts;
  issues: Array<{
    severity: 'P0' | 'P1' | 'P2';
    field: string;
    message: string;
  }>;
}

/**
 * Extrait le nombre pur d'un prix (ex: "€49,00" -> 49.00)
 */
function extractPriceNumber(priceString: string | null): number | null {
  if (!priceString) return null;
  
  const cleaned = priceString
    .replace(/[€$£¥]/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const number = parseFloat(cleaned);
  return isNaN(number) ? null : number;
}

/**
 * Valide les champs P0 (prix, ATC, description)
 */
function validateP0Fields(facts: Awaited<ReturnType<typeof collectFacts>>): Array<{
  severity: 'P0' | 'P1' | 'P2';
  field: string;
  message: string;
}> {
  const issues: Array<{ severity: 'P0' | 'P1' | 'P2'; field: string; message: string }> = [];

  // Validation Prix
  if (!facts.pdp.price) {
    issues.push({
      severity: 'P0',
      field: 'price',
      message: 'Prix manquant',
    });
  } else {
    const priceNumber = extractPriceNumber(facts.pdp.price);
    if (priceNumber === null || priceNumber <= 0) {
      issues.push({
        severity: 'P0',
        field: 'price',
        message: `Prix invalide: ${facts.pdp.price}`,
      });
    }
  }

  // Validation ATC
  if (!facts.pdp.hasAtcButton) {
    issues.push({
      severity: 'P0',
      field: 'hasAtcButton',
      message: 'Bouton ATC non détecté',
    });
  }

  // Validation Description
  if (!facts.pdp.hasDescription || facts.pdp.descriptionLength === 0) {
    issues.push({
      severity: 'P0',
      field: 'description',
      message: 'Description vide ou manquante',
    });
  }

  // Validation Titre (retours à la ligne suspects)
  if (facts.pdp.title) {
    const newlineCount = (facts.pdp.title.match(/\n/g) || []).length;
    if (newlineCount > 1) {
      issues.push({
        severity: 'P0',
        field: 'title',
        message: `Titre contient ${newlineCount} retours à la ligne suspects`,
      });
    }
  }

  return issues;
}

/**
 * Traite un site individuel
 */
async function processSite(
  target: typeof TEST_TARGETS[0],
  service: PlaywrightService,
  index: number,
  total: number
): Promise<SiteResult> {
  console.log(`\n[${index + 1}/${total}] 🔍 Traitement: ${target.name}`);
  console.log(`   URL: ${target.url}`);
  console.log('   ' + '─'.repeat(76));

  const startTime = Date.now();
  const result: SiteResult = {
    name: target.name,
    url: target.url,
    status: 'KO',
    captureSuccess: false,
    factsCollected: false,
    price: null,
    atcDetected: false,
    atcText: null,
    descriptionLength: 0,
    variantsCount: 0,
    responseTimeMs: 0,
    captureDurationMs: 0,
    parsingDurationMs: 0,
    issues: [],
  };

  try {
    // Capture
    const captureStart = Date.now();
    const captureResult = await service.capturePage(target.url, 'desktop', {
      timeout: 30000,
      blockResources: true,
    });
    result.captureDurationMs = Date.now() - captureStart;

    if (!captureResult.success) {
      result.captureError = captureResult.error?.message || 'Erreur inconnue';
      console.log(`   ❌ Capture échouée: ${result.captureError}`);
      result.responseTimeMs = Date.now() - startTime;
      return result;
    }

    result.captureSuccess = true;
    const html = captureResult.html;
    console.log(`   ✅ Capture réussie (${html.length} chars, ${result.captureDurationMs}ms)`);

    // Collection de faits (LCP passé depuis la capture — Scoring Engine v1.1)
    const factsStart = Date.now();
    const lcpMs = captureResult.metadata?.lcpMs;
    const facts = await collectFacts(html, {
      strictMode: true,
      locale: 'en',
      ...(lcpMs != null && { performanceMetrics: { lcpMs } }),
    });
    result.parsingDurationMs = Date.now() - factsStart;

    result.factsCollected = true;
    result.price = facts.pdp.price;
    result.atcDetected = facts.pdp.hasAtcButton;
    result.atcText = facts.pdp.atcText;
    result.descriptionLength = facts.pdp.descriptionLength;
    result.variantsCount = facts.pdp.variantTypes.length;
    if (facts.pdp.stickyAtcPresenceMobile !== undefined) result.stickyAtcPresenceMobile = facts.pdp.stickyAtcPresenceMobile;
    if (facts.pdp.variantSelectionComplexityClicks !== undefined) result.variantSelectionComplexityClicks = facts.pdp.variantSelectionComplexityClicks;
    if (facts.structure.trustBadgesNearAtc !== undefined) result.trustBadgesNearAtc = facts.structure.trustBadgesNearAtc;
    if (facts.technical.lcpMs !== undefined) result.lcpMs = facts.technical.lcpMs;
    if (facts.technical.networkBlockingScriptCount !== undefined) result.networkBlockingScriptCount = facts.technical.networkBlockingScriptCount;
    result.fullFacts = facts;
    if (facts.meta.descriptionSource) {
      result.descriptionSource = facts.meta.descriptionSource;
    }

    // Validation P0
    result.issues = validateP0Fields(facts);

    // Déterminer le status
    const p0Issues = result.issues.filter((i) => i.severity === 'P0');
    result.status = p0Issues.length === 0 ? 'OK' : 'KO';

    result.responseTimeMs = Date.now() - startTime;

    // Afficher résumé
    console.log(`   ✅ Facts collectés (${result.parsingDurationMs}ms)`);
    console.log(`   📊 Prix: ${result.price || 'N/A'}`);
    console.log(`   🛒 ATC: ${result.atcDetected ? '✅ Oui' : '❌ Non'}`);
    console.log(`   📝 Description: ${result.descriptionLength} chars (Source: ${result.descriptionSource || 'N/A'})`);
    console.log(`   🎨 Variants: ${result.variantsCount}`);
    console.log(`   ⏱️  Temps total: ${result.responseTimeMs}ms`);
    
    if (result.issues.length > 0) {
      console.log(`   ⚠️  ${result.issues.length} problème(s) détecté(s)`);
      result.issues.forEach((issue) => {
        console.log(`      - [${issue.severity}] ${issue.field}: ${issue.message}`);
      });
    } else {
      console.log(`   ✅ Aucun problème détecté`);
    }

  } catch (error) {
    result.captureError = error instanceof Error ? error.message : 'Erreur inconnue';
    result.responseTimeMs = Date.now() - startTime;
    console.log(`   ❌ Erreur: ${result.captureError}`);
  }

  return result;
}

/**
 * Génère le rapport de synthèse globale
 */
function generateGlobalSynthesis(results: SiteResult[]): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  lines.push('# Synthèse Globale — Mass Diagnostic Scraper');
  lines.push('');
  lines.push(`**Date**: ${timestamp}`);
  lines.push(`**Sites testés**: ${results.length}`);
  lines.push('');

  // Statistiques globales
  const okCount = results.filter((r) => r.status === 'OK').length;
  const koCount = results.filter((r) => r.status === 'KO').length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length;
  const avgCaptureTime = results.reduce((sum, r) => sum + r.captureDurationMs, 0) / results.length;
  const avgParsingTime = results.reduce((sum, r) => sum + r.parsingDurationMs, 0) / results.length;

  lines.push('## Statistiques Globales');
  lines.push('');
  lines.push(`- **Sites OK**: ${okCount}/${results.length} (${Math.round((okCount / results.length) * 100)}%)`);
  lines.push(`- **Sites KO**: ${koCount}/${results.length} (${Math.round((koCount / results.length) * 100)}%)`);
  lines.push(`- **Temps de réponse moyen**: ${Math.round(avgResponseTime)}ms`);
  lines.push(`- **Temps de capture moyen**: ${Math.round(avgCaptureTime)}ms`);
  lines.push(`- **Temps de parsing moyen**: ${Math.round(avgParsingTime)}ms`);
  lines.push('');

  // Tableau de comparaison (Matrice)
  lines.push('## Tableau de Comparaison');
  lines.push('');
  lines.push('| Site | Status | Prix | ATC | Description | Variants | Capture (ms) | Parsing (ms) | Total (ms) |');
  lines.push('|------|--------|------|-----|-------------|----------|--------------|--------------|------------|');

  for (const result of results) {
    const priceDisplay = result.price || '❌ N/A';
    const atcDisplay = result.atcDetected ? '✅ Oui' : '❌ Non';
    const descDisplay = result.descriptionLength > 0 
      ? `${result.descriptionLength} chars` 
      : '❌ Vide';
    const variantsDisplay = result.variantsCount > 0 
      ? `${result.variantsCount}` 
      : '0';
    const statusDisplay = result.status === 'OK' ? '✅ OK' : '❌ KO';
    
    lines.push(
      `| ${result.name} | ${statusDisplay} | ${priceDisplay} | ${atcDisplay} | ${descDisplay} | ${variantsDisplay} | ${result.captureDurationMs} | ${result.parsingDurationMs} | ${result.responseTimeMs} |`
    );
  }
  lines.push('');

  // Alertes P0
  const p0Sites = results.filter((r) => {
    const p0Issues = r.issues.filter((i) => i.severity === 'P0');
    return p0Issues.length > 0;
  });

  if (p0Sites.length > 0) {
    lines.push('## ⚠️ Alertes P0 (Bloquantes)');
    lines.push('');
    lines.push(`**${p0Sites.length} site(s) avec problèmes P0:**`);
    lines.push('');

    for (const site of p0Sites) {
      const p0Issues = site.issues.filter((i) => i.severity === 'P0');
      lines.push(`### ${site.name}`);
      lines.push(`- **URL**: ${site.url}`);
      lines.push(`- **Status**: ❌ KO`);
      lines.push(`- **Problèmes P0**:`);
      p0Issues.forEach((issue) => {
        lines.push(`  - **${issue.field}**: ${issue.message}`);
      });
      lines.push('');
    }
  } else {
    lines.push('## ✅ Aucune Alerte P0');
    lines.push('');
    lines.push('Tous les sites ont passé les validations P0 avec succès.');
    lines.push('');
  }

  // Détails par site
  lines.push('## Détails par Site');
  lines.push('');

  for (const result of results) {
    lines.push(`### ${result.name}`);
    lines.push(`- **URL**: ${result.url}`);
    lines.push(`- **Status**: ${result.status === 'OK' ? '✅ OK' : '❌ KO'}`);
    lines.push(`- **Capture**: ${result.captureSuccess ? '✅ Réussie' : '❌ Échouée'}`);
    if (result.captureError) {
      lines.push(`  - Erreur: ${result.captureError}`);
    }
    lines.push(`- **Facts collectés**: ${result.factsCollected ? '✅ Oui' : '❌ Non'}`);
    lines.push(`- **Prix**: ${result.price || 'N/A'}`);
    lines.push(`- **ATC détecté**: ${result.atcDetected ? '✅ Oui' : '❌ Non'}`);
    if (result.atcText) {
      lines.push(`  - Texte: "${result.atcText}"`);
    }
    lines.push(`- **Description**: ${result.descriptionLength} caractères`);
    if (result.descriptionSource) {
      lines.push(`  - Source: ${result.descriptionSource}`);
    }
    lines.push(`- **Variants**: ${result.variantsCount} type(s)`);
    lines.push(`- **Temps de capture**: ${result.captureDurationMs}ms`);
    lines.push(`- **Temps de parsing**: ${result.parsingDurationMs}ms`);
    lines.push(`- **Temps total**: ${result.responseTimeMs}ms`);
    
    if (result.issues.length > 0) {
      lines.push(`- **Problèmes détectés**: ${result.issues.length}`);
      result.issues.forEach((issue) => {
        lines.push(`  - [${issue.severity}] ${issue.field}: ${issue.message}`);
      });
    } else {
      lines.push(`- **Problèmes détectés**: Aucun`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Affiche un tableau récapitulatif dans la console
 */
function displaySummaryTable(results: SiteResult[]): void {
  console.log('\n' + '═'.repeat(100));
  console.log('📊 TABLEAU RÉCAPITULATIF — Synthèse Globale');
  console.log('═'.repeat(100));
  console.log('');

  // En-têtes
  console.log(
    'Site'.padEnd(12) +
    'Status'.padEnd(8) +
    'Prix'.padEnd(15) +
    'ATC'.padEnd(6) +
    'Description'.padEnd(15) +
    'Variants'.padEnd(10) +
    'Capture'.padEnd(10) +
    'Parsing'.padEnd(10) +
    'Total'.padEnd(10)
  );
  console.log('─'.repeat(100));

  // Lignes de données
  for (const result of results) {
    const priceDisplay = result.price ? result.price.substring(0, 12) : 'N/A';
    const atcDisplay = result.atcDetected ? '✅' : '❌';
    const descDisplay = result.descriptionLength > 0 
      ? `${result.descriptionLength} chars` 
      : 'Vide';
    const statusDisplay = result.status === 'OK' ? '✅ OK' : '❌ KO';

    console.log(
      result.name.padEnd(12) +
      statusDisplay.padEnd(8) +
      priceDisplay.padEnd(15) +
      atcDisplay.padEnd(6) +
      descDisplay.padEnd(15) +
      result.variantsCount.toString().padEnd(10) +
      `${result.captureDurationMs}ms`.padEnd(10) +
      `${result.parsingDurationMs}ms`.padEnd(10) +
      `${result.responseTimeMs}ms`.padEnd(10)
    );
  }

  console.log('─'.repeat(100));

  // Statistiques
  const okCount = results.filter((r) => r.status === 'OK').length;
  const koCount = results.filter((r) => r.status === 'KO').length;
  const avgResponseTime = Math.round(
    results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length
  );
  const p0Sites = results.filter((r) => {
    const p0Issues = r.issues.filter((i) => i.severity === 'P0');
    return p0Issues.length > 0;
  });

  console.log('');
  console.log('📈 Statistiques:');
  console.log(`   ✅ Sites OK: ${okCount}/${results.length} (${Math.round((okCount / results.length) * 100)}%)`);
  console.log(`   ❌ Sites KO: ${koCount}/${results.length} (${Math.round((koCount / results.length) * 100)}%)`);
  console.log(`   ⚠️  Sites avec P0: ${p0Sites.length}`);
  console.log(`   ⏱️  Temps moyen: ${avgResponseTime}ms`);
  console.log('');
}

async function main() {
  console.log('🚀 MASS DIAGNOSTIC SCRAPER — Test Automatisé Multi-Sites');
  console.log('═'.repeat(100));
  console.log(`📋 ${TEST_TARGETS.length} site(s) à tester`);
  console.log('');

  const service = PlaywrightService.getInstance();
  const results: SiteResult[] = [];

  try {
    // Initialiser Playwright une seule fois
    console.log('⏳ Initialisation de Playwright...');
    await service.initialize();
    console.log('✅ Playwright initialisé\n');

    // Traiter chaque site en série avec délai de 2s
    for (let i = 0; i < TEST_TARGETS.length; i++) {
      const target = TEST_TARGETS[i];
      if (!target) continue;
      const result = await processSite(target, service, i, TEST_TARGETS.length);
      results.push(result);

      // Délai de 2s entre chaque site (sauf pour le dernier)
      if (i < TEST_TARGETS.length - 1) {
        console.log('\n   ⏳ Délai de 2s avant le site suivant...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Fermer Playwright
    await service.close();

  } catch (error) {
    console.error(`\n❌ Erreur fatale: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    
    // Fermer Playwright en cas d'erreur
    try {
      await service.close();
    } catch {
      // Ignorer les erreurs de fermeture
    }
    
    process.exit(1);
  }

  // Afficher le tableau récapitulatif
  displaySummaryTable(results);

  // Générer le rapport de synthèse globale
  const reportsDir = join(process.cwd(), 'tmp', 'cursor-reports');
  mkdirSync(reportsDir, { recursive: true });
  
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const reportPath = join(reportsDir, `${dateStr}_GLOBAL_SYNTHESIS.md`);
  
  const synthesis = generateGlobalSynthesis(results);
  writeFileSync(reportPath, synthesis, 'utf8');

  // JSON des facts (validation Scoring Engine v1.1 — champs stickyAtc, variantComplexity, trustBadges, lcpMs, networkBlockingScriptCount)
  const factsJsonPath = join(reportsDir, `${dateStr}_facts.json`);
  const factsForJson = results
    .filter((r) => r.fullFacts)
    .map((r) => ({ name: r.name, url: r.url, facts: r.fullFacts }));
  writeFileSync(factsJsonPath, JSON.stringify(factsForJson, null, 2), 'utf8');
  console.log(`📁 Facts JSON: ${factsJsonPath}`);

  console.log('═'.repeat(100));
  console.log('📄 RAPPORT DE SYNTHÈSE GLOBALE GÉNÉRÉ');
  console.log('═'.repeat(100));
  console.log(`📁 Fichier: ${reportPath}`);
  console.log('');

  // Code de sortie basé sur les résultats P0
  const hasP0Issues = results.some((r) => {
    const p0Issues = r.issues.filter((i) => i.severity === 'P0');
    return p0Issues.length > 0;
  });

  process.exit(hasP0Issues ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
