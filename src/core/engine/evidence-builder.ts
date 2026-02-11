/**
 * ⚠️ EVIDENCE BUILDER — Reusable Evidence Pack from Artefacts
 *
 * Builds EvidenceV2[] from capture artefacts. Used by:
 * - audit.service.ts (rules engine + AI orchestrator)
 * - ai-synthesizer.ts (via shared module)
 *
 * Reference: docs/EVIDENCE_PACK_SPEC.md
 *
 * @version 1.0
 */

import type { EvidenceV2 } from '@/contracts/export/evidence.v2';

export interface ArtefactsForEvidence {
  screenshot_refs?: {
    mobile?: { screenshot?: string; html?: string } | undefined;
    desktop?: { screenshot?: string; html?: string } | undefined;
  };
  facts?: {
    pdp?: { hasAtcButton?: boolean; hasVariantSelector?: boolean; hasDescription?: boolean };
    structure?: { hasReviewsSection?: boolean };
    technical?: { isShopify?: boolean };
  } | null;
  facts_version?: string | null;
  facts_collected_at?: string | null;
}

/**
 * Builds EvidenceV2[] from artefacts.
 * Deterministic: same artefacts → same evidences.
 */
export function buildEvidencesFromArtifacts(artefacts: ArtefactsForEvidence): EvidenceV2[] {
  const evidences: EvidenceV2[] = [];
  const timestamp = artefacts.facts_collected_at || new Date().toISOString();

  if (artefacts.screenshot_refs?.mobile?.screenshot) {
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

  if (artefacts.screenshot_refs?.desktop?.screenshot) {
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
        facts_version: artefacts.facts_version ?? '1.0',
        facts_summary: {
          hasAtcButton: artefacts.facts.pdp?.hasAtcButton,
          hasVariantSelector: artefacts.facts.pdp?.hasVariantSelector,
          hasDescription: artefacts.facts.pdp?.hasDescription,
          hasReviewsSection: artefacts.facts.structure?.hasReviewsSection,
          isShopify: artefacts.facts.technical?.isShopify,
        },
      },
    });
  }

  return evidences;
}
