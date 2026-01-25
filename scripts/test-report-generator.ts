/**
 * Test HTML Report Generator
 * 
 * Ce script teste la génération du rapport HTML à partir d'un audit réel.
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { AuditService } from '../src/core/pipeline/audit.service.js';
import { generateHtmlReport } from '../src/core/pipeline/report-generator.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('Test HTML Report Generator\n');
  console.log('='.repeat(60));
  
  // Test avec une vraie PDP Shopify
  const testUrl = 'https://www.allbirds.com/products/mens-tree-runners';
  
  console.log(`\nURL de test: ${testUrl}`);
  console.log('Lancement de l audit complet...\n');
  
  const auditService = new AuditService();
  const startTime = Date.now();
  
  try {
    // Étape 1: Lancer l'audit
    const result = await auditService.runSoloAudit(testUrl, {
      locale: 'fr',
    });
    
    const duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('Audit termine avec succes !');
    console.log('='.repeat(60));
    
    console.log(`\nDuree totale: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Status: ${result.status}`);
    console.log(`Tickets generes: ${result.exports?.tickets.length || 0}`);
    console.log(`Evidences creees: ${result.exports?.evidences.length || 0}`);
    
    // Étape 2: Récupérer le ScoreRun complet avec relations
    console.log('\nRecuperation du ScoreRun avec relations...');
    
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
      throw new Error('ScoreRun introuvable');
    }
    
    console.log('ScoreRun recupere avec succes');
    
    // Étape 3: Générer le rapport HTML
    console.log('\nGeneration du rapport HTML...');
    
    const reportResult = generateHtmlReport(scoreRun, {
      locale: 'fr',
      darkMode: true,
    });
    
    console.log('Rapport HTML genere avec succes !');
    console.log(`\nMetadata du rapport:`);
    console.log(`  - Report version: ${reportResult.metadata.reportVersion}`);
    console.log(`  - Ticket version: ${reportResult.metadata.ticketVersion}`);
    console.log(`  - Evidence version: ${reportResult.metadata.evidenceVersion}`);
    console.log(`  - Generated at: ${new Date(reportResult.metadata.generatedAt).toLocaleString('fr-FR')}`);
    console.log(`  - File size: ${(reportResult.metadata.fileSize / 1024).toFixed(2)} KB`);
    
    // Étape 4: Sauvegarder le rapport
    const outputPath = `./temp/report-${Date.now()}.html`;
    writeFileSync(outputPath, reportResult.html, 'utf8');
    
    console.log(`\nRapport sauvegarde: ${outputPath}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('Test HTML Report Generator: SUCCES');
    console.log('='.repeat(60));
    console.log('\nOuvrez le fichier HTML dans un navigateur pour visualiser le rapport.');
    
  } catch (error) {
    console.error('\nErreur lors du test:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
