/**
 * API Route: POST /api/audit/solo (SSOT)
 *
 * Starts a SOLO audit. Envelope conforms to docs/API_DOC.md.
 * Body: { url: string, locale?: string, options?: { copy_ready?: boolean } }
 * Response: keys, versions, artifacts, report_meta, exports, errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuditService } from '@/core/pipeline/audit.service';
import {
  REPORT_OUTLINE_VERSION,
  TICKET_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  CSV_EXPORT_VERSION,
  NORMALIZE_VERSION,
  SCORING_VERSION,
  ENGINE_VERSION,
  DETECTORS_VERSION,
  RENDER_VERSION,
} from '@/ssot/versions';

const DETECTORS_SPEC_VERSION = '1.3'; // docs/API_DOC.md §2.1

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json(
        { status: 'error', error: { code: 'INVALID_REQUEST', message: 'Missing required field: url' } },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { status: 'error', error: { code: 'INVALID_REQUEST', message: 'Invalid URL' } },
        { status: 400 }
      );
    }

    const lang = typeof body?.lang === 'string' ? body.lang : typeof body?.locale === 'string' ? body.locale : 'fr';
    const locale: 'fr' | 'en' = lang === 'en' ? 'en' : 'fr';
    const copyReady = !!body?.options?.copy_ready;

    const auditService = new AuditService();
    const result = await auditService.runSoloAudit(url, { locale, copyReady });

    if (result.status === 'failed') {
      return NextResponse.json(
        {
          status: 'error',
          error: { code: 'AUDIT_FAILED', message: 'Audit failed before SSOT HTML could be produced.' },
          keys: {
            product_key: result.keys.productKey,
            snapshot_key: result.keys.snapshotKey,
            run_key: result.keys.runKey,
            audit_key: result.keys.auditKey,
          },
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    // status = 'ok' | 'degraded' → HTTP 200, SSOT envelope
    const versions: Record<string, string | number> = {
      REPORT_OUTLINE_VERSION,
      TICKET_SCHEMA_VERSION: String(TICKET_SCHEMA_VERSION),
      EVIDENCE_SCHEMA_VERSION: String(EVIDENCE_SCHEMA_VERSION),
      CSV_EXPORT_VERSION: String(CSV_EXPORT_VERSION),
      DETECTORS_SPEC_VERSION,
      NORMALIZE_VERSION,
      SCORING_VERSION,
      ENGINE_VERSION,
      DETECTORS_VERSION,
      RENDER_VERSION,
    };

    const envelope = {
      status: result.status,
      mode: 'solo' as const,
      keys: {
        product_key: result.keys.productKey,
        snapshot_key: result.keys.snapshotKey,
        run_key: result.keys.runKey,
        audit_key: result.keys.auditKey,
      },
      versions,
      report_meta: result.reportMeta ?? {
        mode: 'solo',
        evidence_completeness: 'insufficient' as const,
        alignment_level: null,
        url: url,
        normalized_url: url,
        locale,
        captured_at: new Date().toISOString(),
      },
      artifacts: {
        html_ref: result.reportUrls?.html ?? '',
        pdf_ref: result.reportUrls?.pdf ?? null,
      },
      exports: result.exports ?? { tickets: [], evidences: [] },
      errors: result.errors,
    };

    return NextResponse.json(envelope, { status: 200 });
  } catch (error) {
    console.error('[API POST /api/audit/solo]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'error', error: { code: 'AUDIT_FAILED', message } },
      { status: 500 }
    );
  }
}
