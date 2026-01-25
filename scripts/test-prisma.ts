/**
 * Script de Test Prisma — Vérification de la Connexion DB
 * 
 * Teste la connexion à la DB et affiche un exemple de requête.
 * 
 * Usage:
 *   npm run test:db
 */

import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🔌 Test de connexion Prisma...\n');

  try {
    // Test de connexion
    await prisma.$connect();
    console.log('✅ Connexion à la DB réussie!\n');

    // Compter les produits
    const productCount = await prisma.product.count();
    console.log(`📊 Nombre de produits : ${productCount}`);

    // Lister les produits (limit 5)
    if (productCount > 0) {
      const products = await prisma.product.findMany({
        take: 5,
        select: {
          productKey: true,
          mode: true,
          normalizedUrls: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log('\n📦 Derniers produits :');
      products.forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.productKey}`);
        console.log(`   Mode: ${product.mode}`);
        console.log(`   URLs: ${JSON.stringify(product.normalizedUrls, null, 2)}`);
        console.log(`   Créé: ${product.createdAt.toISOString()}`);
      });
    }

    // Stats globales
    const snapshotCount = await prisma.snapshot.count();
    const scoreRunCount = await prisma.scoreRun.count();
    const auditCount = await prisma.auditJob.count();

    console.log('\n📈 Statistiques globales :');
    console.log(`   Produits:  ${productCount}`);
    console.log(`   Snapshots: ${snapshotCount}`);
    console.log(`   Runs:      ${scoreRunCount}`);
    console.log(`   Audits:    ${auditCount}`);

    console.log('\n✅ Test terminé avec succès!');
  } catch (error) {
    console.error('❌ Erreur de connexion:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
