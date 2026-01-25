/**
 * ⚠️ PDF GENERATOR (Playwright-based)
 * 
 * Ce module génère des PDF agency-grade à partir du rapport HTML.
 * 
 * Principes:
 * - PDF = Rendu strict du HTML (SSOT)
 * - Format A4, printBackground: true
 * - Gestion des coupures de page (CSS break-inside-avoid)
 * - Upload vers Supabase (bucket pdf-reports)
 * - Cache par audit_key (si PDF existe, retourne URL)
 * 
 * Référence:
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
 * Options de génération PDF
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
 * Résultat de génération PDF
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
 * Résultat d'upload Supabase
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
   * Initialise le navigateur Playwright
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      console.log('🌐 Initialisation du navigateur Playwright...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
      console.log('✅ Navigateur Playwright initialisé');
    }
  }

  /**
   * Ferme le navigateur
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🔒 Navigateur Playwright fermé');
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

    console.log('📄 Génération du PDF...');

    const page: Page = await this.browser.newPage();

    try {
      // Charger le HTML
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Attendre que Tailwind CDN soit chargé
      await page.waitForTimeout(2000);

      // Configuration PDF (SSOT)
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

      // Estimation du nombre de pages (approximatif)
      // A4 = 595x842 points, 1 page ~ 200KB compressed
      const estimatedPages = Math.max(1, Math.ceil(buffer.length / 200000));

      console.log(`✅ PDF généré: ${(buffer.length / 1024).toFixed(2)} KB (${estimatedPages} pages estimées)`);

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
   * Vérifie si un PDF existe déjà dans Supabase (Cache Check)
   * 
   * @param auditKey - Clé d'audit déterministe
   * @returns URL publique si existe, null sinon
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
        console.error('⚠️  Erreur lors de la vérification du cache PDF:', error);
        return null;
      }

      if (data && data.length > 0) {
        // PDF existe, retourner l'URL
        const { data: urlData } = supabase.storage
          .from('pdf-reports')
          .getPublicUrl(path);

        console.log(`✅ Cache Hit: PDF trouvé (${path})`);
        return urlData.publicUrl;
      }

      console.log(`⚠️  Cache Miss: PDF non trouvé (${path})`);
      return null;
    } catch (error) {
      console.error('⚠️  Erreur lors de la vérification du cache PDF:', error);
      return null;
    }
  }

  /**
   * Upload le PDF vers Supabase Storage
   * 
   * @param pdfBuffer - Buffer du PDF
   * @param auditKey - Clé d'audit déterministe
   * @returns Résultat d'upload avec URL publique
   */
  async uploadToSupabase(
    pdfBuffer: Buffer,
    auditKey: string
  ): Promise<UploadResult> {
    console.log('☁️  Upload du PDF vers Supabase...');

    const path = `${auditKey}.pdf`;

    try {
      // Vérifier si le bucket existe, sinon le créer
      const { data: buckets } = await supabase.storage.listBuckets();
      const pdfBucketExists = buckets?.some((b) => b.name === 'pdf-reports');

      if (!pdfBucketExists) {
        console.log('📦 Création du bucket pdf-reports...');
        await supabase.storage.createBucket('pdf-reports', {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
      }

      // Upload du PDF
      const { data, error } = await supabase.storage
        .from('pdf-reports')
        .upload(path, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true, // Remplacer si existe
        });

      if (error) {
        throw new Error(`Supabase upload error: ${error.message}`);
      }

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('pdf-reports')
        .getPublicUrl(path);

      console.log(`✅ PDF uploadé: ${urlData.publicUrl}`);

      return {
        publicUrl: urlData.publicUrl,
        path: data.path,
        size: pdfBuffer.length,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload du PDF:', error);
      throw error;
    }
  }

  /**
   * Génère et upload le PDF en une seule opération
   * 
   * @param htmlContent - Contenu HTML complet
   * @param auditKey - Clé d'audit déterministe
   * @param options - Options de génération PDF
   * @returns URL publique du PDF
   */
  async generateAndUpload(
    htmlContent: string,
    auditKey: string,
    options: PdfOptions = {}
  ): Promise<{ publicUrl: string; fromCache: boolean }> {
    // Vérifier le cache
    const cachedUrl = await this.checkPdfCache(auditKey);
    if (cachedUrl) {
      return { publicUrl: cachedUrl, fromCache: true };
    }

    // Générer le PDF
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
 * Récupère l'instance singleton du PDF Generator
 */
export function getPdfGenerator(): PdfGenerator {
  if (!pdfGenerator) {
    pdfGenerator = new PdfGenerator();
  }
  return pdfGenerator;
}

/**
 * Ferme l'instance singleton (cleanup)
 */
export async function closePdfGenerator(): Promise<void> {
  if (pdfGenerator) {
    await pdfGenerator.close();
    pdfGenerator = null;
  }
}
