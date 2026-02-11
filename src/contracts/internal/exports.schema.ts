/**
 * Zod schema for ScoreRun exports validation on read
 * Reference: docs/DB_SCHEMA.md, REGISTRY.md
 *
 * AuditExportsSchema = grouping of ShopifyFacts (artefacts), Score and AiOutput
 * ScoreRun exports contain: tickets, evidences, score, ai_output
 */

import type { Prisma } from '@prisma/client';
import { z } from 'zod';

/** Owner REGISTRY strict (docs/SSOT/REGISTRY.md) */
export const REGISTRY_OWNERS = ['cro', 'copy', 'design', 'dev', 'merch', 'data'] as const;
export type RegistryOwner = (typeof REGISTRY_OWNERS)[number];

const Plan306090Schema = z.object({
  j0_30: z.string(),
  j30_60: z.string(),
  j60_90: z.string(),
});

const ScoreBreakdownItemSchema = z.object({
  pillar: z.string(),
  delta: z.number(),
  reason: z.string(),
  rule_id: z.string().optional(),
  criteria_ids: z.array(z.string()).optional(),
  fact_ids: z.array(z.string()).optional(),
});

const RegistryOwnerSchema = z.enum(REGISTRY_OWNERS);

/** Coerce owner_hint (legacy) → owner (REGISTRY). content|ops → dev */
function normalizeOwner(val: unknown): RegistryOwner {
  const s = String(val ?? '').toLowerCase();
  if (REGISTRY_OWNERS.includes(s as RegistryOwner)) return s as RegistryOwner;
  if (['content', 'ops'].includes(s)) return 'dev';
  return 'dev';
}

const TicketV2ExportsSchema = z
  .object({
    ticket_id: z.string(),
    mode: z.enum(['solo', 'duo_ab', 'duo_before_after']),
    title: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    effort: z.enum(['s', 'm', 'l']),
    risk: z.enum(['low', 'medium', 'high']),
    confidence: z.enum(['high', 'medium', 'low']),
    category: z.string(),
    why: z.string(),
    how_to: z.array(z.string()),
    evidence_refs: z.array(z.string()),
    validation: z.array(z.string()).optional(),
    quick_win: z.boolean(),
    owner: RegistryOwnerSchema.optional(),
    owner_hint: z.string().optional(), // legacy, mapped to owner
    notes: z.string().optional(),
    rule_id: z.string().optional(),
    affected_criteria_ids: z.array(z.string()).optional(),
  })
  .passthrough()
  .transform((t) => ({
    ...t,
    owner: normalizeOwner(t.owner ?? t.owner_hint ?? 'dev'),
  }));

const EvidenceV2Schema = z.object({
  evidence_id: z.string(),
  level: z.enum(['A', 'B', 'C']),
  type: z.string(),
  label: z.string(),
  source: z.string(),
  viewport: z.string(),
  timestamp: z.string(),
  ref: z.string(),
  details: z.record(z.unknown()).optional(),
}).passthrough();

/**
 * AuditExportsSchema — unified schema for ScoreRun exports
 * Groups: tickets (AiOutput), evidences, score, executive_summary, plan_30_60_90
 */
export const AuditExportsSchema = z.object({
  tickets: z.array(TicketV2ExportsSchema),
  evidences: z.array(EvidenceV2Schema),
  executive_summary: z.string().optional(),
  plan_30_60_90: Plan306090Schema.optional(),
  reasoning: z.string().optional(),
  strategist_score: z.number().optional(),
  score_breakdown: z.array(ScoreBreakdownItemSchema).optional(),
  score_reasoning: z.string().optional(),
  reportUrls: z
    .object({
      html: z.string().optional(),
      pdf: z.string().optional(),
    })
    .optional(),
}).passthrough();

/** @deprecated Prefer AuditExportsSchema */
export const ScoreRunExportsSchema = AuditExportsSchema;

export type ScoreRunExportsValidated = z.infer<typeof AuditExportsSchema>;

/**
 * Validate exports on read from database
 * Returns parsed exports or null if invalid
 */
export function validateScoreRunExports(raw: unknown): ScoreRunExportsValidated | null {
  const result = AuditExportsSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Convert validated exports to Prisma.InputJsonValue
 * Encapsulates conversion to avoid inline casts
 */
export function exportsToPrismaJson(exports: ScoreRunExportsValidated): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(exports));
}
