/**
 * Script de Validation Réelle (End-to-End)
 * 
 * Ce script lance un audit complet sur une PDP Shopify réelle
 * et valide l'intégrité complète de la chaîne:
 * - Capture Playwright
 * - Facts Collection
 * - Validation Artefacts
 * - Persistence Prisma
 * - Récupération DB
 * 
 * Usage:
 *   npm run verify:real-pdp
 */

import 'dotenv/config';
import { AuditService } from '../src/core/pipeline/audit.service.js';
import { prisma } from '../src/lib/prisma.js';
import { validateArtefactsSafe } from '../src/contracts/internal/artefacts.schema.js';

const REAL_PDPS = [
  {
    name: 'Gymshark',
    url: 'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23',
  },
  {
    name: 'Allbirds',
    url: 'https://www.allbirds.com/products/mens-tree-runners',
  },
];

async function main() {
  console.log('🔍 VALIDATION RÉELLE END-TO-END — PDP Shopify\n');
  console.log('='.repeat(80));
  console.log('Phase P2 — Blindage Stockage & Validation');
  console.log('='.repeat(80));

  const auditService = new AuditService();

  for (const pdp of REAL_PDPS) {
    console.log(`\n📍 Test PDP: ${pdp.name}`);
    console.log(`   URL: ${pdp.url}`);
    console.log(`   ${'─'.repeat(76)}`);

    try {
      // ============================================================================
      // ÉTAPE 1: Audit Complet
      // ============================================================================
      console.log('\n⏳ Lancement de l\'audit...');
      const startTime = Date.now();

      const result = await auditService.runSoloAudit(pdp.url, {
        locale: 'fr',
        copyReady: false,
      });

      const auditDuration = Date.now() - startTime;

      console.log(`✅ Audit terminé en ${auditDuration}ms`);
      console.log(`   • Status: ${result.status}`);
      console.log(`   • From Cache: ${result.fromCache}`);
      console.log(`   • Errors: ${result.errors.length}`);

      // ============================================================================
      // ÉTAPE 2: Récupération depuis DB
      // ============================================================================
      console.log('\n🔍 Récupération du ScoreRun depuis la DB...');

      const scoreRun = await prisma.scoreRun.findUnique({
        where: { runKey: result.keys.runKey },
        include: {
          snapshot: {
            include: {
              sources: true,
            },
          },
        },
      });

      if (!scoreRun) {
        console.error('❌ ScoreRun introuvable en DB!');
        continue;
      }

      console.log('✅ ScoreRun récupéré');
      console.log(`   • Run Key: ${scoreRun.runKey}`);
      console.log(`   • Status: ${scoreRun.status}`);
      console.log(`   • Completed At: ${scoreRun.completedAt?.toISOString()}`);

      // ============================================================================
      // ÉTAPE 3: Validation des Artefacts
      // ============================================================================
      console.log('\n🔍 Validation des artefacts...');

      const pageASource = scoreRun.snapshot.sources.find((s) => s.source === 'page_a');

      if (!pageASource) {
        console.error('❌ SnapshotSource (page_a) introuvable!');
        continue;
      }

      const artefacts = pageASource.artefacts as Record<string, unknown>;

      // Validation Zod
      const validation = validateArtefactsSafe(artefacts);

      if (validation.success) {
        console.log('✅ Artefacts valides (Zod Schema OK)');

        const validatedArtefacts = validation.data;

        // Analyse des artefacts
        console.log('\n📊 ANALYSE DES ARTEFACTS:');
        console.log('─'.repeat(80));

        // Screenshots
        const mobileScreenshot = validatedArtefacts.screenshot_refs.mobile?.screenshot;
        const desktopScreenshot = validatedArtefacts.screenshot_refs.desktop?.screenshot;

        console.log('\n📸 Screenshots:');
        console.log(`   • Mobile: ${mobileScreenshot ? '✅ OK' : '❌ Manquant'}`);
        if (mobileScreenshot) {
          console.log(`     → ${mobileScreenshot}`);
        }
        console.log(`   • Desktop: ${desktopScreenshot ? '✅ OK' : '❌ Manquant'}`);
        if (desktopScreenshot) {
          console.log(`     → ${desktopScreenshot}`);
        }

        // HTML Refs
        const mobileHtml = validatedArtefacts.html_refs.mobile;
        const desktopHtml = validatedArtefacts.html_refs.desktop;

        console.log('\n📄 HTML:');
        console.log(`   • Mobile: ${mobileHtml ? '✅ OK' : '❌ Manquant'}`);
        console.log(`   • Desktop: ${desktopHtml ? '✅ OK' : '❌ Manquant'}`);

        // Facts
        const facts = validatedArtefacts.facts;

        console.log('\n🔍 Facts Collectés:');
        if (facts) {
          console.log('   ✅ Facts disponibles');
          console.log(`   • Version: ${validatedArtefacts.facts_version}`);
          console.log(`   • Collecté à: ${validatedArtefacts.facts_collected_at}`);
          console.log(`   • Parsing Duration: ${facts.meta.parsingDuration}ms`);

          console.log('\n   📦 PDP Facts:');
          console.log(`      • Titre: ${facts.pdp.title || 'N/A'}`);
          console.log(`      • Prix: ${facts.pdp.price || 'N/A'} ${facts.pdp.currency || ''}`);
          console.log(`      • ATC Button: ${facts.pdp.hasAtcButton ? '✅' : '❌'}`);
          console.log(`      • ATC Text: "${facts.pdp.atcText || 'N/A'}"`);
          console.log(`      • Variants: ${facts.pdp.variantTypes.length} (${facts.pdp.variantTypes.join(', ') || 'N/A'})`);
          console.log(`      • In Stock: ${facts.pdp.inStock !== null ? (facts.pdp.inStock ? '✅' : '❌') : '?'}`);
          console.log(`      • Description: ${facts.pdp.hasDescription ? '✅' : '❌'} (${facts.pdp.descriptionLength} chars)`);

          console.log('\n   🏗️  Structure Facts:');
          console.log(`      • H1: ${facts.structure.h1Count} (Main: "${facts.structure.mainH1Text || 'N/A'}")`);
          console.log(`      • Images: ${facts.structure.imageCount} (Sans Alt: ${facts.structure.imagesWithoutAlt})`);
          console.log(`      • Reviews: ${facts.structure.hasReviewsSection ? '✅' : '❌'}`);
          console.log(`      • Shipping Info: ${facts.structure.hasShippingInfo ? '✅' : '❌'}`);

          console.log('\n   ⚙️  Technical Facts:');
          console.log(`      • Shopify: ${facts.technical.isShopify ? '✅' : '❌'}`);
          console.log(`      • Theme: ${facts.technical.themeName || 'N/A'}`);
          console.log(`      • Shopify Version: ${facts.technical.shopifyVersion || 'N/A'}`);
          console.log(`      • Apps Détectées: ${facts.technical.detectedApps.length}`);
          if (facts.technical.detectedApps.length > 0) {
            facts.technical.detectedApps.forEach((app) => {
              console.log(`         - ${app}`);
            });
          }
        } else {
          console.log('   ⚠️  Facts non disponibles (collection a échoué)');
        }

        // Evidence Completeness
        console.log(`\n📊 Evidence Completeness: ${pageASource.evidenceCompleteness}`);

        // ============================================================================
        // ÉTAPE 4: Validation des Exports
        // ============================================================================
        console.log('\n📦 Exports (ScoreRun):');
        const exports = scoreRun.exports as { tickets: unknown[]; evidences: unknown[] };
        console.log(`   • Tickets: ${exports.tickets?.length || 0}`);
        console.log(`   • Evidences: ${exports.evidences?.length || 0}`);

        // ============================================================================
        // ÉTAPE 5: Résumé de Validation
        // ============================================================================
        console.log('\n' + '='.repeat(80));
        console.log('✅ VALIDATION RÉUSSIE');
        console.log('='.repeat(80));

        const validationSummary = {
          auditCompleted: true,
          scoreRunPersisted: true,
          artefactsValid: true,
          mobileScreenshot: !!mobileScreenshot,
          desktopScreenshot: !!desktopScreenshot,
          mobileHtml: !!mobileHtml,
          desktopHtml: !!desktopHtml,
          factsCollected: !!facts,
          evidenceCompleteness: pageASource.evidenceCompleteness,
        };

        console.log('\n📋 Résumé:');
        Object.entries(validationSummary).forEach(([key, value]) => {
          const icon = typeof value === 'boolean' ? (value ? '✅' : '❌') : '📌';
          console.log(`   ${icon} ${key}: ${value}`);
        });

        // Validation finale
        const allGood =
          validationSummary.auditCompleted &&
          validationSummary.scoreRunPersisted &&
          validationSummary.artefactsValid &&
          validationSummary.mobileScreenshot &&
          validationSummary.desktopScreenshot &&
          validationSummary.factsCollected;

        if (allGood) {
          console.log('\n🎉 TOUTES LES VALIDATIONS PASSÉES!');
        } else {
          console.log('\n⚠️  Certaines validations ont échoué (voir ci-dessus)');
        }
      } else {
        console.error('❌ Artefacts INVALIDES!');
        console.error('   Erreurs Zod:');
        validation.error.errors.forEach((err) => {
          console.error(`   - ${err.path.join('.')}: ${err.message}`);
        });
      }
    } catch (error) {
      console.error(`\n❌ Erreur lors du test de ${pdp.name}:`, error);
      if (error instanceof Error) {
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
      }
    }

    console.log('\n' + '='.repeat(80));
  }

  console.log('\n✅ Validation End-to-End terminée!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
