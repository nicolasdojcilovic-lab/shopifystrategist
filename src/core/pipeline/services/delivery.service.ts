/**
 * ⚠️ DELIVERY SERVICE — HTML report generation + PDF + Upload
 *
 * Orchestrates report generation, HTML and PDF upload.
 * Reference: docs/REPORT_OUTLINE.md, docs/AUDIT_PIPELINE_SPEC.md
 */

import { prisma } from '@/lib/prisma';
import { validateScoreRunExports, exportsToPrismaJson } from '@/contracts/internal/exports.schema';
import { generateHtmlReport } from '@/core/pipeline/report-generator';
import { getPdfGenerator } from '@/core/pipeline/pdf-generator';
import { SupabaseStorageService } from '@/adapters/storage/supabase.service';

export interface DeliveryServiceOptions {
  locale?: 'fr' | 'en';
  whiteLabel?: {
    logo?: string;
    brandName?: string;
    brandColor?: string;
  } | null;
}

export interface DeliveryServiceResult {
  htmlUrl?: string | undefined;
  pdfUrl?: string | undefined;
  errors: Array<{
    stage: string;
    code: string;
    message: string;
    timestamp?: string;
  }>;
}

/**
 * Delivery service (HTML + PDF report)
 */
export class DeliveryService {
  private storageService = SupabaseStorageService.getInstance();

  /**
   * Generates HTML + PDF report and uploads to Supabase
   */
  async deliverReport(
    runKey: string,
    auditKey: string,
    options: DeliveryServiceOptions = {}
  ): Promise<DeliveryServiceResult> {
    const { locale = 'fr', whiteLabel = null } = options;
    const errors: DeliveryServiceResult['errors'] = [];

    const scoreRun = await prisma.scoreRun.findUnique({
      where: { runKey },
      include: {
        snapshot: {
          include: {
            sources: true,
          },
        },
      },
    });

    if (!scoreRun) {
      errors.push({
        stage: 'report_generation',
        code: 'SCORE_RUN_NOT_FOUND',
        message: 'ScoreRun not found for report generation',
        timestamp: new Date().toISOString(),
      });
      return { errors };
    }

    await prisma.auditJob.update({
      where: { auditKey },
      data: { status: 'GENERATING_REPORT' },
    });

    let htmlReport: { html: string; metadata: { fileSize: number } };
    try {
      htmlReport = generateHtmlReport(scoreRun, {
        locale: locale as 'fr' | 'en',
        darkMode: true,
        ...(whiteLabel ? { whiteLabel } : {}),
      });
    } catch (error) {
      errors.push({
        stage: 'report_generation',
        code: 'HTML_GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown HTML generation error',
        timestamp: new Date().toISOString(),
      });
      await prisma.auditJob.update({
        where: { auditKey },
        data: { status: 'COMPLETED' },
      });
      return { errors };
    }

    await this.storageService.initialize();

    let htmlUrl: string | undefined;
    const htmlPath = `reports/${auditKey}.html`;
    const { error: htmlError } = await this.storageService
      .getClient()
      .storage.from('html-reports')
      .upload(htmlPath, htmlReport.html, {
        contentType: 'text/html',
        upsert: true,
      });

    if (htmlError) {
      errors.push({
        stage: 'storage_html',
        code: 'HTML_UPLOAD_ERROR',
        message: htmlError.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      const { data } = this.storageService.getClient().storage
        .from('html-reports')
        .getPublicUrl(htmlPath);
      htmlUrl = data.publicUrl;
    }

    let pdfUrl: string | undefined;
    try {
      const pdfGenerator = getPdfGenerator();
      const pdfResult = await pdfGenerator.generateAndUpload(
        htmlReport.html,
        auditKey,
        { format: 'A4' }
      );
      pdfUrl = pdfResult.publicUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown PDF render error';
      errors.push({
        stage: 'render_pdf',
        code: 'PDF_RENDER_FAILED',
        message: msg,
        timestamp: new Date().toISOString(),
      });
    }

    const baseExports = (scoreRun.exports as object) || {};
    const updatedExports = { ...baseExports, reportUrls: { html: htmlUrl, pdf: pdfUrl } };
    const validated = validateScoreRunExports(updatedExports);
    const exportsForDb = validated ? exportsToPrismaJson(validated) : JSON.parse(JSON.stringify(updatedExports));

    await prisma.scoreRun.update({
      where: { runKey },
      data: { exports: exportsForDb },
    });

    await prisma.auditJob.update({
      where: { auditKey },
      data: {
        status: 'COMPLETED',
        ...(htmlUrl ? { htmlRef: htmlUrl } : {}),
      },
    });

    return {
      ...(htmlUrl != null ? { htmlUrl } : {}),
      ...(pdfUrl != null ? { pdfUrl } : {}),
      errors,
    };
  }

  /**
   * Closes PDF generator (Playwright cleanup)
   */
  async closePdfGenerator(): Promise<void> {
    const { closePdfGenerator } = await import('@/core/pipeline/pdf-generator');
    await closePdfGenerator();
  }
}
