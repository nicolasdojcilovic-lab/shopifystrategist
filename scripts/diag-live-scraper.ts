/**
 * ⚠️ DIAGNOSTIC LIVE SCRAPER — Validation Extraction Anti-Drift (SSOT)
 * 
 * Script de diagnostic pour valider l'extraction de données sur des boutiques Shopify réelles.
 * 
 * Conformité SSOT:
 * - Respecte strictement REGISTRY.md et .cursorrules
 * - Toute donnée extraite doit correspondre à un criteria_id du registre
 * - Validation spécifique: Prix (number propre) et Bouton ATC (détecté)
 * 
 * Usage:
 *   tsx scripts/diag-live-scraper.ts <URL>
 * 
 * URLs de test (usage manuel):
 * - Gymshark: https://fr.gymshark.com/products/gymshark-straight-leg-pumper-pants-pants
 * - Huel: https://huel.com/products/huel-ready-to-drink
 * - Kylie: https://kyliejennercosmetics.eu/fr-fr/products/skin-tint-blurring-elixir?variant=48721070555472&_gl=1*1kh23bl*_up*MQ..*_ga*MjM3MDcyNzc5LjE3NzAzMDkzMDQ.*_ga_8YY0JDXYDZ*czE3NzAzMDkzMDMkbzEkZzAkdDE3NzAzMDkzMTgkajQ1JGwwJGgw*_ga_7NZX5MX55K*czE3NzAzMDkzMDMkbzEkZzAkdDE3NzAzMDkzMTgkajQ1JGwwJGg2ODk1MTMxNDQ.
 * - Chubbies: https://www.chubbiesshorts.com/products/the-kaleidoscope-the-legacy-shirt
 * - Allbirds: https://www.allbirds.com/products/mens-tree-runners
 */

import 'dotenv/config';
import { PlaywrightService } from '../src/adapters/capture/playwright.service.js';
import { collectFacts } from '../src/core/engine/facts-collector.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Interface pour les problèmes de drift détectés
 */
interface DriftIssue {
  severity: 'P0' | 'P1' | 'P2';
  criteria_id: string; // Doit correspondre à REGISTRY.md
  field: string;
  expected: string;
  actual: string | null;
  message: string;
}

/**
 * Interface pour le rapport de drift
 */
interface DriftReport {
  url: string;
  timestamp: string;
  captureSuccess: boolean;
  captureError?: string;
  factsCollected: boolean;
  issues: DriftIssue[];
  facts: {
    pdp: {
      title: string | null;
      price: string | null;
      currency: string | null;
      hasSalePrice: boolean;
      regularPrice: string | null;
      salePrice: string | null;
      hasAtcButton: boolean;
      atcText: string | null;
      atcButtonCount: number;
      hasVariantSelector: boolean;
      variantTypes: string[];
      inStock: boolean | null;
      stockText: string | null;
      hasDescription: boolean;
      descriptionLength: number;
    };
    structure: {
      h1Count: number;
      mainH1Text: string | null;
      imageCount: number;
    };
    technical: {
      isShopify: boolean;
      themeName: string | null;
      detectedApps: string[];
    };
  } | null;
}

/**
 * Extrait le nombre pur d'un prix (ex: "€49,00" -> 49.00)
 */
function extractPriceNumber(priceString: string | null): number | null {
  if (!priceString) return null;
  
  // Extraire les chiffres et séparateurs décimaux
  const cleaned = priceString
    .replace(/[€$£¥]/g, '') // Supprimer les devises
    .replace(/\s+/g, '') // Supprimer les espaces
    .replace(/\./g, '') // Supprimer les points (séparateurs de milliers)
    .replace(',', '.'); // Remplacer la virgule par un point pour le format numérique
  
  const number = parseFloat(cleaned);
  return isNaN(number) ? null : number;
}

/**
 * Valide que le prix est un number propre
 */
function validatePrice(price: string | null, _currency: string | null): { valid: boolean; issue?: DriftIssue } {
  if (!price) {
    return {
      valid: false,
      issue: {
        severity: 'P0',
        criteria_id: 'C.CORE.PRICE_CLARITY',
        field: 'price',
        expected: 'Prix non null avec format valide (ex: "€49,00" ou "$29.99")',
        actual: null,
        message: 'Prix manquant ou null',
      },
    };
  }

  const priceNumber = extractPriceNumber(price);
  
  if (priceNumber === null) {
    return {
      valid: false,
      issue: {
        severity: 'P0',
        criteria_id: 'C.CORE.PRICE_CLARITY',
        field: 'price',
        expected: 'Prix avec nombre extractible (ex: "€49,00" -> 49.00)',
        actual: price,
        message: `Prix non extractible en nombre: "${price}"`,
      },
    };
  }

  if (priceNumber <= 0) {
    return {
      valid: false,
      issue: {
        severity: 'P1',
        criteria_id: 'C.CORE.PRICE_CLARITY',
        field: 'price',
        expected: 'Prix > 0',
        actual: priceNumber.toString(),
        message: `Prix invalide (<= 0): ${priceNumber}`,
      },
    };
  }

  return { valid: true };
}

/**
 * Valide que le bouton ATC est détecté
 */
function validateAtcButton(hasAtcButton: boolean, _atcText: string | null, atcButtonCount: number): { valid: boolean; issue?: DriftIssue } {
  if (!hasAtcButton) {
    return {
      valid: false,
      issue: {
        severity: 'P0',
        criteria_id: 'C.CORE.CTA',
        field: 'hasAtcButton',
        expected: 'true (bouton ATC détecté)',
        actual: 'false',
        message: 'Bouton Add To Cart non détecté',
      },
    };
  }

  if (atcButtonCount === 0) {
    return {
      valid: false,
      issue: {
        severity: 'P0',
        criteria_id: 'C.CORE.CTA',
        field: 'atcButtonCount',
        expected: '> 0',
        actual: '0',
        message: 'hasAtcButton=true mais atcButtonCount=0 (incohérence)',
      },
    };
  }

  return { valid: true };
}

/**
 * Valide que le titre ne contient pas de retours à la ligne suspects
 */
function validateTitle(title: string | null): { valid: boolean; issue?: DriftIssue } {
  if (!title) {
    return {
      valid: false,
      issue: {
        severity: 'P0',
        criteria_id: 'C.PERS.VALUE_PROP',
        field: 'title',
        expected: 'Titre non null',
        actual: null,
        message: 'Titre manquant',
      },
    };
  }

  // Détecter retours à la ligne suspects (plus d'un retour à la ligne)
  const newlineCount = (title.match(/\n/g) || []).length;
  if (newlineCount > 1) {
    return {
      valid: false,
      issue: {
        severity: 'P0',
        criteria_id: 'C.PERS.VALUE_PROP',
        field: 'title',
        expected: 'Titre sans retours à la ligne multiples',
        actual: title.substring(0, 100) + (title.length > 100 ? '...' : ''),
        message: `Titre contient ${newlineCount} retours à la ligne suspects`,
      },
    };
  }

  return { valid: true };
}

/**
 * Valide que la description n'est pas vide
 */
function validateDescription(hasDescription: boolean, descriptionLength: number): { valid: boolean; issue?: DriftIssue } {
  if (!hasDescription || descriptionLength === 0) {
    return {
      valid: false,
      issue: {
        severity: 'P0',
        criteria_id: 'C.PERS.BENEFITS',
        field: 'description',
        expected: 'Description non vide (length > 0)',
        actual: hasDescription ? `length: ${descriptionLength}` : 'hasDescription: false',
        message: 'Description vide ou manquante',
      },
    };
  }

  return { valid: true };
}

/**
 * Génère un rapport de drift au format Markdown
 */
function generateDriftReport(report: DriftReport): string {
  const lines: string[] = [];

  lines.push('# Rapport de Drift — Diagnostic Live Scraper');
  lines.push('');
  lines.push(`**URL**: ${report.url}`);
  lines.push(`**Timestamp**: ${report.timestamp}`);
  lines.push('');

  // Statut de capture
  lines.push('## Statut de Capture');
  if (report.captureSuccess) {
    lines.push('✅ **Capture réussie**');
  } else {
    lines.push('❌ **Capture échouée**');
    if (report.captureError) {
      lines.push(`   Erreur: ${report.captureError}`);
    }
  }
  lines.push('');

  // Statut de collection de faits
  lines.push('## Collection de Faits');
  if (report.factsCollected) {
    lines.push('✅ **Facts collectés**');
  } else {
    lines.push('❌ **Facts non collectés**');
  }
  lines.push('');

  // Problèmes détectés
  lines.push('## Problèmes Détectés (Drift)');
  if (report.issues.length === 0) {
    lines.push('✅ **Aucun problème détecté**');
  } else {
    lines.push(`⚠️ **${report.issues.length} problème(s) détecté(s)**`);
    lines.push('');
    
    const bySeverity = {
      P0: report.issues.filter((i) => i.severity === 'P0'),
      P1: report.issues.filter((i) => i.severity === 'P1'),
      P2: report.issues.filter((i) => i.severity === 'P2'),
    };

    for (const [severity, issues] of Object.entries(bySeverity)) {
      if (issues.length === 0) continue;
      
      lines.push(`### ${severity} (${issues.length})`);
      lines.push('');
      
      for (const issue of issues) {
        lines.push(`- **${issue.criteria_id}** — ${issue.field}`);
        lines.push(`  - Attendu: ${issue.expected}`);
        lines.push(`  - Actuel: ${issue.actual ?? 'null'}`);
        lines.push(`  - Message: ${issue.message}`);
        lines.push('');
      }
    }
  }
  lines.push('');

  // Faits collectés (résumé)
  if (report.factsCollected && report.facts) {
    lines.push('## Résumé des Faits');
    lines.push('');
    lines.push('### PDP Facts');
    lines.push(`- **Titre**: ${report.facts.pdp.title || 'N/A'}`);
    lines.push(`- **Prix**: ${report.facts.pdp.price || 'N/A'} ${report.facts.pdp.currency || ''}`);
    lines.push(`- **Prix barré**: ${report.facts.pdp.hasSalePrice ? 'Oui' : 'Non'}`);
    if (report.facts.pdp.hasSalePrice) {
      lines.push(`  - Prix régulier: ${report.facts.pdp.regularPrice || 'N/A'}`);
      lines.push(`  - Prix réduit: ${report.facts.pdp.salePrice || 'N/A'}`);
    }
    lines.push(`- **Bouton ATC**: ${report.facts.pdp.hasAtcButton ? '✅ Détecté' : '❌ Non détecté'}`);
    if (report.facts.pdp.hasAtcButton) {
      lines.push(`  - Texte: "${report.facts.pdp.atcText || 'N/A'}"`);
      lines.push(`  - Nombre: ${report.facts.pdp.atcButtonCount}`);
    }
    lines.push(`- **Variants**: ${report.facts.pdp.hasVariantSelector ? 'Oui' : 'Non'}`);
    if (report.facts.pdp.hasVariantSelector) {
      if (report.facts.pdp.variantTypes.length > 0) {
        lines.push(`  - Types: ${report.facts.pdp.variantTypes.join(', ')} (${report.facts.pdp.variantTypes.length} type(s))`);
      } else {
        lines.push(`  - Types: ⚠️ Variants détectés mais types non identifiés`);
      }
    }
    lines.push(`- **En stock**: ${report.facts.pdp.inStock !== null ? (report.facts.pdp.inStock ? 'Oui' : 'Non') : 'Indéterminé'}`);
    if ('stockText' in report.facts.pdp && report.facts.pdp.stockText) {
      lines.push(`  - Texte stock: "${report.facts.pdp.stockText}"`);
    }
    lines.push(`- **Description**: ${report.facts.pdp.hasDescription ? 'Oui' : 'Non'}`);
    if (report.facts.pdp.hasDescription) {
      lines.push(`  - Longueur: ${report.facts.pdp.descriptionLength} caractères`);
      if (report.facts.pdp.descriptionLength < 100) {
        lines.push(`  - ⚠️ Description courte (< 100 chars)`);
      } else if (report.facts.pdp.descriptionLength > 1000) {
        lines.push(`  - ✅ Description détaillée (> 1000 chars)`);
      }
    }
    lines.push('');
    
    lines.push('### Structure Facts');
    lines.push(`- **H1**: ${report.facts.structure.h1Count} (Principal: "${report.facts.structure.mainH1Text || 'N/A'}")`);
    lines.push(`- **Images**: ${report.facts.structure.imageCount}`);
    lines.push('');
    
    lines.push('### Technical Facts');
    lines.push(`- **Shopify**: ${report.facts.technical.isShopify ? '✅' : '❌'}`);
    lines.push(`- **Thème**: ${report.facts.technical.themeName || 'N/A'}`);
    lines.push(`- **Apps détectées**: ${report.facts.technical.detectedApps.length}`);
    if (report.facts.technical.detectedApps.length > 0) {
      report.facts.technical.detectedApps.forEach((app) => {
        lines.push(`  - ${app}`);
      });
    }
    lines.push('');
  }

  // Recommandations
  if (report.issues.length > 0) {
    lines.push('## Recommandations');
    lines.push('');
    const p0Issues = report.issues.filter((i) => i.severity === 'P0');
    if (p0Issues.length > 0) {
      lines.push('### Actions P0 (Bloquantes)');
      lines.push('');
      p0Issues.forEach((issue) => {
        lines.push(`1. **${issue.criteria_id}**: ${issue.message}`);
        lines.push(`   - Vérifier les sélecteurs dans \`facts-collector.ts\``);
        lines.push(`   - Tester avec différents thèmes Shopify`);
        lines.push('');
      });
    }
  }

  return lines.join('\n');
}

/**
 * Affiche un tableau récapitulatif des faits
 */
function displayFactsTable(facts: DriftReport['facts']): void {
  if (!facts) {
    console.log('❌ Aucun fait disponible');
    return;
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 TABLEAU RÉCAPITULATIF DES FAITS');
  console.log('═'.repeat(80));
  console.log('');

  // PDP Facts
  console.log('📦 PDP Facts:');
  console.log(`   ${'─'.repeat(76)}`);
  console.log(`   Titre:              ${facts.pdp.title || '❌ N/A'}`);
  console.log(`   Prix:               ${facts.pdp.price || '❌ N/A'} ${facts.pdp.currency || ''}`);
  
  if (facts.pdp.hasSalePrice) {
    console.log(`   Prix régulier:      ${facts.pdp.regularPrice || 'N/A'}`);
    console.log(`   Prix réduit:        ${facts.pdp.salePrice || 'N/A'}`);
  }
  
  console.log(`   Bouton ATC:         ${facts.pdp.hasAtcButton ? '✅ Oui' : '❌ Non'}`);
  if (facts.pdp.hasAtcButton) {
    console.log(`   ATC Texte:          "${facts.pdp.atcText || 'N/A'}"`);
    console.log(`   ATC Nombre:         ${facts.pdp.atcButtonCount}`);
  }
  
  console.log(`   Variants:           ${facts.pdp.hasVariantSelector ? '✅ Oui' : '❌ Non'}`);
  if (facts.pdp.hasVariantSelector) {
    if (facts.pdp.variantTypes.length > 0) {
      console.log(`   Types de variants:  ${facts.pdp.variantTypes.join(', ')} (${facts.pdp.variantTypes.length} type(s))`);
    } else {
      console.log(`   Types de variants:  ⚠️  Variants détectés mais types non identifiés`);
    }
  }
  
  console.log(`   En stock:           ${facts.pdp.inStock !== null ? (facts.pdp.inStock ? '✅ Oui' : '❌ Non') : '❓ Indéterminé'}`);
  if ('stockText' in facts.pdp && facts.pdp.stockText) {
    console.log(`   Texte stock:        "${facts.pdp.stockText}"`);
  }
  
  console.log(`   Description:        ${facts.pdp.hasDescription ? '✅ Oui' : '❌ Non'}`);
  if (facts.pdp.hasDescription) {
    console.log(`   Longueur:           ${facts.pdp.descriptionLength} caractères`);
    if (facts.pdp.descriptionLength < 100) {
      console.log(`   ⚠️  Description courte (< 100 chars)`);
    } else if (facts.pdp.descriptionLength > 1000) {
      console.log(`   ✅ Description détaillée (> 1000 chars)`);
    }
  }
  console.log('');

  // Structure Facts
  console.log('🏗️  Structure Facts:');
  console.log(`   ${'─'.repeat(76)}`);
  console.log(`   H1:                 ${facts.structure.h1Count} (Principal: "${facts.structure.mainH1Text || 'N/A'}")`);
  console.log(`   Images:              ${facts.structure.imageCount}`);
  console.log('');

  // Technical Facts
  console.log('⚙️  Technical Facts:');
  console.log(`   ${'─'.repeat(76)}`);
  console.log(`   Shopify:             ${facts.technical.isShopify ? '✅ Oui' : '❌ Non'}`);
  console.log(`   Thème:               ${facts.technical.themeName || 'N/A'}`);
  console.log(`   Apps détectées:      ${facts.technical.detectedApps.length}`);
  if (facts.technical.detectedApps.length > 0) {
    facts.technical.detectedApps.forEach((app) => {
      console.log(`     - ${app}`);
    });
  }
  console.log('');
}

async function main() {
  // Récupérer l'URL depuis les arguments
  const url = process.argv[2];

  if (!url) {
    console.error('❌ Erreur: URL requise');
    console.error('');
    console.error('Usage:');
    console.error('  tsx scripts/diag-live-scraper.ts <URL>');
    console.error('');
    console.error('URLs de test (exemples):');
    console.error('  - Gymshark: https://www.gymshark.com/products/gymshark-speed-t-shirt-black-aw23');
    console.error('  - Huel: https://huel.com/products/huel-ready-to-drink');
    console.error('  - Kylie: https://kyliecosmetics.com/en-fr/products/matte-liquid-lipstick');
    console.error('  - Chubbies: https://www.chubbiesshorts.com/products/the-everydays-elastic-waist-short-6-khaki');
    console.error('  - Allbirds: https://www.allbirds.com/products/mens-tree-runners');
    process.exit(1);
  }

  console.log('🔍 DIAGNOSTIC LIVE SCRAPER — Validation Extraction Anti-Drift');
  console.log('═'.repeat(80));
  console.log(`📍 URL: ${url}`);
  console.log('');

  const report: DriftReport = {
    url,
    timestamp: new Date().toISOString(),
    captureSuccess: false,
    factsCollected: false,
    issues: [],
    facts: null,
  };

  const service = PlaywrightService.getInstance();
  let html: string | null = null;

  try {
    // Initialiser Playwright
    console.log('⏳ Initialisation de Playwright...');
    await service.initialize();
    console.log('✅ Playwright initialisé\n');

    // Capture avec stratégie domcontentloaded
    console.log('📸 Capture de la page (domcontentloaded)...');
    const captureResult = await service.capturePage(url, 'desktop', {
      timeout: 30000, // 30s timeout
      blockResources: true, // Bloquer ressources non essentielles
    });

    if (!captureResult.success) {
      report.captureError = captureResult.error.message || 'Erreur inconnue';
      console.error(`❌ Capture échouée: ${report.captureError}`);
      throw new Error(`Capture failed: ${report.captureError}`);
    }

    report.captureSuccess = true;
    html = captureResult.html;
    console.log(`✅ Capture réussie (${html.length} chars HTML)`);
    console.log(`   Durée: ${captureResult.metadata.loadDurationMs}ms\n`);

    // Sauvegarder le HTML
    const tempDir = join(process.cwd(), 'temp');
    mkdirSync(tempDir, { recursive: true });
    const htmlPath = join(tempDir, 'diag_last_run.html');
    writeFileSync(htmlPath, html, 'utf8');
    console.log(`💾 HTML sauvegardé: ${htmlPath}\n`);

    // Collection de faits
    console.log('🔍 Collection de faits...');
    const facts = await collectFacts(html, {
      strictMode: true,
      locale: 'en',
    });

    report.factsCollected = true;
    report.facts = {
      pdp: facts.pdp,
      structure: {
        h1Count: facts.structure.h1Count,
        mainH1Text: facts.structure.mainH1Text,
        imageCount: facts.structure.imageCount,
      },
      technical: {
        isShopify: facts.technical.isShopify,
        themeName: facts.technical.themeName,
        detectedApps: facts.technical.detectedApps,
      },
    };

    console.log(`✅ Facts collectés (${facts.meta.parsingDuration}ms)\n`);

    // Validation Anti-Drift
    console.log('🔍 Validation Anti-Drift...');
    console.log('');

    // Validation Prix
    const priceValidation = validatePrice(facts.pdp.price, facts.pdp.currency);
    if (!priceValidation.valid && priceValidation.issue) {
      report.issues.push(priceValidation.issue);
      console.log(`❌ Prix: ${priceValidation.issue.message}`);
    } else {
      const priceNumber = extractPriceNumber(facts.pdp.price);
      console.log(`✅ Prix: ${facts.pdp.price} (${priceNumber !== null ? `number: ${priceNumber}` : 'N/A'})`);
    }

    // Validation Bouton ATC
    const atcValidation = validateAtcButton(
      facts.pdp.hasAtcButton,
      facts.pdp.atcText,
      facts.pdp.atcButtonCount
    );
    if (!atcValidation.valid && atcValidation.issue) {
      report.issues.push(atcValidation.issue);
      console.log(`❌ Bouton ATC: ${atcValidation.issue.message}`);
    } else {
      console.log(`✅ Bouton ATC: Détecté (${facts.pdp.atcButtonCount} bouton(s), texte: "${facts.pdp.atcText || 'N/A'}")`);
    }

    // Validation Titre (retours à la ligne suspects)
    const titleValidation = validateTitle(facts.pdp.title);
    if (!titleValidation.valid && titleValidation.issue) {
      report.issues.push(titleValidation.issue);
      console.log(`❌ Titre: ${titleValidation.issue.message}`);
    } else {
      console.log(`✅ Titre: "${facts.pdp.title || 'N/A'}"`);
    }

    // Validation Description (non vide)
    const descriptionValidation = validateDescription(facts.pdp.hasDescription, facts.pdp.descriptionLength);
    if (!descriptionValidation.valid && descriptionValidation.issue) {
      report.issues.push(descriptionValidation.issue);
      console.log(`❌ Description: ${descriptionValidation.issue.message}`);
    } else {
      const source = facts.meta?.descriptionSource || 'Unknown';
      console.log(`✅ Description: ${facts.pdp.hasDescription ? 'Oui' : 'Non'} (${facts.pdp.descriptionLength} chars)`);
      console.log(`   Source: ${source}`);
    }

    console.log('');

    // Afficher le tableau récapitulatif
    displayFactsTable(report.facts);

    // Fermer Playwright
    await service.close();

  } catch (error) {
    console.error(`\n❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    
    // Fermer Playwright en cas d'erreur
    try {
      await service.close();
    } catch {
      // Ignorer les erreurs de fermeture
    }
  }

  // Générer le rapport de drift si nécessaire
  if (report.issues.length > 0 || !report.captureSuccess || !report.factsCollected) {
    const reportsDir = join(process.cwd(), 'tmp', 'cursor-reports');
    mkdirSync(reportsDir, { recursive: true });
    
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportPath = join(reportsDir, `${dateStr}_DIAG_SCRAPER.md`);
    
    const reportMarkdown = generateDriftReport(report);
    writeFileSync(reportPath, reportMarkdown, 'utf8');
    
    console.log('═'.repeat(80));
    console.log('📄 RAPPORT DE DRIFT GÉNÉRÉ');
    console.log('═'.repeat(80));
    console.log(`📁 Fichier: ${reportPath}`);
    console.log(`⚠️  ${report.issues.length} problème(s) détecté(s)`);
    console.log('');
  } else {
    console.log('═'.repeat(80));
    console.log('✅ VALIDATION RÉUSSIE — Aucun drift détecté');
    console.log('═'.repeat(80));
    console.log('');
  }

  // Code de sortie
  const hasP0Issues = report.issues.some((i) => i.severity === 'P0');
  process.exit(hasP0Issues ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
