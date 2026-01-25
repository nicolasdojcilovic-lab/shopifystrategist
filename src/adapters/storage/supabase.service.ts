/**
 * ⚠️ SUPABASE STORAGE SERVICE — Storage Adapter (SSOT)
 * 
 * Service de stockage pour screenshots et HTML via Supabase Storage.
 * Gère les uploads avec support du cache (audit_key déterministe).
 * 
 * Référence:
 * - docs/DB_SCHEMA.md (SnapshotSource.storage_refs)
 * - src/contracts/export/evidence.v2.ts (storage_path)
 * - docs/AUDIT_PIPELINE_SPEC.md (storage stage)
 * 
 * @version ENGINE_VERSION = 1.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Configuration Supabase Storage
 */
const STORAGE_CONFIG = {
  buckets: {
    screenshots: 'screenshots',
    html: 'html-reports',
  },
  // Policy: public read, authenticated write
  publicAccess: true,
} as const;

/**
 * Résultat d'upload (succès)
 */
export interface UploadResult {
  success: true;
  path: string;
  publicUrl: string;
  size: number;
  cached: boolean; // true si fichier existait déjà
}

/**
 * Résultat d'upload (échec)
 */
export interface UploadError {
  success: false;
  error: {
    type: 'storage_error' | 'network_error' | 'auth_error' | 'unknown';
    message: string;
    code?: string;
  };
}

/**
 * Options d'upload
 */
export interface UploadOptions {
  /** Écraser si le fichier existe (default: true) */
  overwrite?: boolean;
  
  /** Content-Type personnalisé (optionnel) */
  contentType?: string;
  
  /** Vérifier l'existence avant upload (default: true) */
  checkExisting?: boolean;
}

/**
 * Service de Stockage Supabase
 * 
 * Singleton pour gérer les uploads vers Supabase Storage.
 * Implémente le pattern adapter pour isoler la logique de stockage.
 * 
 * Architecture SSOT:
 * - Utilise audit_key déterministe comme base des noms de fichiers
 * - Support du cache: si fichier existe, peut retourner URL existante
 * - Chemins standardisés pour traçabilité
 */
export class SupabaseStorageService {
  private static instance: SupabaseStorageService | null = null;
  private client: SupabaseClient | null = null;
  private isInitialized = false;

  /**
   * Private constructor pour forcer l'utilisation du singleton
   */
  private constructor() {}

  /**
   * Obtenir l'instance singleton
   */
  static getInstance(): SupabaseStorageService {
    if (!SupabaseStorageService.instance) {
      SupabaseStorageService.instance = new SupabaseStorageService();
    }
    return SupabaseStorageService.instance;
  }

  /**
   * Récupère le client Supabase (pour opérations avancées)
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Initialiser le client Supabase
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    // Utiliser SERVICE_ROLE_KEY si disponible, sinon ANON_KEY
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase credentials: SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) required in .env'
      );
    }

    try {
      this.client = createClient(supabaseUrl, supabaseKey);
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Supabase client: ${error}`);
    }
  }

  /**
   * ⚡ Upload Screenshot (PNG Buffer)
   * 
   * Chemin: screenshots/${auditKey}_${viewport}.png
   * 
   * @param auditKey - Clé d'audit déterministe (SSOT)
   * @param viewport - Viewport (mobile|desktop)
   * @param buffer - PNG buffer
   * @param options - Options d'upload
   * @returns Résultat avec publicUrl
   * 
   * @example
   * const service = new SupabaseStorageService();
   * await service.initialize();
   * 
   * const result = await service.uploadScreenshot(
   *   'audit_abc123',
   *   'mobile',
   *   screenshotBuffer
   * );
   * 
   * if (result.success) {
   *   console.log('URL:', result.publicUrl);
   *   console.log('Cached:', result.cached);
   * }
   */
  async uploadScreenshot(
    auditKey: string,
    viewport: 'mobile' | 'desktop',
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult | UploadError> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: {
          type: 'unknown',
          message: 'Supabase client not initialized',
        },
      };
    }

    const {
      overwrite = true,
      checkExisting = true,
      contentType = 'image/png',
    } = options;

    try {
      // Générer le chemin du fichier
      const filename = `${auditKey}_${viewport}.png`;
      const path = `screenshots/${filename}`;

      // Vérifier si le fichier existe déjà (cache hit)
      if (checkExisting) {
        const { data: existingFile } = await this.client.storage
          .from(STORAGE_CONFIG.buckets.screenshots)
          .list('screenshots', {
            search: filename,
          });

        if (existingFile && existingFile.length > 0) {
          // Fichier existe déjà
          if (!overwrite) {
            // Retourner l'URL existante (cache hit)
            const { data: publicUrlData } = this.client.storage
              .from(STORAGE_CONFIG.buckets.screenshots)
              .getPublicUrl(path);

            return {
              success: true,
              path,
              publicUrl: publicUrlData.publicUrl,
              size: existingFile[0]?.metadata?.size || buffer.length,
              cached: true,
            };
          }
          // Sinon, écraser (continue)
        }
      }

      // Upload du screenshot
      const { data, error } = await this.client.storage
        .from(STORAGE_CONFIG.buckets.screenshots)
        .upload(path, buffer, {
          contentType,
          upsert: overwrite, // Écraser si existe
        });

      if (error) {
        return {
          success: false,
          error: {
            type: 'storage_error',
            message: error.message,
            code: error.name,
          },
        };
      }

      // Récupérer la publicUrl
      const { data: publicUrlData } = this.client.storage
        .from(STORAGE_CONFIG.buckets.screenshots)
        .getPublicUrl(data.path);

      return {
        success: true,
        path: data.path,
        publicUrl: publicUrlData.publicUrl,
        size: buffer.length,
        cached: false,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          type: 'unknown',
          message: error.message || 'Unknown upload error',
          code: error.code,
        },
      };
    }
  }

  /**
   * ⚡ Upload HTML Report
   * 
   * Chemin: html-reports/${auditKey}_${viewport}.html
   * 
   * @param auditKey - Clé d'audit déterministe (SSOT)
   * @param viewport - Viewport (mobile|desktop)
   * @param html - Contenu HTML
   * @param options - Options d'upload
   * @returns Résultat avec publicUrl
   * 
   * @example
   * const result = await service.uploadHtml(
   *   'audit_abc123',
   *   'mobile',
   *   htmlContent
   * );
   * 
   * if (result.success) {
   *   console.log('URL:', result.publicUrl);
   * }
   */
  async uploadHtml(
    auditKey: string,
    viewport: 'mobile' | 'desktop',
    html: string,
    options: UploadOptions = {}
  ): Promise<UploadResult | UploadError> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: {
          type: 'unknown',
          message: 'Supabase client not initialized',
        },
      };
    }

    const {
      overwrite = true,
      checkExisting = true,
      contentType = 'text/html; charset=utf-8',
    } = options;

    try {
      // Générer le chemin du fichier
      const filename = `${auditKey}_${viewport}.html`;
      const path = `html-reports/${filename}`;

      // Vérifier si le fichier existe déjà (cache hit)
      if (checkExisting) {
        const { data: existingFile } = await this.client.storage
          .from(STORAGE_CONFIG.buckets.html)
          .list('html-reports', {
            search: filename,
          });

        if (existingFile && existingFile.length > 0) {
          // Fichier existe déjà
          if (!overwrite) {
            // Retourner l'URL existante (cache hit)
            const { data: publicUrlData } = this.client.storage
              .from(STORAGE_CONFIG.buckets.html)
              .getPublicUrl(path);

            return {
              success: true,
              path,
              publicUrl: publicUrlData.publicUrl,
              size: existingFile[0]?.metadata?.size || html.length,
              cached: true,
            };
          }
          // Sinon, écraser (continue)
        }
      }

      // Convertir HTML en buffer
      const buffer = Buffer.from(html, 'utf-8');

      // Upload du HTML
      const { data, error } = await this.client.storage
        .from(STORAGE_CONFIG.buckets.html)
        .upload(path, buffer, {
          contentType,
          upsert: overwrite, // Écraser si existe
        });

      if (error) {
        return {
          success: false,
          error: {
            type: 'storage_error',
            message: error.message,
            code: error.name,
          },
        };
      }

      // Récupérer la publicUrl
      const { data: publicUrlData } = this.client.storage
        .from(STORAGE_CONFIG.buckets.html)
        .getPublicUrl(data.path);

      return {
        success: true,
        path: data.path,
        publicUrl: publicUrlData.publicUrl,
        size: html.length,
        cached: false,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          type: 'unknown',
          message: error.message || 'Unknown upload error',
          code: error.code,
        },
      };
    }
  }

  /**
   * Vérifier si le service est prêt
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }
}

/**
 * Singleton instance (optionnel)
 * 
 * Utiliser cette instance globale pour éviter de créer
 * plusieurs clients Supabase en parallèle.
 */
let globalService: SupabaseStorageService | null = null;

export function getSupabaseStorageService(): SupabaseStorageService {
  if (!globalService) {
    globalService = SupabaseStorageService.getInstance();
  }
  return globalService;
}

export async function closeGlobalSupabaseStorageService(): Promise<void> {
  if (globalService) {
    // Supabase client n'a pas de méthode close explicite
    globalService = null;
  }
}
