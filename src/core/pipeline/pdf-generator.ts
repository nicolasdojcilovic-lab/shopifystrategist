/**
 * ⚠️ PDF GENERATOR (Playwright-based)
 * 
 * This module generates agency-grade PDFs from the HTML report.
 * 
 * Principles:
 * - PDF = Strict rendering of HTML (SSOT)
 * - A4 format, printBackground: true
 * - Page break handling (CSS break-inside-avoid)
 * - Upload to Supabase (pdf-reports bucket)
 * - Cache by audit_key (if PDF exists, returns URL)
 * 
 * Reference:
 * - docs/REPORT_OUTLINE.md (v3.1)
 * - Playwright PDF API
 * 
 * @version PDF_GENERATOR_VERSION = 1.0
 */

import { chromium, type Browser, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';

/**
 * Configuration Supabase
 */
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * PDF generation options
 */
export interface PdfOptions {
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

/**
 * PDF generation result
 */
export interface PdfResult {
  buffer: Buffer;
  metadata: {
    format: string;
    pages: number;
    fileSize: number;
    generatedAt: string;
  };
}

/**
 * Supabase upload result
 */
export interface UploadResult {
  publicUrl: string;
  path: string;
  size: number;
  uploadedAt: string;
}

/**
 * PDF Generator Class
 */
export class PdfGenerator {
  private browser: Browser | null = null;

  /**
   * Initializes Playwright browser
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      console.log('🌐 Initializing Playwright browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
      console.log('✅ Playwright browser initialized');
    }
  }

  /**
   * Closes browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🔒 Playwright browser closed');
    }
  }

  /**
   * Génère un PDF à partir du HTML
   * 
   * @param htmlContent - Contenu HTML complet
   * @param options - Options de génération PDF
   * @returns Buffer du PDF + metadata
   */
  async generatePdf(
    htmlContent: string,
    options: PdfOptions = {}
  ): Promise<PdfResult> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    console.log('📄 Generating PDF...');

    // Test hook: force PDF failure to validate degraded-mode behavior (REQ-001-B)
    if (process.env.PDF_RENDER_DISABLED === '1') {
      throw new Error('PDF rendering disabled (PDF_RENDER_DISABLED=1)');
    }


    const page: Page = await this.browser.newPage();

    try {
      // Load HTML
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for Tailwind CDN to load
      await page.waitForTimeout(2000);

      // PDF configuration (SSOT)
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '',
        footerTemplate: options.footerTemplate || '',
        margin: options.margin || {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
        landscape: options.landscape || false,
        preferCSSPageSize: false, // Force A4
      });

      const buffer = Buffer.from(pdfBuffer);

      // Page count estimation (approximate)
      // A4 = 595x842 points, 1 page ~ 200KB compressed
      const estimatedPages = Math.max(1, Math.ceil(buffer.length / 200000));

      console.log(`✅ PDF generated: ${(buffer.length / 1024).toFixed(2)} KB (${estimatedPages} estimated pages)`);

      return {
        buffer,
        metadata: {
          format: options.format || 'A4',
          pages: estimatedPages,
          fileSize: buffer.length,
          generatedAt: new Date().toISOString(),
        },
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Checks if a PDF already exists in Supabase (Cache Check)
   * 
   * @param auditKey - Deterministic audit key
   * @returns Public URL if exists, null otherwise
   */
  async checkPdfCache(auditKey: string): Promise<string | null> {
    const path = `${auditKey}.pdf`;

    try {
      const { data, error } = await supabase.storage
        .from('pdf-reports')
        .list('', {
          limit: 1,
          search: path,
        });

      if (error) {
        console.error('⚠️  Error checking PDF cache:', error);
        return null;
      }

      if (data && data.length > 0) {
        // PDF existe, retourner l'URL
        const { data: urlData } = supabase.storage
          .from('pdf-reports')
          .getPublicUrl(path);

        console.log(`✅ Cache Hit: PDF found (${path})`);
        return urlData.publicUrl;
      }

      console.log(`⚠️  Cache Miss: PDF not found (${path})`);
      return null;
    } catch (error) {
      console.error('⚠️  Error checking PDF cache:', error);
      return null;
    }
  }

  /**
   * Uploads PDF to Supabase Storage
   * 
   * @param pdfBuffer - PDF buffer
   * @param auditKey - Deterministic audit key
   * @returns Upload result with public URL
   */
  async uploadToSupabase(
    pdfBuffer: Buffer,
    auditKey: string
  ): Promise<UploadResult> {
    console.log('☁️  Uploading PDF to Supabase...');

    const path = `${auditKey}.pdf`;

    try {
      // Check if bucket exists, create if not
      const { data: buckets } = await supabase.storage.listBuckets();
      const pdfBucketExists = buckets?.some((b) => b.name === 'pdf-reports');

      if (!pdfBucketExists) {
        console.log('📦 Creating pdf-reports bucket...');
        await supabase.storage.createBucket('pdf-reports', {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
      }

      // Upload PDF
      const { data, error } = await supabase.storage
        .from('pdf-reports')
        .upload(path, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true, // Remplacer si existe
        });

      if (error) {
        throw new Error(`Supabase upload error: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('pdf-reports')
        .getPublicUrl(path);

      console.log(`✅ PDF uploaded: ${urlData.publicUrl}`);

      return {
        publicUrl: urlData.publicUrl,
        path: data.path,
        size: pdfBuffer.length,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error uploading PDF:', error);
      throw error;
    }
  }

  /**
   * Generates and uploads PDF in a single operation
   * 
   * @param htmlContent - Complete HTML content
   * @param auditKey - Deterministic audit key
   * @param options - PDF generation options
   * @returns Public URL of PDF
   */
  async generateAndUpload(
    htmlContent: string,
    auditKey: string,
    options: PdfOptions = {}
  ): Promise<{ publicUrl: string; fromCache: boolean }> {
    // Check cache
    const cachedUrl = await this.checkPdfCache(auditKey);
    if (cachedUrl) {
      return { publicUrl: cachedUrl, fromCache: true };
    }

    // Generate PDF
    const pdfResult = await this.generatePdf(htmlContent, options);

    // Upload vers Supabase
    const uploadResult = await this.uploadToSupabase(pdfResult.buffer, auditKey);

    return { publicUrl: uploadResult.publicUrl, fromCache: false };
  }
}

/**
 * Singleton instance
 */
let pdfGenerator: PdfGenerator | null = null;

/**
 * Gets the singleton instance of PDF Generator
 */
export function getPdfGenerator(): PdfGenerator {
  if (!pdfGenerator) {
    pdfGenerator = new PdfGenerator();
  }
  return pdfGenerator;
}

/**
 * Closes singleton instance (cleanup)
 */
export async function closePdfGenerator(): Promise<void> {
  if (pdfGenerator) {
    await pdfGenerator.close();
    pdfGenerator = null;
  }
}
