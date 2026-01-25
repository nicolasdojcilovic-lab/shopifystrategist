/**
 * ⚠️ AI SYNTHESIZER (SSOT-Driven)
 * 
 * Ce module utilise l'IA (GPT-4) pour générer des tickets actionnables
 * à partir des facts collectés, en respectant strictement les règles SSOT.
 * 
 * Principe:
 * - Facts → AI Analysis → Tickets structurés (Zod validated)
 * - Respect strict de SCORING_AND_DETECTION.md (Impact/Effort/Confidence)
 * - Evidence-based: Chaque ticket référence ≥1 evidence
 * - Déterminisme: Même facts → Mêmes tickets (via temperature=0)
 * 
 * Référence:
 * - docs/SCORING_AND_DETECTION.md (v2.2)
 * - docs/DETECTORS_SPEC.md (v1.3)
 * 
 * @version AI_SYNTHESIZER_VERSION = 1.0
 */

import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ShopifyFacts } from '@/core/engine/facts-collector';
import type { Artefacts } from '@/contracts/internal/artefacts.schema';
import { TicketV2Schema, type TicketV2 } from '@/contracts/export/ticket.v2';
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';

/**
 * Configuration AI
 */
const AI_CONFIG = {
  model: 'gpt-4-turbo-preview' as const, // Fast + high quality
  temperature: 0.1, // Presque déterministe
} as const;

/**
 * Schema Zod pour la sortie AI (array de tickets)
 */
const AITicketsOutputSchema = z.object({
  tickets: z.array(TicketV2Schema),
  reasoning: z
    .string()
    .describe('Brief explanation of ticket generation strategy (for debugging)'),
});

/**
 * Master Prompt (SSOT-aligned)
 * 
 * Intègre les règles de SCORING_AND_DETECTION.md
 */
const MASTER_PROMPT = `You are an expert Shopify UX/CRO auditor generating actionable optimization tickets.

**CRITICAL RULES (SSOT)**:
1. **Evidence-Based**: Every ticket MUST reference ≥1 evidence_id from available evidences
2. **No Hallucination**: Only report facts that are detected. Use placeholders like "[INSERT ...]" for unknowns
3. **Impact/Effort/Confidence**:
   - Impact: high (critical conversion blocker) | medium (optimization) | low (nice-to-have)
   - Effort: small (<1 day) | medium (1-3 days) | large (>3 days)
   - Confidence: high (evidence level A) | medium (level B) | low (level C, Appendix only)

**TICKET STRUCTURE**:
- ticket_id: "T_solo_<category>_<signal>_pdp_01" (deterministic)
- mode: "solo"
- category: offer_clarity | trust | media | ux | performance | seo_basics | accessibility
- title: Clear, actionable (max 80 chars)
- why: Business impact (2-3 sentences)
- how_to: Array of 3-7 concrete steps
- evidence_refs: Array of evidence_ids (≥1)
- validation: Array of 2-3 verification steps
- quick_win: true if effort=small AND impact=high
- owner_hint: design | dev | content | ops

**CATEGORIES & PRIORITIES**:
1. **offer_clarity** (HIGH): Missing/unclear price, ATC button, variants, stock
2. **trust** (HIGH): Missing reviews, shipping info, return policy, social proof
3. **media** (MEDIUM): Image quality, missing alt, lazy-load issues
4. **ux** (MEDIUM): Navigation, mobile UX, form UX
5. **performance** (MEDIUM): Load time, CLS, LCP
6. **seo_basics** (LOW): Meta tags, headings structure
7. **accessibility** (LOW): ARIA, contrast, keyboard nav

**DETECTION STRATEGY**:
- Focus on conversion blockers first (offer_clarity, trust)
- Only generate tickets for DETECTED issues (facts-based)
- Prioritize quick wins (small effort + high impact)
- Max 8 tickets per audit (focus on critical)

**OUTPUT FORMAT**:
Return a JSON object with:
{
  "tickets": TicketV2[],
  "reasoning": "Brief strategy explanation"
}`;

/**
 * AI Synthesizer Class
 */
export class AiSynthesizer {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key required. Set OPENAI_API_KEY in .env or pass to constructor.'
      );
    }
  }

  /**
   * Génère des tickets intelligents à partir des facts
   * 
   * @param facts - Facts collectés depuis HTML
   * @param artefacts - Artefacts complets (screenshots, HTML refs)
   * @returns Array de tickets validés Zod
   */
  async generateTickets(
    facts: ShopifyFacts,
    artefacts: Artefacts
  ): Promise<{ tickets: TicketV2[]; evidences: EvidenceV2[]; reasoning: string }> {
    console.log('🤖 AI Synthesizer: Génération des tickets...');

    // ============================================================================
    // ÉTAPE 1: Préparer les evidences disponibles
    // ============================================================================
    const availableEvidences = this.prepareEvidences(artefacts);

    // ============================================================================
    // ÉTAPE 2: Construire le contexte pour l'IA
    // ============================================================================
    const userPrompt = this.buildUserPrompt(facts, availableEvidences);

    // ============================================================================
    // ÉTAPE 3: Appel IA avec Vercel AI SDK
    // ============================================================================
    try {
      const result = await generateObject({
        model: openai(AI_CONFIG.model),
        schema: AITicketsOutputSchema,
        prompt: userPrompt,
        system: MASTER_PROMPT,
        temperature: AI_CONFIG.temperature,
      });

      console.log(`✅ AI génération réussie: ${result.object.tickets.length} tickets`);
      console.log(`   Reasoning: ${result.object.reasoning}`);

      // ============================================================================
      // ÉTAPE 4: Validation & Enrichissement
      // ============================================================================
      const validatedTickets = this.validateAndEnrichTickets(
        result.object.tickets,
        availableEvidences
      );

      return {
        tickets: validatedTickets,
        evidences: availableEvidences,
        reasoning: result.object.reasoning,
      };
    } catch (error) {
      console.error('❌ Erreur lors de la génération AI:', error);
      
      // Fallback: Retourner ticket par défaut si AI échoue
      return {
        tickets: [this.createFallbackTicket(availableEvidences)],
        evidences: availableEvidences,
        reasoning: 'AI generation failed, using fallback ticket',
      };
    }
  }

  /**
   * Prépare la liste des evidences disponibles depuis les artefacts
   */
  private prepareEvidences(artefacts: Artefacts): EvidenceV2[] {
    const evidences: EvidenceV2[] = [];
    const timestamp = artefacts.facts_collected_at || new Date().toISOString();

    // Evidence: Screenshot Mobile
    if (artefacts.screenshot_refs.mobile?.screenshot) {
      evidences.push({
        evidence_id: 'E_page_a_mobile_screenshot_above_fold_01',
        level: 'A',
        type: 'screenshot',
        label: 'above_fold',
        source: 'page_a',
        viewport: 'mobile',
        timestamp,
        ref: '#evidence-E_page_a_mobile_screenshot_above_fold_01',
        details: {
          screenshot_url: artefacts.screenshot_refs.mobile.screenshot,
          viewport_config: { width: 390, height: 844 },
        },
      });
    }

    // Evidence: Screenshot Desktop
    if (artefacts.screenshot_refs.desktop?.screenshot) {
      evidences.push({
        evidence_id: 'E_page_a_desktop_screenshot_above_fold_01',
        level: 'A',
        type: 'screenshot',
        label: 'above_fold',
        source: 'page_a',
        viewport: 'desktop',
        timestamp,
        ref: '#evidence-E_page_a_desktop_screenshot_above_fold_01',
        details: {
          screenshot_url: artefacts.screenshot_refs.desktop.screenshot,
          viewport_config: { width: 1440, height: 900 },
        },
      });
    }

    // Evidence: Facts Detection
    if (artefacts.facts) {
      evidences.push({
        evidence_id: 'E_page_a_na_detection_facts_01',
        level: 'A',
        type: 'detection',
        label: 'facts_collection',
        source: 'page_a',
        viewport: 'na',
        timestamp,
        ref: '#evidence-E_page_a_na_detection_facts_01',
        details: {
          detector_id: 'facts_collector',
          method: 'dom_strict',
          facts_version: artefacts.facts_version,
          facts_summary: {
            hasAtcButton: artefacts.facts.pdp.hasAtcButton,
            hasVariantSelector: artefacts.facts.pdp.hasVariantSelector,
            hasDescription: artefacts.facts.pdp.hasDescription,
            hasReviewsSection: artefacts.facts.structure.hasReviewsSection,
            isShopify: artefacts.facts.technical.isShopify,
          },
        },
      });
    }

    return evidences;
  }

  /**
   * Construit le prompt utilisateur avec facts + evidences
   */
  private buildUserPrompt(facts: ShopifyFacts, evidences: EvidenceV2[]): string {
    return `**AUDIT CONTEXT**:

**Product Facts (DOM-based detection)**:
${JSON.stringify(
  {
    title: facts.pdp.title,
    price: facts.pdp.price,
    currency: facts.pdp.currency,
    hasAtcButton: facts.pdp.hasAtcButton,
    atcText: facts.pdp.atcText,
    hasVariantSelector: facts.pdp.hasVariantSelector,
    variantTypes: facts.pdp.variantTypes,
    inStock: facts.pdp.inStock,
    stockText: facts.pdp.stockText,
    hasDescription: facts.pdp.hasDescription,
    descriptionLength: facts.pdp.descriptionLength,
  },
  null,
  2
)}

**Page Structure**:
${JSON.stringify(
  {
    h1Count: facts.structure.h1Count,
    mainH1Text: facts.structure.mainH1Text,
    imageCount: facts.structure.imageCount,
    imagesWithoutAlt: facts.structure.imagesWithoutAlt,
    hasReviewsSection: facts.structure.hasReviewsSection,
    hasShippingInfo: facts.structure.hasShippingInfo,
    hasReturnPolicy: facts.structure.hasReturnPolicy,
    hasSocialProof: facts.structure.hasSocialProof,
  },
  null,
  2
)}

**Technical Facts**:
${JSON.stringify(
  {
    isShopify: facts.technical.isShopify,
    themeName: facts.technical.themeName,
    detectedApps: facts.technical.detectedApps,
  },
  null,
  2
)}

**Available Evidences** (for evidence_refs):
${evidences.map((e) => `- ${e.evidence_id} (${e.type}, ${e.viewport}, level ${e.level})`).join('\n')}

**TASK**:
Analyze the facts and generate 3-8 actionable tickets focusing on conversion optimization.
Prioritize critical issues (missing ATC, unclear offer, missing trust signals).
Each ticket MUST reference at least one evidence_id from the list above.

Return JSON with tickets array and reasoning.`;
  }

  /**
   * Valide et enrichit les tickets générés par l'IA
   */
  private validateAndEnrichTickets(
    tickets: TicketV2[],
    availableEvidences: EvidenceV2[]
  ): TicketV2[] {
    const evidenceIds = new Set(availableEvidences.map((e) => e.evidence_id));

    return tickets.map((ticket, idx) => {
      // Valider evidence_refs
      const validRefs = ticket.evidence_refs.filter((ref) => evidenceIds.has(ref));

      if (validRefs.length === 0 && availableEvidences.length > 0 && availableEvidences[0]) {
        // Fallback: utiliser la première evidence disponible
        validRefs.push(availableEvidences[0].evidence_id);
      } else if (validRefs.length === 0) {
        // Aucune evidence disponible
        validRefs.push('E_placeholder');
      }

      // Assurer ticket_id unique et déterministe
      const ensuredTicketId =
        ticket.ticket_id || `T_solo_${ticket.category}_ai_pdp_${String(idx + 1).padStart(2, '0')}`;

      return {
        ...ticket,
        ticket_id: ensuredTicketId,
        evidence_refs: validRefs.length > 0 ? validRefs : ['E_placeholder'],
      };
    });
  }

  /**
   * Crée un ticket fallback si l'IA échoue
   */
  private createFallbackTicket(evidences: EvidenceV2[]): TicketV2 {
    return {
      ticket_id: 'T_solo_ux_ai_fallback_pdp_01',
      mode: 'solo',
      category: 'ux',
      impact: 'medium',
      effort: 'small',
      risk: 'low',
      confidence: 'medium',
      title: 'Audit AI indisponible - Vérification manuelle requise',
      why:
        'Le système d\'analyse AI n\'a pas pu générer de recommandations automatiques. Une revue manuelle des captures est nécessaire.',
      how_to: [
        'Examiner les screenshots mobile et desktop manuellement',
        'Vérifier les facts collectés dans la base de données',
        'Relancer l\'audit une fois le service AI restauré',
      ],
      evidence_refs: evidences.length > 0 && evidences[0] ? [evidences[0].evidence_id] : ['E_placeholder'],
      validation: [
        'Vérifier que le service AI est opérationnel',
        'Relancer l\'audit avec succès',
      ],
      quick_win: false,
      owner_hint: 'dev',
      notes: 'Ticket de fallback généré automatiquement suite à une erreur AI',
    };
  }
}

/**
 * Helper: Créer une instance singleton
 */
let synthesizer: AiSynthesizer | null = null;

export function getAiSynthesizer(apiKey?: string): AiSynthesizer {
  if (!synthesizer) {
    synthesizer = new AiSynthesizer(apiKey);
  }
  return synthesizer;
}
