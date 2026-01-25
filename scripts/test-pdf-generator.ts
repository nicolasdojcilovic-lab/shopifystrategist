/**
 * Test PDF Generator
 * 
 * Ce script teste la génération de PDF à partir d'un rapport HTML.
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { AuditService } from '../src/core/pipeline/audit.service.js';
import { generateHtmlReport } from '../src/core/pipeline/report-generator.js';
import { getPdfGenerator, closePdfGenerator } from '../src/core/pipeline/pdf-generator.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('Test PDF Generator\n');
  console.log('='.repeat(60));
  
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
    
    const auditDuration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('Audit termine avec succes !');
    console.log('='.repeat(60));
    
    console.log(`\nDuree audit: ${(auditDuration / 1000).toFixed(2)}s`);
    console.log(`Tickets: ${result.exports?.tickets.length || 0}`);
    console.log(`Evidences: ${result.exports?.evidences.length || 0}`);
    
    // Étape 2: Récupérer le ScoreRun
    console.log('\nRecuperation du ScoreRun...');
    
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
    
    // Étape 3: Générer le rapport HTML
    console.log('Generation du rapport HTML...');
    
    const reportResult = generateHtmlReport(scoreRun, {
      locale: 'fr',
      darkMode: true,
    });
    
    console.log(`Rapport HTML: ${(reportResult.metadata.fileSize / 1024).toFixed(2)} KB`);
    
    // Sauvegarder le HTML pour debug
    const htmlPath = `./temp/report-${Date.now()}.html`;
    writeFileSync(htmlPath, reportResult.html, 'utf8');
    console.log(`HTML sauvegarde: ${htmlPath}`);
    
    // Étape 4: Générer le PDF
    console.log('\nGeneration du PDF avec Playwright...');
    
    const pdfGenerator = getPdfGenerator();
    const pdfStartTime = Date.now();
    
    const pdfUploadResult = await pdfGenerator.generateAndUpload(
      reportResult.html,
      result.keys.auditKey,
      {
        format: 'A4',
        displayHeaderFooter: false,
      }
    );
    
    const pdfDuration = Date.now() - pdfStartTime;
    
    console.log(`\nPDF genere en ${(pdfDuration / 1000).toFixed(2)}s`);
    console.log(`Cache Hit: ${pdfUploadResult.fromCache ? 'YES' : 'NO'}`);
    console.log(`URL publique: ${pdfUploadResult.publicUrl}`);
    
    // Cleanup
    await closePdfGenerator();
    
    console.log('\n' + '='.repeat(60));
    console.log('Test PDF Generator: SUCCES');
    console.log('='.repeat(60));
    console.log('\nLe PDF est disponible sur Supabase Storage.');
    console.log(`URL: ${pdfUploadResult.publicUrl}`);
    
  } catch (error) {
    console.error('\nErreur lors du test:', error);
    await closePdfGenerator();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
