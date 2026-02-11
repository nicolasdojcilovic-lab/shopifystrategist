/**
 * ⚠️ AI SYNTHESIZER (SSOT-Driven)
 * 
 * This module uses AI (GPT-4) to generate actionable tickets
 * from collected facts, strictly adhering to SSOT rules.
 * 
 * Principle:
 * - Facts → AI Analysis → Structured tickets (Zod validated)
 * - Strict compliance with SCORING_AND_DETECTION.md (Impact/Effort/Confidence)
 * - Evidence-based: Each ticket references ≥1 evidence
 * - Determinism: Same facts → Same tickets (via temperature=0)
 * 
 * Reference:
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
import {
  TicketV2BaseSchema,
  TicketOwnerSchema,
  sortTicketsStable,
  filterTopActionsGuardrails,
  type TicketV2,
} from '@/contracts/export/ticket.v2';
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';
import {
  validateSchema,
  validateTicketRefs,
  fallbackNarrative,
  type AIBrief,
  type AIOutput,
} from '@/core/engine/validation-service';
import type { Locale } from '@/core/i18n/translations';
import { buildEvidencesFromArtifacts, type ArtefactsForEvidence } from '@/core/engine/evidence-builder';

/**
 * AI Configuration
 */
const AI_CONFIG = {
  model: 'gpt-4o' as const, // Structured Outputs (JSON Schema) + strict SSOT
  temperature: 0.1, // Near-deterministic
} as const;

/**
 * Zod schema for AI output (strict, .cursorrules §4)
 * - additionalProperties=false
 * - notes REQUIRED (string, use "" if no notes)
 * - owner REQUIRED (REGISTRY: cro|copy|design|dev|merch|data) — no legacy owner_hint
 */
// rule_id, affected_criteria_ids added in post-processing (validateAndEnrichTickets)
const TicketV2AISchema = TicketV2BaseSchema.omit({
  rule_id: true,
  affected_criteria_ids: true,
  owner_hint: true,
}).extend({
  owner: TicketOwnerSchema.describe('REQUIRED: REGISTRY owner — cro|copy|design|dev|merch|data'),
  notes: z
    .string()
    .describe('REQUIRED: Additional notes. Use "" if no notes.'),
}).strict();

const Plan306090Schema = z.object({
  j0_30: z.string().describe('Phase J0-30: Quick Wins & Trust — key actions'),
  j30_60: z.string().describe('Phase J30-60: Conversion Engine — key actions'),
  j60_90: z.string().describe('Phase J60-90: Growth Scale — key actions'),
});

const AITicketsOutputSchema = z
  .object({
    tickets: z.array(TicketV2AISchema),
    reasoning: z
      .string()
      .describe('Brief explanation of ticket generation strategy (for debugging)'),
    executive_summary: z
      .string()
      .describe('REQUIRED: Executive Summary — executive synthesis 2-4 sentences, decision and ROI oriented'),
    plan_30_60_90: Plan306090Schema.describe('REQUIRED: Structured 30/60/90 day strategic plan'),
  })
  .strict();

/**
 * Golden Examples (PROMPT_LIBRARY.md — docs/PROMPT_LIBRARY.md)
 */
const PROMPT_LIBRARY_TEMPLATES = `
**TEMPLATE 1 — Psychology & CRO Expert** (Focus: Clarity, Friction, Desire | Style: Direct, psychological)
Example: "The absence of visual hierarchy in your 'Benefits' section forces users into excessive cognitive effort. The human brain processes images 60,000 times faster than text. Recommendation: Replace this 400-word block with 3 labeled icons targeting your customer's 3 main fears (Size, Durability, Care)."

**TEMPLATE 2 — Shopify & Tech-Performance Expert** (Focus: Ecosystem, LCP, Apps impact | Style: Technical ROI simplified)
Example: "Your Chat app (Intercom) loads with high priority before product content (LCP). Result: a 1.8s white 'flash' that increases your bounce rate by 12%. Solution: Modify script loading order to prioritize Hero rendering and defer chat by 5 seconds."

**TEMPLATE 3 — Business & ROI Expert** (Focus: AOV, LTV, Cross-sell | Style: Numbers, opportunities)
Example: "Your PDP is a dead end. Once the product is viewed, users have no choice but to leave or scroll back. Integrate a 'Shop the Look' module or a bundle offer before the reviews section to mechanically increase your average order value by 8 to 15%."

**TEMPLATE 4 — 30/60/90 Day Strategic Plan** (Focus: Roadmap, execution, trust | Style: Structured, professional)
J0-30: Quick Wins & Trust (Visual corrections, Mobile UX, Trust badges)
J30-60: Conversion Engine (Copy optimization, A/B test setup on ATC)
J60-90: Growth Scale (Advanced upsells, Critical speed optimization, Personalization)
`;

/**
 * Master Prompt (SSOT-aligned) — Senior Ecommerce Strategist Persona
 *
 * Référence: docs/PROMPT_LIBRARY.md, docs/SSOT/REGISTRY.md, ShopifyFacts (scraper)
 */
const MASTER_PROMPT = `Tu es un Stratège E-commerce Senior travaillant pour une agence Elite. Ton expertise combine CRO, psychologie de la conversion et ROI e-commerce. Tu ne rédiges pas des observations basiques — tu delivers une stratégie de croissance actionnable et chiffrée.

**Persona** : Professionnel, axé ROI, autoritaire. Ton ton inspire confiance et incite à l'action.

**Sources de vérité** : ShopifyFacts (scraper) et REGISTRY.md (docs/SSOT/REGISTRY.md).

${PROMPT_LIBRARY_TEMPLATES}

---
Règles de génération des tickets :

**RÈGLES CRITIQUES (SSOT)** :
1. **Evidence-Based** : Chaque ticket DOIT référencer ≥1 evidence_id de la liste fournie (OBLIGATOIRE)
2. **Anti-hallucination** : Ne rapporte que des faits détectés. Utilise "[À VÉRIFIER]" pour les inconnus
3. **notes OBLIGATOIRE** : Chaque ticket DOIT avoir un champ "notes" (string). Utilise "" si aucun
4. **REGISTRY-ONLY** : catégories et règles UNIQUEMENT depuis le REGISTRY
5. **Impact / Effort / Confiance** :
   - Impact: high (bloqueur conversion critique) | medium (optimisation) | low (nice-to-have)
   - Effort: s (<1 jour) | m (1-3 jours) | l (>3 jours)
   - Confidence: high (preuve A) | medium (preuve B) | low (preuve C, Annexe uniquement)

**STRUCTURE TICKET (TOUS LES CHAMPS EN FRANÇAIS)** :
- ticket_id: "T_solo_<category>_<signal>_pdp_01" (déterministe)
- mode: "solo"
- category: offer_clarity | trust | media | ux | performance | seo_basics | accessibility (REGISTRY)
- title: Titre **actionnel et orienté business** en français (ex: "Optimiser la visibilité du bouton d'achat", PAS "ATC missing")
- why: Impact business (2-3 phrases) — friction cognitive, abandon panier, preuve sociale, urgence/scarcité, assurance
- how_to: 3-7 étapes concrètes pour un marchand Shopify (en français)
- evidence_refs: Array d'evidence_ids (≥1 OBLIGATOIRE)
- validation: 2-3 critères de vérification (en français)
- quick_win: true si effort=s ET impact=high
- owner: cro | copy | design | dev | merch | data (REGISTRY)
- notes: string (OBLIGATOIRE, "" si aucun)

**REGISTRY rule_id → category mapping (USE ONLY THESE)**:
- R.PDP.CTA.* → offer_clarity | R.PDP.PRICE.* → offer_clarity | R.PDP.VARIANTS.* → offer_clarity
- R.PDP.SHIPPING.* → trust | R.PDP.TRUST.* → trust | R.PDP.REVIEWS.* → trust
- R.PDP.GALLERY.* → media | R.PDP.BENEFITS.* → media
- R.PDP.STICKY_ATC.* → ux | R.PDP.MOBILE_UX.* → ux
- R.TECH.PERF_LAB.* → performance | R.SEO.* → seo_basics | R.PDP.ACCESSIBILITY.* → accessibility

**CATEGORIES & PRIORITIES**:
1. **offer_clarity** (HIGH): Missing/unclear price, ATC button, variants, stock → C.CORE.*
2. **trust** (HIGH): Missing reviews, shipping info, return policy, social proof → C.CORE.TRUST, C.PERS.SOCIAL_PROOF
3. **media** (MEDIUM): Image quality, missing alt, lazy-load → C.PERS.BENEFITS
4. **ux** (MEDIUM): Navigation, mobile UX, form UX → C.TECH.MOBILE_UX
5. **performance** (MEDIUM): Load time, CLS, LCP → C.TECH.PERF_LAB
6. **seo_basics** (LOW): Meta tags, headings → C.SEO.METADATA
7. **accessibility** (LOW): ARIA, contrast, keyboard nav

**STRATÉGIE DE DÉTECTION** :
- Priorité aux bloqueurs de conversion (offer_clarity, trust)
- Générer uniquement des tickets pour faits DÉTECTÉS (evidence-based)
- Privilégier les Quick Wins (effort s + impact high)
- **Max 5 tickets** par audit (qualité > quantité)
- Ton : Agence Elite (expert, factuel, orienté ROI)

**FORMAT SORTIE (OBLIGATOIRE)** :
Retourne un objet JSON avec :
{
  "tickets": TicketV2[],
  "reasoning": "Explication courte de la stratégie",
  "executive_summary": "Synthèse décisionnelle 2-4 phrases, orientée ROI (en français)",
  "plan_30_60_90": {
    "j0_30": "Phase J0-30 : Gains Rapides et Confiance — actions clés (en français)",
    "j30_60": "Phase J30-60 : Moteur de conversion — actions clés (en français)",
    "j60_90": "Phase J60-90 : Passage à l'échelle — actions clés (en français)"
  }
}

Tu DOIS inclure une Synthèse Décisionnelle et un Plan 30/60/90 en français.

---
**RÈGLES DURES (Anti-hallucination)** :
- N'invente aucun fait. Tout doit être basé sur les fact_ids et evidences fournis.
- N'invente aucune action absente de action_steps (si fourni).
- Sortie conforme au schéma ai_output.v1 (docs/schemas/ai_output.v1.json).
- evidence_refs : UNIQUEMENT les evidence_ids listés dans "Available Evidences".
- title, why, how_to, validation : TOUS en français.`;

const LOCALE_INJECT_FR = `**LANGUE** : Tu DOIS générer la réponse strictement en français. Title, why, how_to et validation doivent être en français. Ta réponse est le produit final : si tu utilises un seul mot d'anglais dans ces champs, l'audit sera rejeté. Traduis tout.`;

const LOCALE_INJECT_EN = `**LANGUAGE** : You MUST generate the response strictly in English. Title, why, how_to, and validation must be in English.`;

function getSystemPrompt(locale: Locale): string {
  const localeInject = locale === 'fr' ? LOCALE_INJECT_FR : LOCALE_INJECT_EN;
  return `${MASTER_PROMPT}\n\n${localeInject}`;
}

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
   * Checks if critical facts are missing (Degraded Mode)
   * If yes, returns true → create E.FACTS.MISSING_DATA ticket instead of calling AI
   */
  private hasMissingCriticalFacts(facts: ShopifyFacts): boolean {
    const { pdp } = facts;
    // No price AND no CTA AND no title → facts too incomplete to analyze
    const noPrice = !pdp.price && !pdp.regularPrice && !pdp.salePrice;
    const noAtc = !pdp.hasAtcButton;
    const noTitle = !pdp.title || pdp.title.trim() === '';
    return noPrice && noAtc && noTitle;
  }

  /**
   * Generates intelligent tickets from facts
   *
   * @param facts - Facts collected from HTML (complete ShopifyFacts validated by scraper)
   * @param artefacts - Complete artifacts (screenshots, HTML refs)
   * @returns Array of Zod-validated tickets
   */
  async generateTickets(
    facts: ShopifyFacts,
    artefacts: Artefacts,
    locale: Locale = 'fr'
  ): Promise<{
    tickets: TicketV2[];
    evidences: EvidenceV2[];
    reasoning: string;
    executive_summary: string;
    plan_30_60_90: { j0_30: string; j30_60: string; j60_90: string };
  }> {
    console.log('🤖 AI Synthesizer: Generating tickets...');

    // ============================================================================
    // STEP 0: Prepare available evidences
    // ============================================================================
    const availableEvidences = this.prepareEvidences(artefacts);

    // ============================================================================
    // DEGRADED MODE: If critical facts missing → ticket E.FACTS.MISSING_DATA
    // Do not crash; create explanatory ticket with evidence_refs
    // ============================================================================
    if (this.hasMissingCriticalFacts(facts)) {
      console.warn('⚠️ Degraded Mode: Critical facts missing (price, CTA, title). E.FACTS.MISSING_DATA ticket.');
      return {
        tickets: [this.createMissingDataTicket(facts, availableEvidences)],
        evidences: availableEvidences,
        reasoning: 'Degraded mode: critical facts missing, E.FACTS.MISSING_DATA ticket generated',
        executive_summary:
          'Insufficient product data (price, CTA or title missing). Partial audit — manual review of screenshots recommended to complete analysis.',
        plan_30_60_90: {
          j0_30: 'Manual verification of captures, fix potential blockers (consent, popup)',
          j30_60: 'Relaunch capture after fixes, then complete analysis',
          j60_90: 'Standard optimizations once facts are available',
        },
      };
    }

    // ============================================================================
    // STEP 1: Build context for AI
    // ============================================================================
    const userPrompt = this.buildUserPrompt(facts, availableEvidences, locale);

    // ============================================================================
    // STEP 2: AI call with Vercel AI SDK (response_format JSON schema via Zod)
    // ============================================================================
    try {
      const result = await generateObject({
        model: openai(AI_CONFIG.model),
        schema: AITicketsOutputSchema,
        prompt: userPrompt,
        system: getSystemPrompt(locale),
        temperature: AI_CONFIG.temperature,
      });

      console.log(`✅ AI generation successful: ${result.object.tickets.length} tickets`);
      console.log(`   Reasoning: ${result.object.reasoning}`);

      // ============================================================================
      // STEP 3b: Schema + reference validation (Anti-Hallucination)
      // ============================================================================
      const aiBrief: AIBrief = {
        schema_version: '1.0',
        facts,
        tickets: [], // AI creates tickets
        evidences: availableEvidences,
        versions: { facts_version: '1.0', ticket_version: '2' },
      };

      const schemaValidation = validateSchema(result.object as AIOutput, 'ai_output');
      if (!schemaValidation.valid) {
        console.warn('⚠️ Schema validation failed:', schemaValidation.errors);
        const fallback = fallbackNarrative(aiBrief);
        return {
          tickets: fallback.tickets as TicketV2[],
          evidences: availableEvidences,
          reasoning: fallback.reasoning,
          executive_summary: fallback.executive_summary,
          plan_30_60_90: fallback.plan_30_60_90,
        };
      }

      try {
        validateTicketRefs(result.object as AIOutput, aiBrief);
      } catch (refErr) {
        console.warn('⚠️ validateTicketRefs failed:', refErr);
        const fallback = fallbackNarrative(aiBrief);
        return {
          tickets: fallback.tickets as TicketV2[],
          evidences: availableEvidences,
          reasoning: fallback.reasoning,
          executive_summary: fallback.executive_summary,
          plan_30_60_90: fallback.plan_30_60_90,
        };
      }

      // ============================================================================
      // STEP 4: Validation & Enrichment
      // ============================================================================
      const validatedTickets = this.validateAndEnrichTickets(
        result.object.tickets,
        availableEvidences
      );

      // Quality gate: limit to 3-5 critical tickets, prioritize Quick Wins
      const sorted = sortTicketsStable(validatedTickets);
      const guarded = filterTopActionsGuardrails(sorted, 1);
      const ticketsOut = guarded.slice(0, 5);

      return {
        tickets: ticketsOut,
        evidences: availableEvidences,
        reasoning: result.object.reasoning,
        executive_summary: result.object.executive_summary,
        plan_30_60_90: result.object.plan_30_60_90,
      };
    } catch (error) {
      console.error('❌ Error during AI generation:', error);

      // Fallback: Return default ticket if AI fails
      return {
        tickets: [this.createFallbackTicket(availableEvidences)],
        evidences: availableEvidences,
        reasoning: 'Échec génération AI, utilisation du ticket de repli',
        executive_summary:
          'L\'analyse stratégique n\'a pas pu être finalisée. Vérification manuelle des captures recommandée.',
        plan_30_60_90: {
          j0_30: 'Vérifier le service AI, relancer l\'audit',
          j30_60: 'Analyse manuelle des captures et faits collectés',
          j60_90: 'Optimisations standard une fois l\'audit validé',
        },
      };
    }
  }

  /**
   * Prepares the list of available evidences from artifacts (uses shared evidence builder)
   */
  private prepareEvidences(artefacts: Artefacts): EvidenceV2[] {
    return buildEvidencesFromArtifacts(artefacts as ArtefactsForEvidence);
  }

  /**
   * Builds the user prompt with complete ShopifyFacts + evidences
   * Reference: facts-collector.ts — sends ShopifyFacts object validated by scraper
   */
  private buildUserPrompt(facts: ShopifyFacts, evidences: EvidenceV2[], locale: Locale): string {
    const langNote = locale === 'fr'
      ? 'Tous les champs visibles (title, why, how_to, validation) en français.'
      : 'All visible fields (title, why, how_to, validation) in English.';
    return `**AUDIT CONTEXT**:

**Product Facts (ShopifyFacts.pdp — DOM-based detection)**:
${JSON.stringify(
  {
    title: facts.pdp.title,
    price: facts.pdp.price,
    currency: facts.pdp.currency,
    hasSalePrice: facts.pdp.hasSalePrice,
    regularPrice: facts.pdp.regularPrice,
    salePrice: facts.pdp.salePrice,
    hasAtcButton: facts.pdp.hasAtcButton,
    atcText: facts.pdp.atcText,
    atcButtonCount: facts.pdp.atcButtonCount,
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

**Page Structure (ShopifyFacts.structure)**:
${JSON.stringify(
  {
    h1Count: facts.structure.h1Count,
    mainH1Text: facts.structure.mainH1Text,
    h2Count: facts.structure.h2Count,
    h3Count: facts.structure.h3Count,
    imageCount: facts.structure.imageCount,
    imagesWithoutAlt: facts.structure.imagesWithoutAlt,
    imagesWithLazyLoad: facts.structure.imagesWithLazyLoad,
    hasReviewsSection: facts.structure.hasReviewsSection,
    hasShippingInfo: facts.structure.hasShippingInfo,
    hasReturnPolicy: facts.structure.hasReturnPolicy,
    hasSocialProof: facts.structure.hasSocialProof,
    formCount: facts.structure.formCount,
    hasNewsletterForm: facts.structure.hasNewsletterForm,
  },
  null,
  2
)}

**Technical Facts (ShopifyFacts.technical)**:
${JSON.stringify(
  {
    isShopify: facts.technical.isShopify,
    shopifyVersion: facts.technical.shopifyVersion,
    themeName: facts.technical.themeName,
    detectedApps: facts.technical.detectedApps,
    hasGoogleAnalytics: facts.technical.hasGoogleAnalytics,
    hasFacebookPixel: facts.technical.hasFacebookPixel,
    hasKlaviyo: facts.technical.hasKlaviyo,
    hasSkipLink: facts.technical.hasSkipLink,
    hasAriaLabels: facts.technical.hasAriaLabels,
    langAttribute: facts.technical.langAttribute,
  },
  null,
  2
)}

**Meta**:
${JSON.stringify({ parsingDuration: facts.meta.parsingDuration, descriptionSource: facts.meta.descriptionSource }, null, 2)}

**Available Evidences** (for evidence_refs — MANDATORY per ticket):
${evidences.map((e) => `- ${e.evidence_id} (${e.type}, ${e.viewport}, level ${e.level})`).join('\n')}

**EVIDENCE LINKING (Visual First)** :
When generating a ticket, you MUST list the relevant evidence_refs from the available evidences above so the report generator can link the correct screenshots. Prefer screenshot evidences (type=screenshot) over detection-only. For Mobile/Sticky ATC/Friction issues, reference the mobile screenshot (viewport=mobile) when available.

**TÂCHE** :
Analyse les faits et génère **3 à 5 tickets actionnables** (priorité Quick Wins).
Priorité : ATC manquant, offre peu claire, signaux de confiance manquants.
Chaque ticket DOIT référencer au moins un evidence_id de la liste ci-dessus.
${langNote}
Ton : Agence Elite (expert, factuel, ROI).`;
  }

  /**
   * Mapping category → rule_id + affected_criteria_ids (REGISTRY fallback)
   * docs/SSOT/REGISTRY.md §3 Rule Registry
   */
  private static readonly CATEGORY_REGISTRY_DEFAULTS: Record<
    string,
    { rule_id: string; affected_criteria_ids: string[] }
  > = {
    offer_clarity: { rule_id: 'R.PDP.CTA.MISSING_ATF', affected_criteria_ids: ['C.CORE.CTA'] },
    trust: { rule_id: 'R.PDP.TRUST.MISSING_SIGNALS', affected_criteria_ids: ['C.CORE.TRUST'] },
    media: { rule_id: 'R.PDP.BENEFITS.MISSING_SCANNABLE_LIST', affected_criteria_ids: ['C.PERS.BENEFITS'] },
    ux: { rule_id: 'R.PDP.STICKY_ATC.MISSING_MOBILE', affected_criteria_ids: ['C.CORE.CTA', 'C.TECH.MOBILE_UX'] },
    performance: { rule_id: 'R.TECH.PERF_LAB.POOR_BUCKET', affected_criteria_ids: ['C.TECH.PERF_LAB'] },
    seo_basics: { rule_id: 'R.SEO.META.MISSING_TITLE_OR_DESC', affected_criteria_ids: ['C.SEO.METADATA'] },
    accessibility: { rule_id: 'R.TECH.READY_STATE.VOLATILE_LAYOUT', affected_criteria_ids: ['C.TECH.MOBILE_UX'] },
    comparison: { rule_id: 'R.PDP.CTA.MISSING_ATF', affected_criteria_ids: ['C.CORE.CTA'] },
  };

  /**
   * Validates and enriches tickets generated by AI (evidence_refs, rule_id, affected_criteria_ids, owner)
   */
  private validateAndEnrichTickets(
    tickets: Array<Record<string, unknown> & { evidence_refs: string[]; category: string }>,
    availableEvidences: EvidenceV2[]
  ): TicketV2[] {
    const evidenceIds = new Set(availableEvidences.map((e) => e.evidence_id));

    return tickets.map((ticket, idx) => {
      const validRefs = ticket.evidence_refs.filter((ref) => evidenceIds.has(ref));

      if (validRefs.length === 0 && availableEvidences.length > 0 && availableEvidences[0]) {
        validRefs.push(availableEvidences[0].evidence_id);
      } else if (validRefs.length === 0) {
        validRefs.push('E_placeholder');
      }

      const ensuredTicketId =
        ticket.ticket_id || `T_solo_${ticket.category}_ai_pdp_${String(idx + 1).padStart(2, '0')}`;

      const defaults = AiSynthesizer.CATEGORY_REGISTRY_DEFAULTS[ticket.category];
      const rule_id = (ticket.rule_id as string | undefined) ?? defaults?.rule_id;
      const rawCriteria = ticket.affected_criteria_ids;
      const affected_criteria_ids =
        Array.isArray(rawCriteria) && rawCriteria.length > 0
          ? rawCriteria as string[]
          : (defaults?.affected_criteria_ids ?? []);

      const ownerRaw = (ticket as { owner?: string }).owner ?? (ticket as { owner_hint?: string }).owner_hint ?? 'dev';
      const owner = ['cro', 'copy', 'design', 'dev', 'merch', 'data'].includes(ownerRaw.toLowerCase())
        ? (ownerRaw.toLowerCase() as 'cro' | 'copy' | 'design' | 'dev' | 'merch' | 'data')
        : 'dev';

      // Normalize effort according to REGISTRY (s|m|l) — accepts small/medium/large legacy
      const effortRaw = (ticket.effort as string)?.toLowerCase();
      const effort = effortRaw === 'small' || effortRaw === 's' ? 's' : effortRaw === 'large' || effortRaw === 'l' ? 'l' : 'm';

      const enriched = {
        ...ticket,
        ticket_id: ensuredTicketId,
        evidence_refs: validRefs.length > 0 ? validRefs : ['E_placeholder'],
        owner,
        effort,
        ...(rule_id ? { rule_id } : {}),
        ...(affected_criteria_ids.length > 0 ? { affected_criteria_ids } : {}),
      } as TicketV2;
      return enriched;
    });
  }

  /**
   * Creates a Degraded Mode ticket when critical facts are missing
   * REGISTRY reference: R.TARGET.NON_PRODUCT (affected_criteria_ids=[])
   * ticket_id: T_solo_ux_ai_missing_data_pdp_01 (E.FACTS.MISSING_DATA)
   */
  private createMissingDataTicket(
    facts: ShopifyFacts,
    evidences: EvidenceV2[]
  ): TicketV2 {
    const evidenceRef =
      evidences.length > 0 && evidences[0] ? evidences[0].evidence_id : 'E_placeholder';
    const missing = [
      !facts.pdp.price && !facts.pdp.regularPrice && !facts.pdp.salePrice && 'prix',
      !facts.pdp.hasAtcButton && 'CTA',
      (!facts.pdp.title || facts.pdp.title.trim() === '') && 'titre',
    ]
      .filter(Boolean)
      .join(', ');

    return {
      ticket_id: 'T_solo_ux_ai_missing_data_pdp_01',
      mode: 'solo',
      category: 'ux',
      impact: 'high',
      effort: 's',
      risk: 'low',
      confidence: 'medium',
      title: 'Données produit manquantes — Vérification manuelle requise',
      why: `Les faits suivants n'ont pas pu être extraits : ${missing}. Sans prix, CTA ou titre, l'analyse automatisée est limitée. Vérification manuelle des captures et du HTML nécessaire pour compléter l'audit.`,
      how_to: [
        'Examiner les captures mobile et desktop pour valider la présence des éléments (prix, CTA, titre)',
        'Vérifier si la page est un PDP valide ou si un bloqueur (consentement, popup) empêche la détection',
        'Relancer la capture après correction des blocages potentiels',
      ],
      evidence_refs: [evidenceRef],
      validation: [
        'Prix visible et lisible au-dessus de la ligne de flottaison',
        'CTA Ajouter au panier présent et identifiable',
        'Titre produit affiché correctement',
      ],
      quick_win: false,
      owner: 'dev',
      notes: 'Degraded mode E.FACTS.MISSING_DATA: critical facts missing (price, CTA or title). Partial audit.',
      rule_id: 'R.TARGET.NON_PRODUCT.URL_INVALID',
      affected_criteria_ids: [],
    };
  }

  /**
   * Creates a fallback ticket if AI fails
   */
  private createFallbackTicket(evidences: EvidenceV2[]): TicketV2 {
    return {
      ticket_id: 'T_solo_ux_ai_fallback_pdp_01',
      mode: 'solo',
      category: 'ux',
      impact: 'medium',
      effort: 's',
      risk: 'low',
      confidence: 'medium',
      title: 'Audit AI indisponible — Vérification manuelle requise',
      why:
        'Le système d\'analyse stratégique n\'a pas pu générer de recommandations automatiques. Vérification manuelle des captures nécessaire.',
      how_to: [
        'Examiner manuellement les captures mobile et desktop',
        'Vérifier les faits collectés en base',
        'Relancer l\'audit une fois le service AI rétabli',
      ],
      evidence_refs: evidences.length > 0 && evidences[0] ? [evidences[0].evidence_id] : ['E_placeholder'],
      validation: [
        'Vérifier que le service AI est opérationnel',
        'Relancer l\'audit avec succès',
      ],
      quick_win: false,
      owner: 'dev',
      notes: 'Ticket de repli généré suite à erreur AI',
      rule_id: 'R.PDP.CTA.MISSING_ATF',
      affected_criteria_ids: ['C.CORE.CTA'],
    };
  }
}

/**
 * Helper: Create a singleton instance
 */
let synthesizer: AiSynthesizer | null = null;

export function getAiSynthesizer(apiKey?: string): AiSynthesizer {
  if (!synthesizer) {
    synthesizer = new AiSynthesizer(apiKey);
  }
  return synthesizer;
}
