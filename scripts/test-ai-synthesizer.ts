/**
 * Test AI Synthesizer Integration
 * 
 * Ce script teste l'intégration complète du synthétiseur IA dans le pipeline.
 */

import 'dotenv/config';
import { AuditService } from '../src/core/pipeline/audit.service.js';

async function main() {
  console.log('Test AI Synthesizer Integration\n');
  console.log('='.repeat(60));
  
  // Test avec une vraie PDP Shopify
  const testUrl = 'https://www.allbirds.com/products/mens-tree-runners';
  
  console.log(`\nURL de test: ${testUrl}`);
  console.log('Lancement de l audit complet (avec AI)...\n');
  
  const auditService = new AuditService();
  const startTime = Date.now();
  
  try {
    const result = await auditService.runSoloAudit(testUrl, {
      locale: 'fr',
    });
    
    const duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('Audit termine avec succes !');
    console.log('='.repeat(60));
    
    console.log(`\nDuree totale: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Status: ${result.status}`);
    console.log(`Cache Hit: ${result.fromCache ? 'YES' : 'NO'}`);
    
    // AI Generation Results
    console.log('\nResultats AI:');
    console.log(`   Tickets generes: ${result.exports?.tickets.length || 0}`);
    console.log(`   Evidences creees: ${result.exports?.evidences.length || 0}`);
    
    if (result.exports?.tickets && result.exports.tickets.length > 0) {
      console.log('\nTickets generes par IA:');
      result.exports.tickets.forEach((ticket, idx) => {
        console.log(`\n   ${idx + 1}. ${ticket.title}`);
        console.log(`      Categorie: ${ticket.category}`);
        console.log(`      Impact: ${ticket.impact} | Effort: ${ticket.effort}`);
        console.log(`      Confidence: ${ticket.confidence}`);
        console.log(`      Evidence refs: ${ticket.evidence_refs.join(', ')}`);
        console.log(`      Quick win: ${ticket.quick_win ? 'YES' : 'NO'}`);
      });
    }
    
    // Evidence Completeness
    console.log(`\nEvidence Completeness: ${result.reportMeta?.evidence_completeness || 'N/A'}`);
    
    // Artifacts
    if (result.artifacts?.screenshots) {
      console.log('\nArtifacts:');
      if (result.artifacts.screenshots.mobile?.above_fold) {
        console.log(`   Screenshot Mobile: ${result.artifacts.screenshots.mobile.above_fold}`);
      }
      if (result.artifacts.screenshots.desktop?.above_fold) {
        console.log(`   Screenshot Desktop: ${result.artifacts.screenshots.desktop.above_fold}`);
      }
    }
    
    // Errors
    if (result.errors.length > 0) {
      console.log('\nErreurs detectees:');
      result.errors.forEach((error) => {
        console.log(`   [${error.stage}] ${error.code}: ${error.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Test AI Synthesizer: SUCCES');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\nErreur lors du test:', error);
    process.exit(1);
  }
}

main().catch(console.error);
