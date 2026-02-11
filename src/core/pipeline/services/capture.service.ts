/**
 * ⚠️ CAPTURE SERVICE — Playwright Capture + Storage
 *
 * Orchestrates capture (Playwright) and upload (Supabase) of artifacts.
 * Reference: docs/AUDIT_PIPELINE_SPEC.md
 */

import { PlaywrightService, type CaptureResult, type CaptureError } from '@/adapters/capture/playwright.service';
import { SupabaseStorageService, type UploadResult, type UploadError } from '@/adapters/storage/supabase.service';

export interface CaptureServiceOptions {
  timeout?: number;
  blockResources?: boolean;
}

export interface StorageRefs {
  mobile: { screenshot?: string; html?: string };
  desktop: { screenshot?: string; html?: string };
}

export interface CaptureServiceResult {
  success: boolean;
  captureResults?: {
    mobile: CaptureResult | CaptureError;
    desktop: CaptureResult | CaptureError;
  };
  storageRefs: StorageRefs;
  errors: Array<{
    stage: string;
    code: string;
    message: string;
    timestamp: string;
  }>;
}

function isCaptureSuccess(r: CaptureResult | CaptureError): r is CaptureResult {
  return r.success === true;
}

function isUploadSuccess(r: UploadResult | UploadError): r is UploadResult {
  return (r as UploadResult).publicUrl !== undefined;
}

/**
 * Service de capture et storage
 */
export class CaptureService {
  private playwrightService = PlaywrightService.getInstance();
  private storageService = SupabaseStorageService.getInstance();

  /**
   * Executes Playwright capture (mobile + desktop) and artifact upload
   */
  async runCapture(
    url: string,
    auditKey: string,
    options: CaptureServiceOptions = {}
  ): Promise<CaptureServiceResult> {
    const { timeout = 15000, blockResources = true } = options;
    const errors: CaptureServiceResult['errors'] = [];
    const storageRefs: StorageRefs = { mobile: {}, desktop: {} };

    let captureResults: { mobile: CaptureResult | CaptureError; desktop: CaptureResult | CaptureError };

    try {
      captureResults = await this.playwrightService.captureBothViewports(url, {
        timeout,
        blockResources,
      });
    } catch (error) {
      errors.push({
        stage: 'capture',
        code: 'CAPTURE_FATAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown capture error',
        timestamp: new Date().toISOString(),
      });
      return { success: false, storageRefs, errors };
    }

    if (!isCaptureSuccess(captureResults.mobile) || !isCaptureSuccess(captureResults.desktop)) {
      if (!isCaptureSuccess(captureResults.mobile)) {
        errors.push({
          stage: 'capture_mobile',
          code: captureResults.mobile.error.type,
          message: captureResults.mobile.error.message,
          timestamp: new Date().toISOString(),
        });
      }
      if (!isCaptureSuccess(captureResults.desktop)) {
        errors.push({
          stage: 'capture_desktop',
          code: captureResults.desktop.error.type,
          message: captureResults.desktop.error.message,
          timestamp: new Date().toISOString(),
        });
      }
      return { success: false, captureResults, storageRefs, errors };
    }

    await this.storageService.initialize();

    if (isCaptureSuccess(captureResults.mobile)) {
      const screenshotResult = await this.storageService.uploadScreenshot(
        auditKey,
        'mobile',
        captureResults.mobile.screenshot
      );
      if (isUploadSuccess(screenshotResult)) {
        storageRefs.mobile.screenshot = screenshotResult.publicUrl;
      } else {
        errors.push({
          stage: 'storage_mobile_screenshot',
          code: screenshotResult.error.type,
          message: screenshotResult.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      const htmlResult = await this.storageService.uploadHtml(
        auditKey,
        'mobile',
        captureResults.mobile.html
      );
      if (isUploadSuccess(htmlResult)) {
        storageRefs.mobile.html = htmlResult.publicUrl;
      } else {
        errors.push({
          stage: 'storage_mobile_html',
          code: htmlResult.error.type,
          message: htmlResult.error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (isCaptureSuccess(captureResults.desktop)) {
      const screenshotResult = await this.storageService.uploadScreenshot(
        auditKey,
        'desktop',
        captureResults.desktop.screenshot
      );
      if (isUploadSuccess(screenshotResult)) {
        storageRefs.desktop.screenshot = screenshotResult.publicUrl;
      } else {
        errors.push({
          stage: 'storage_desktop_screenshot',
          code: screenshotResult.error.type,
          message: screenshotResult.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      const htmlResult = await this.storageService.uploadHtml(
        auditKey,
        'desktop',
        captureResults.desktop.html
      );
      if (isUploadSuccess(htmlResult)) {
        storageRefs.desktop.html = htmlResult.publicUrl;
      } else {
        errors.push({
          stage: 'storage_desktop_html',
          code: htmlResult.error.type,
          message: htmlResult.error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      success: true,
      captureResults,
      storageRefs,
      errors,
    };
  }

  closePlaywright(): Promise<void> {
    return this.playwrightService.close();
  }
}
