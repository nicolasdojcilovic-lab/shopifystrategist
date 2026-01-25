/**
 * API Route: GET /api/audit/[auditKey]
 *
 * Récupère le statut d'un audit et les URLs des rapports (HTML, PDF).
 * Utilisé pour le polling sur la page /audit/[auditKey].
 *
 * Response: { status, message?, reportUrls?: { html?, pdf? } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: 'Capture des écrans en cours...',
  GENERATING_REPORT: 'Génération du PDF...',
  COMPLETED: 'Rapport prêt',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { auditKey: string } }
) {
  const auditKey = params.auditKey;

  if (!auditKey) {
    return NextResponse.json(
      { error: 'auditKey requis', code: 'MISSING_AUDIT_KEY' },
      { status: 400 }
    );
  }

  try {
    const auditJob = await prisma.auditJob.findUnique({
      where: { auditKey },
      include: {
        scoreRun: true,
      },
    });

    if (!auditJob) {
      return NextResponse.json(
        { error: 'Audit introuvable', code: 'NOT_FOUND', status: 'PENDING', message: 'Démarrage...' },
        { status: 404 }
      );
    }

    const status = auditJob.status as string;
    const message = STATUS_MESSAGES[status] ?? status;

    // reportUrls dans ScoreRun.exports
    let reportUrls: { html?: string; pdf?: string } | undefined;

    if (auditJob.runKey && auditJob.scoreRun) {
      const exports = auditJob.scoreRun.exports as { reportUrls?: { html?: string; pdf?: string } } | null;
      reportUrls = exports?.reportUrls;
    }

    return NextResponse.json({
      status,
      message,
      reportUrls,
    });
  } catch (error) {
    console.error('[API /api/audit/[auditKey] GET]', error);

    const err = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json(
      { error: err, code: 'DB_ERROR' },
      { status: 500 }
    );
  }
}
