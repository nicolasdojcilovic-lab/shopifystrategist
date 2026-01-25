/**
 * Script de Seed pour Prisma — ShopifyStrategist
 * 
 * Peuple la DB avec des données de test pour le développement.
 * 
 * Usage:
 *   npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Seed Product example (SOLO)
  const product1 = await prisma.product.upsert({
    where: { productKey: 'prod_example_solo_001' },
    update: {},
    create: {
      productKey: 'prod_example_solo_001',
      mode: 'solo',
      normalizedUrls: {
        page_a: 'https://fr.gymshark.com/products/gymshark-crest-joggers',
      },
      versions: {
        NORMALIZE_VERSION: '1.0',
      },
      canonicalInput: {
        mode: 'solo',
        normalized_urls: {
          page_a: 'https://fr.gymshark.com/products/gymshark-crest-joggers',
        },
        normalize_version: '1.0',
      },
    },
  });

  console.log('✅ Created Product (SOLO):', product1.productKey);

  // Seed Product example (DUO AB)
  const product2 = await prisma.product.upsert({
    where: { productKey: 'prod_example_duo_ab_001' },
    update: {},
    create: {
      productKey: 'prod_example_duo_ab_001',
      mode: 'duo_ab',
      normalizedUrls: {
        page_a: 'https://fr.gymshark.com/products/product-a',
        page_b: 'https://competitor.com/products/product-b',
      },
      versions: {
        NORMALIZE_VERSION: '1.0',
      },
      canonicalInput: {
        mode: 'duo_ab',
        normalized_urls: {
          page_a: 'https://fr.gymshark.com/products/product-a',
          page_b: 'https://competitor.com/products/product-b',
        },
        normalize_version: '1.0',
      },
    },
  });

  console.log('✅ Created Product (DUO AB):', product2.productKey);

  // Seed Snapshot
  const snapshot1 = await prisma.snapshot.upsert({
    where: { snapshotKey: 'snap_example_001' },
    update: {},
    create: {
      snapshotKey: 'snap_example_001',
      productKey: product1.productKey,
      locale: 'fr',
      viewports: {
        mobile: { width: 390, height: 844 },
        desktop: { width: 1440, height: 900 },
      },
      captureMeta: {
        user_agent: 'Mozilla/5.0 (compatible; ShopifyStrategist/1.0)',
      },
      versions: {
        ENGINE_VERSION: '1.0',
        NORMALIZE_VERSION: '1.0',
      },
      canonicalInput: {
        product_key: 'prod_example_solo_001',
        locale: 'fr',
        viewports: {
          mobile: { width: 390, height: 844 },
          desktop: { width: 1440, height: 900 },
        },
        engine_version: '1.0',
      },
      status: 'ok',
      completedAt: new Date(),
    },
  });

  console.log('✅ Created Snapshot:', snapshot1.snapshotKey);

  // Seed SnapshotSource
  const snapshotSource1 = await prisma.snapshotSource.upsert({
    where: {
      snapshotKey_source: {
        snapshotKey: snapshot1.snapshotKey,
        source: 'page_a',
      },
    },
    update: {},
    create: {
      snapshotKey: snapshot1.snapshotKey,
      source: 'page_a',
      url: 'https://fr.gymshark.com/products/gymshark-crest-joggers',
      capturedAt: new Date(),
      artefacts: {
        dom_ref: 'storage://snapshots/snap_example_001/page_a/dom.html',
        screenshot_refs: {
          mobile: {
            above_fold: 'storage://snapshots/snap_example_001/page_a/mobile/above_fold.png',
            full_page: 'storage://snapshots/snap_example_001/page_a/mobile/full_page.png',
          },
          desktop: {
            above_fold: 'storage://snapshots/snap_example_001/page_a/desktop/above_fold.png',
            full_page: 'storage://snapshots/snap_example_001/page_a/desktop/full_page.png',
          },
        },
      },
      evidenceCompleteness: 'complete',
      missingEvidence: [],
    },
  });

  console.log('✅ Created SnapshotSource:', snapshotSource1.source);

  // Seed ScoreRun
  const scoreRun1 = await prisma.scoreRun.upsert({
    where: { runKey: 'run_example_001' },
    update: {},
    create: {
      runKey: 'run_example_001',
      snapshotKey: snapshot1.snapshotKey,
      mode: 'solo',
      versions: {
        DETECTORS_VERSION: '1.0',
        SCORING_VERSION: '2.2',
      },
      canonicalInput: {
        snapshot_key: 'snap_example_001',
        detectors_version: '1.0',
        scoring_version: '2.2',
        mode: 'solo',
      },
      exports: {
        tickets: [
          {
            ticket_id: 'T_P0_PERF_001',
            mode: 'solo',
            title: 'Optimiser les images above-the-fold',
            impact: 'high',
            effort: 'low',
            risk: 'low',
            confidence: 'high',
            category: 'perf',
            why: 'Les images non optimisées ralentissent le chargement initial.',
            evidence_refs: ['E_PERF_IMG_001'],
            how_to: [
              'Compresser les images avec WebP',
              'Ajouter lazy loading',
              'Utiliser des tailles adaptatives',
            ],
            validation: ['Vérifier LCP < 2.5s'],
            quick_win: true,
            owner_hint: 'dev',
          },
        ],
        evidences: [
          {
            evidence_id: 'E_PERF_IMG_001',
            level: 'ticket',
            type: 'screenshot',
            label: 'Images non optimisées above-the-fold',
            source: 'page_a',
            viewport: 'mobile',
            timestamp: new Date().toISOString(),
            ref: '#evidence-E_PERF_IMG_001',
            details: {
              storage_ref: 'storage://snapshots/snap_example_001/page_a/mobile/above_fold.png',
            },
          },
        ],
      },
      status: 'ok',
      completedAt: new Date(),
    },
  });

  console.log('✅ Created ScoreRun:', scoreRun1.runKey);

  // Seed AuditJob
  const auditJob1 = await prisma.auditJob.upsert({
    where: { auditKey: 'audit_example_001' },
    update: {},
    create: {
      auditKey: 'audit_example_001',
      runKey: scoreRun1.runKey,
      mode: 'solo',
      reportMeta: {
        evidence_completeness: 'complete',
        alignment_level: null,
      },
      versions: {
        REPORT_OUTLINE_VERSION: '3.1',
      },
      canonicalInput: {
        run_key: 'run_example_001',
        report_outline_version: '3.1',
        copy_ready: false,
        white_label: null,
      },
      htmlRef: 'storage://audits/audit_example_001/report.html',
      htmlContentHash: 'sha256:abc123def456...',
      status: 'ok',
      completedAt: new Date(),
    },
  });

  console.log('✅ Created AuditJob:', auditJob1.auditKey);

  // Seed AuditRender
  const auditRender1 = await prisma.auditRender.upsert({
    where: { renderKey: 'render_example_001' },
    update: {},
    create: {
      renderKey: 'render_example_001',
      auditKey: auditJob1.auditKey,
      versions: {
        RENDER_VERSION: '1.0',
        CSV_EXPORT_VERSION: '1',
      },
      canonicalInput: {
        audit_key: 'audit_example_001',
        render_version: '1.0',
        csv_export_version: '1',
      },
      pdfRef: 'storage://renders/render_example_001/report.pdf',
      csvRef: 'storage://renders/render_example_001/tickets.csv',
      status: 'ok',
      completedAt: new Date(),
    },
  });

  console.log('✅ Created AuditRender:', auditRender1.renderKey);

  console.log('\n🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
