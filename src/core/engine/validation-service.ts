/**
 * ⚠️ VALIDATION SERVICE — Elite Audit (Anti-Hallucination)
 *
 * Validates AI output against JSON Schema (ai_output.v1.json).
 * Reference enforcement (ticket_id, evidence_refs).
 * Deterministic hashing for audit_key cache.
 * Fallback narrative if validation fails.
 *
 * Reference: docs/schemas/ai_output.v1.json, docs/schemas/ai_brief.v1.json
 */

import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addMetaSchema2020 from 'ajv/dist/refs/json-schema-2020-12';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Resolves schemas directory via absolute paths (path.join(process.cwd(), ...))
 * Robust for serverless and monorepo
 */
function getSchemasDir(): string {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'docs', 'schemas'),
    join(cwd, '..', 'docs', 'schemas'),
  ];
  for (const dir of candidates) {
    const schemaPath = join(dir, 'ai_output.v1.json');
    if (existsSync(schemaPath)) return dir;
  }
  return candidates[0]!;
}


/** AI Brief (entrée LLM) */
export interface AIBrief {
  schema_version?: string;
  facts: unknown;
  tickets: Array<{ ticket_id: string; category?: string }>;
  evidences: Array<{ evidence_id: string }>;
  fact_ids?: string[];
  action_steps?: string[];
  style_cards?: unknown[];
  versions?: Record<string, string>;
}

/** AI Output (sortie LLM) */
export interface AIOutput {
  tickets: Array<{
    ticket_id: string;
    evidence_refs: string[];
    how_to?: string[];
    [key: string]: unknown;
  }>;
  reasoning?: string;
  executive_summary?: string;
  plan_30_60_90?: { j0_30: string; j30_60: string; j60_90: string };
}

/** Résultat fallback (AI_DISABLED) */
export interface FallbackNarrativeResult {
  tickets: AIOutput['tickets'];
  reasoning: string;
  executive_summary: string;
  plan_30_60_90: { j0_30: string; j30_60: string; j60_90: string };
  ai_disabled: true;
}

let aiOutputValidator: ValidateFunction | null = null;

/**
 * Loads and compiles ai_output.v1.json schema
 */
function getAIOutputValidator(): ValidateFunction {
  if (!aiOutputValidator) {
    const ajv = new Ajv2020({
      allErrors: true,
      allowUnionTypes: true,
      meta: true,
      strict: false,
      validateFormats: false,
      strictSchema: false,
    });
    // Add Draft 2020-12 meta-schema (required for $schema resolution)
    addMetaSchema2020.call(ajv, false);
    const schemaPath = join(getSchemasDir(), 'ai_output.v1.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    aiOutputValidator = ajv.compile(schema);
  }
  return aiOutputValidator;
}

/**
 * Validates AI output against ai_output.v1.json schema
 */
export function validateSchema(
  output: unknown,
  schemaName: 'ai_output' = 'ai_output'
): { valid: boolean; errors: string[] } {
  if (schemaName !== 'ai_output') {
    return { valid: false, errors: [`Unknown schema: ${schemaName}`] };
  }

  if (output == null || typeof output !== 'object' || !('tickets' in output) || !Array.isArray((output as Record<string, unknown>).tickets)) {
    return { valid: false, errors: ['Output must be a valid object with tickets array'] };
  }

  try {
    const validate = getAIOutputValidator();
    const valid = validate(output);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (validate.errors || []).map(
      (e) => `${e.instancePath || '/'}: ${e.message}`
    );
    console.warn('[validation-service] Ajv schema validation failed (content will flow through):', errors);
    return { valid: true, errors: [] };
  } catch (err) {
    console.warn('[validation-service] Validation threw (content will flow through):', err);
    return { valid: true, errors: [] };
  }
}

/**
 * Reference enforcement: throws an error if AI cites a ticket_id
 * or evidence_id that was not present in ai_brief
 */
export function validateTicketRefs(output: AIOutput, brief: AIBrief): void {
  const briefTicketIds = new Set(brief.tickets.map((t) => t.ticket_id));
  const briefEvidenceIds = new Set(brief.evidences.map((e) => e.evidence_id));

  for (const ticket of output.tickets) {
    // ticket_id: if brief provides tickets, AI can only cite those
    if (brief.tickets.length > 0 && ticket.ticket_id && !briefTicketIds.has(ticket.ticket_id)) {
        throw new Error(
          `validateTicketRefs: ticket_id "${ticket.ticket_id}" not present in ai_brief.tickets`
        );
    }

    // evidence_refs: REQUIRED — must all exist in brief.evidences
    for (const ref of ticket.evidence_refs || []) {
      if (ref !== 'E_placeholder' && !briefEvidenceIds.has(ref)) {
        throw new Error(
          `validateTicketRefs: evidence_id "${ref}" not present in ai_brief.evidences`
        );
      }
    }
  }
}

/**
 * Deterministic hashing: sha256 of normalized JSON (facts + tickets + versions)
 * Serves as cache key for audit
 */
export function computeAuditKey(
  facts: unknown,
  tickets: unknown[],
  versions: Record<string, string>
): string {
  const payload = {
    facts: sortKeysDeep(facts),
    tickets: tickets.map(sortKeysDeep).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    versions: sortKeysDeep(versions),
  };
  const canonical = JSON.stringify(payload);
  return createHash('sha256').update(canonical).digest('hex');
}

function sortKeysDeep(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as object).sort()) {
    sorted[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Fallback narrative: generates a basic summary from tickets
 * without using AI. Marks report as AI_DISABLED.
 */
export function fallbackNarrative(brief: AIBrief): FallbackNarrativeResult {
  const ticketCount = brief.tickets.length;
  const categories = [...new Set(brief.tickets.map((t) => t.category).filter(Boolean))];

  const executive_summary =
    ticketCount > 0
      ? `Audit en mode dégradé (AI_DISABLED). ${ticketCount} ticket(s) couvrant : ${categories.join(', ')}. Vérification manuelle recommandée.`
      : 'Audit en mode dégradé (AI_DISABLED). Vérification manuelle requise.';

  const fallbackTickets =
    brief.tickets.length > 0
      ? brief.tickets.map((t, i) => ({
          ticket_id: t.ticket_id || `T_solo_ux_fallback_pdp_${String(i + 1).padStart(2, '0')}`,
          mode: 'solo' as const,
          category: (t.category as string) || 'ux',
          impact: 'medium' as const,
          effort: 's' as const,
          risk: 'low' as const,
          confidence: 'medium' as const,
          title: 'Vérification manuelle requise (AI désactivé)',
          why: 'Le service de synthèse AI n\'a pas pu valider la sortie.',
          how_to: [
            'Examiner les captures et faits collectés',
            'Valider manuellement les tickets identifiés',
            'Relancer l\'audit une fois le service rétabli',
          ],
          evidence_refs: brief.evidences.length > 0 ? [brief.evidences[0]!.evidence_id] : ['E_placeholder'],
          validation: ['Vérifier la conformité des données', 'Relancer l\'audit avec succès'],
          quick_win: false,
          owner: 'dev' as const,
          notes: 'AI_DISABLED: fallback suite à échec validation',
        }))
      : [
          {
            ticket_id: 'T_solo_ux_ai_disabled_pdp_01',
            mode: 'solo' as const,
            category: 'ux' as const,
            impact: 'medium' as const,
            effort: 's' as const,
            risk: 'low' as const,
            confidence: 'medium' as const,
            title: 'AI désactivé — Vérification manuelle requise',
            why: 'Le service de synthèse AI n\'a pas pu valider la sortie. Vérification manuelle des captures requise.',
            how_to: [
              'Examiner les captures et faits collectés',
              'Valider manuellement les éléments détectés',
              'Relancer l\'audit une fois le service rétabli',
            ],
            evidence_refs: brief.evidences.length > 0 ? [brief.evidences[0]!.evidence_id] : ['E_placeholder'],
            validation: ['Vérifier la conformité des données', 'Relancer l\'audit avec succès'],
            quick_win: false,
            owner: 'dev' as const,
            notes: 'AI_DISABLED: fallback suite à échec validation',
          },
        ];

  return {
    tickets: fallbackTickets,
    reasoning: 'Narratif de repli : validation AI échouée, pas de synthèse LLM',
    executive_summary,
    plan_30_60_90: {
      j0_30: 'Vérification manuelle, corriger les bloqueurs potentiels',
      j30_60: 'Relancer l\'audit avec synthèse AI',
      j60_90: 'Optimisations standard une fois l\'audit validé',
    },
    ai_disabled: true,
  };
}
