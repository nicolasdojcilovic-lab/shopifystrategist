/**
 * API Route: POST /api/audit
 *
 * Lance un audit SOLO sur une URL Shopify PDP.
 * Appelle AuditService.runSoloAudit(url) et retourne auditKey + status.
 *
 * Body: { url: string }
 * Response: { auditKey: string, status: 'ok' | 'degraded' | 'failed' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuditService } from '@/core/pipeline/audit.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json(
        { error: 'URL requise', code: 'MISSING_URL' },
        { status: 400 }
      );
    }

    // Validation basique (doit ressembler à une URL)
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'URL invalide', code: 'INVALID_URL' },
        { status: 400 }
      );
    }

    const auditService = new AuditService();
    const result = await auditService.runSoloAudit(url, { locale: 'fr' });

    return NextResponse.json({
      auditKey: result.keys.auditKey,
      status: result.status,
      fromCache: result.fromCache,
      duration: result.duration,
      reportUrls: result.reportUrls,
    });
  } catch (error) {
    console.error('[API /api/audit POST]', error);

    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json(
      { error: message, code: 'AUDIT_FAILED' },
      { status: 500 }
    );
  }
}
