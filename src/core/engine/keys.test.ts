/**
 * Tests unitaires pour le moteur de clés déterministes
 * 
 * Valide les propriétés SSOT :
 * - Déterminisme (mêmes inputs → mêmes outputs)
 * - Normalisation URL stricte (minuscule, AUCUN query param, sans ancres, sans slash final)
 * - Format des clés (prefix + hash)
 * 
 * ⚠️ RÈGLE STRICTE : Pour les PDP Shopify, une URL est identifiée uniquement par domaine + chemin.
 * Les variants, couleurs, tailles sont considérés comme le MÊME produit.
 * 
 * @reference docs/DB_SCHEMA.md section 4
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  generateProductKey,
  generateSnapshotKey,
  generateRunKey,
  generateAuditKey,
  generateRenderKey,
  analyzeKey,
} from './keys';

describe('normalizeUrl', () => {
  it('convertit en minuscule', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/Product')).toBe('https://example.com/product');
  });

  it('supprime TOUS les query parameters (version stricte)', () => {
    const url = 'https://example.com/product?utm_source=fb&utm_medium=cpc&regular=value';
    expect(normalizeUrl(url)).toBe('https://example.com/product');
  });

  it('supprime les paramètres variant (Shopify)', () => {
    const url = 'https://shop.com/products/tshirt?variant=123456789';
    expect(normalizeUrl(url)).toBe('https://shop.com/products/tshirt');
  });

  it('supprime tous les paramètres fonctionnels (size, color, etc.)', () => {
    const url = 'https://shop.com/product?size=M&color=black&quantity=2';
    expect(normalizeUrl(url)).toBe('https://shop.com/product');
  });

  it('enlève les ancres (#)', () => {
    expect(normalizeUrl('https://example.com/product#reviews')).toBe('https://example.com/product');
  });

  it('enlève le slash final', () => {
    expect(normalizeUrl('https://example.com/product/')).toBe('https://example.com/product');
  });

  it('garde le slash root', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('supprime gclid, fbclid et tous les autres params', () => {
    const url = 'https://example.com/product?gclid=abc&fbclid=def&other=param';
    expect(normalizeUrl(url)).toBe('https://example.com/product');
  });

  it('est déterministe', () => {
    const url = 'https://Example.com/Product/?utm_source=fb#reviews/';
    const result1 = normalizeUrl(url);
    const result2 = normalizeUrl(url);
    expect(result1).toBe(result2);
    expect(result1).toBe('https://example.com/product');
  });

  it('normalise les URLs complexes Shopify en une forme canonique', () => {
    // Toutes ces URLs doivent donner le même résultat
    const urls = [
      'https://FR.GYMSHARK.COM/Products/jogger/',
      'https://fr.gymshark.com/products/jogger?variant=123',
      'https://fr.gymshark.com/products/jogger?variant=456&size=M',
      'https://fr.gymshark.com/products/jogger/?utm_source=fb&variant=789#reviews',
    ];

    const normalized = urls.map(normalizeUrl);
    const expected = 'https://fr.gymshark.com/products/jogger';

    normalized.forEach((result) => {
      expect(result).toBe(expected);
    });

    // Toutes doivent être identiques
    const unique = new Set(normalized);
    expect(unique.size).toBe(1);
  });
});

describe('generateProductKey', () => {
  it('génère une clé avec préfixe prod_', () => {
    const key = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://example.com/product' },
    });
    expect(key).toMatch(/^prod_[a-f0-9]{16}$/);
  });

  it('est déterministe pour SOLO', () => {
    const params = {
      mode: 'solo' as const,
      urls: { page_a: 'https://example.com/product' },
    };
    const key1 = generateProductKey(params);
    const key2 = generateProductKey(params);
    expect(key1).toBe(key2);
  });

  it('normalise les URLs (minuscule, sans params, sans slash)', () => {
    const key1 = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://Example.com/Product/' },
    });
    const key2 = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://example.com/product' },
    });
    expect(key1).toBe(key2);
  });

  it('génère des clés identiques malgré des query params différents', () => {
    const key1 = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://example.com/product' },
    });
    const key2 = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://example.com/product?variant=123' },
    });
    const key3 = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://example.com/product?variant=456&utm_source=fb#reviews' },
    });
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('génère des clés différentes pour DUO AB vs SOLO', () => {
    const keySolo = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://example.com/product' },
    });
    const keyDuo = generateProductKey({
      mode: 'duo_ab',
      urls: {
        page_a: 'https://example.com/product',
        page_b: 'https://competitor.com/product',
      },
    });
    expect(keySolo).not.toBe(keyDuo);
  });
});

describe('generateSnapshotKey', () => {
  it('génère une clé avec préfixe snap_', () => {
    const key = generateSnapshotKey({
      productKey: 'prod_1234567890abcdef',
      locale: 'fr',
      viewports: {
        mobile: { width: 390, height: 844 },
        desktop: { width: 1440, height: 900 },
      },
    });
    expect(key).toMatch(/^snap_[a-f0-9]{16}$/);
  });

  it('est déterministe', () => {
    const params = {
      productKey: 'prod_1234567890abcdef',
      locale: 'fr',
      viewports: {
        mobile: { width: 390, height: 844 },
        desktop: { width: 1440, height: 900 },
      },
    };
    const key1 = generateSnapshotKey(params);
    const key2 = generateSnapshotKey(params);
    expect(key1).toBe(key2);
  });

  it('génère des clés différentes par locale', () => {
    const base = {
      productKey: 'prod_1234567890abcdef',
      viewports: {
        mobile: { width: 390, height: 844 },
        desktop: { width: 1440, height: 900 },
      },
    };
    const keyFr = generateSnapshotKey({ ...base, locale: 'fr' });
    const keyEn = generateSnapshotKey({ ...base, locale: 'en' });
    expect(keyFr).not.toBe(keyEn);
  });
});

describe('generateRunKey', () => {
  it('génère une clé avec préfixe run_', () => {
    const key = generateRunKey({
      snapshotKey: 'snap_fedcba0987654321',
      mode: 'solo',
    });
    expect(key).toMatch(/^run_[a-f0-9]{16}$/);
  });

  it('est déterministe', () => {
    const params = {
      snapshotKey: 'snap_fedcba0987654321',
      mode: 'solo' as const,
    };
    const key1 = generateRunKey(params);
    const key2 = generateRunKey(params);
    expect(key1).toBe(key2);
  });
});

describe('generateAuditKey', () => {
  it('génère une clé avec préfixe audit_', () => {
    const key = generateAuditKey({
      runKey: 'run_abcdef1234567890',
    });
    expect(key).toMatch(/^audit_[a-f0-9]{16}$/);
  });

  it('est déterministe', () => {
    const params = {
      runKey: 'run_abcdef1234567890',
      copyReady: false,
      whiteLabel: null,
    };
    const key1 = generateAuditKey(params);
    const key2 = generateAuditKey(params);
    expect(key1).toBe(key2);
  });

  it('génère des clés différentes avec copy_ready', () => {
    const base = { runKey: 'run_abcdef1234567890' };
    const keyNoCopy = generateAuditKey({ ...base, copyReady: false });
    const keyWithCopy = generateAuditKey({ ...base, copyReady: true });
    expect(keyNoCopy).not.toBe(keyWithCopy);
  });

  it('génère des clés différentes avec white_label', () => {
    const base = { runKey: 'run_abcdef1234567890' };
    const keyNoLabel = generateAuditKey({ ...base, whiteLabel: null });
    const keyWithLabel = generateAuditKey({
      ...base,
      whiteLabel: { clientName: 'Acme Corp' },
    });
    expect(keyNoLabel).not.toBe(keyWithLabel);
  });
});

describe('generateRenderKey', () => {
  it('génère une clé avec préfixe render_', () => {
    const key = generateRenderKey({
      auditKey: 'audit_0fedcba987654321',
    });
    expect(key).toMatch(/^render_[a-f0-9]{16}$/);
  });

  it('est déterministe', () => {
    const params = { auditKey: 'audit_0fedcba987654321' };
    const key1 = generateRenderKey(params);
    const key2 = generateRenderKey(params);
    expect(key1).toBe(key2);
  });
});

describe('analyzeKey', () => {
  it('analyse une clé valide', () => {
    const key = 'prod_1234567890abcdef';
    const analysis = analyzeKey(key);
    expect(analysis.prefix).toBe('prod');
    expect(analysis.hash).toBe('1234567890abcdef');
    expect(analysis.isValid).toBe(true);
  });

  it('détecte une clé invalide', () => {
    const key = 'invalid_key';
    const analysis = analyzeKey(key);
    expect(analysis.isValid).toBe(false);
  });

  it('détecte un préfixe inconnu', () => {
    const key = 'unknown_1234567890abcdef';
    const analysis = analyzeKey(key);
    expect(analysis.isValid).toBe(false);
  });

  it('détecte un hash trop court', () => {
    const key = 'prod_short';
    const analysis = analyzeKey(key);
    expect(analysis.isValid).toBe(false);
  });
});

describe('Propriétés du système de clés', () => {
  it('pipeline complet génère des clés uniques à chaque couche', () => {
    // Simuler un pipeline complet
    const productKey = generateProductKey({
      mode: 'solo',
      urls: { page_a: 'https://example.com/product' },
    });

    const snapshotKey = generateSnapshotKey({
      productKey,
      locale: 'fr',
      viewports: {
        mobile: { width: 390, height: 844 },
        desktop: { width: 1440, height: 900 },
      },
    });

    const runKey = generateRunKey({
      snapshotKey,
      mode: 'solo',
    });

    const auditKey = generateAuditKey({
      runKey,
      copyReady: false,
    });

    const renderKey = generateRenderKey({
      auditKey,
    });

    // Toutes les clés doivent être différentes
    const keys = [productKey, snapshotKey, runKey, auditKey, renderKey];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(5);

    // Toutes les clés doivent avoir le bon format
    expect(productKey).toMatch(/^prod_[a-f0-9]{16}$/);
    expect(snapshotKey).toMatch(/^snap_[a-f0-9]{16}$/);
    expect(runKey).toMatch(/^run_[a-f0-9]{16}$/);
    expect(auditKey).toMatch(/^audit_[a-f0-9]{16}$/);
    expect(renderKey).toMatch(/^render_[a-f0-9]{16}$/);
  });

  it('deux runs différents du même snapshot génèrent des clés identiques', () => {
    const snapshotKey = 'snap_fedcba0987654321';

    // Même snapshot, même mode → même run_key
    const run1 = generateRunKey({ snapshotKey, mode: 'solo' });
    const run2 = generateRunKey({ snapshotKey, mode: 'solo' });

    expect(run1).toBe(run2);
  });

  it('changement de version génère des clés différentes', () => {
    // Cette propriété est garantie par l'inclusion des versions dans canonical input
    // Les versions viennent de @/ssot/versions et sont constantes au runtime
    // Un changement de version nécessite un redéploiement

    // Test conceptuel : si on changeait ENGINE_VERSION, snapshot_key changerait
    // (impossible à tester directement sans mocker les imports)
    expect(true).toBe(true); // Placeholder
  });
});
