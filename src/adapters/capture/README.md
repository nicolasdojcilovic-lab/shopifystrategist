# Capture Adapter — Playwright Service

**Module** : `src/adapters/capture/playwright.service.ts`  
**Référence SSOT** : `docs/AUDIT_PIPELINE_SPEC.md` (capture stage)

---

## 🎯 Objectif

Service de capture de pages web via Playwright.
Prépare les métadonnées conformes à `EvidenceV2` (SSOT).

---

## 📦 Exports

### `PlaywrightService`

Classe principale pour la capture de pages.

**Méthodes** :
- `initialize()` : Initialiser le navigateur
- `close()` : Fermer le navigateur
- `capturePage(url, viewport, options?)` : Capturer une page (1 viewport)
- `captureBothViewports(url, options?)` : Capturer les 2 viewports (mobile + desktop)
- `isReady()` : Vérifier si le service est prêt

### Viewports Standards (SSOT)

```typescript
export const VIEWPORTS = {
  mobile: {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};
```

**Référence** : `docs/SCORING_AND_DETECTION.md` section 2.1

---

## 🚀 Utilisation

### Exemple Basique

```typescript
import { PlaywrightService } from '@/adapters/capture/playwright.service';

const service = new PlaywrightService();

// Initialiser
await service.initialize();

// Capturer mobile
const result = await service.capturePage(
  'https://shop.com/products/item',
  'mobile'
);

if (result.success) {
  console.log('Screenshot:', result.screenshot.length, 'bytes');
  console.log('HTML:', result.html.length, 'chars');
  console.log('Timestamp:', result.timestamp);
  console.log('Metadata:', result.metadata);
}

// Fermer
await service.close();
```

### Capture des 2 Viewports

```typescript
const results = await service.captureBothViewports('https://shop.com/product');

if (results.mobile.success) {
  console.log('Mobile OK');
}

if (results.desktop.success) {
  console.log('Desktop OK');
}
```

### Avec Options

```typescript
const result = await service.capturePage(
  'https://shop.com/product',
  'desktop',
  {
    timeout: 60000, // 60s
    blockResources: true, // ⚡ Bloquer tracking/analytics (default: true)
    userAgent: 'Custom Bot/1.0',
    extraHeaders: {
      'X-Custom-Header': 'value',
    },
  }
);
```

---

## ⚡ Optimisations de Performance

### Resource Blocking

Le service bloque automatiquement les ressources non essentielles pour accélérer la capture :

**Domaines bloqués** (30+ domaines) :
- Analytics : `google-analytics.com`, `googletagmanager.com`, `klaviyo.com`, `hotjar.com`
- Ads : `doubleclick.net`, `adroll.com`, `criteo.com`
- Social widgets : `platform.twitter.com`, `connect.facebook.net`
- Chat widgets : `tawk.to`, `zendesk.com`, `drift.com`

**Patterns bloqués** :
- `track`, `pixel`, `ads`, `analytics`, `beacon`, `telemetry`

**Types de ressources bloquées** :
- Vidéos (`.mp4`, `.webm`, `.ogg`)
- GIF animés lourds (Giphy, Tenor)
- Fonts non critiques

**Résultat** : **-40% de temps de chargement** en moyenne

### Navigation Strategy

Le service utilise `domcontentloaded` pour une performance maximale :

```typescript
// ⚡ Attend uniquement le DOM (très rapide)
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Puis attend 3s pour les images lazy-load
await page.waitForTimeout(3000);
```

**Balance** : DOM prêt en ~1-2s + 3s d'attente images = **~5s total** pour la plupart des sites

### Performance Attendue

| Type de Site | Temps | Qualité |
|--------------|-------|---------|
| **Shopify standard** | 8-15s | ✅ Excellent |
| **Sites moyens** | 15-25s | ✅ Bon |
| **Sites lourds** (Gymshark) | 40-50s | ✅ Acceptable |
| **Sites légers** | <5s | ✅ Parfait |

**Désactiver le blocage** (plus lent mais complet) :
```typescript
await service.capturePage(url, 'mobile', {
  blockResources: false, // Charger TOUTES les ressources
  timeout: 120000, // Augmenter le timeout
});
```

**Rapport détaillé** : Voir `PERFORMANCE_OPTIMIZATION_REPORT.md`

### Singleton Global

```typescript
import { getPlaywrightService, closeGlobalPlaywrightService } from '@/adapters/capture/playwright.service';

// Utiliser l'instance globale
const service = getPlaywrightService();
await service.initialize();

const result = await service.capturePage('https://shop.com/product', 'mobile');

// Fermer l'instance globale (cleanup)
await closeGlobalPlaywrightService();
```

---

## 📊 Types

### `CaptureResult` (succès)

```typescript
interface CaptureResult {
  success: true;
  url: string;
  viewport: 'mobile' | 'desktop';
  timestamp: string; // ISO 8601
  screenshot: Buffer; // PNG
  html: string;
  metadata: {
    width: number;
    height: number;
    deviceScaleFactor: number;
    loadDurationMs: number;
    fullPageHeight: number;
  };
}
```

### `CaptureError` (échec)

```typescript
interface CaptureError {
  success: false;
  url: string;
  viewport: 'mobile' | 'desktop';
  error: {
    type: 'timeout' | 'not_found' | 'network_error' | 'unknown';
    message: string;
    code?: string;
  };
  timestamp: string; // ISO 8601
}
```

### `CaptureOptions`

```typescript
interface CaptureOptions {
  timeout?: number; // default: 30000ms
  blockResources?: boolean; // default: true (bloquer tracking/analytics)
  userAgent?: string;
  extraHeaders?: Record<string, string>;
}
```

---

## 🔧 Configuration

### Variables d'Environnement

```env
# Mode headless (true/false)
PLAYWRIGHT_HEADLESS=true

# Browser (chromium/firefox/webkit)
PLAYWRIGHT_BROWSER=chromium
```

---

## ✅ Gestion d'Erreurs

Le service gère automatiquement les erreurs suivantes :

### `timeout`
```typescript
{
  success: false,
  error: {
    type: 'timeout',
    message: 'Page load timeout after 30000ms',
  }
}
```

### `not_found` (HTTP 404)
```typescript
{
  success: false,
  error: {
    type: 'not_found',
    message: 'Page not found (HTTP 404)',
    code: '404',
  }
}
```

### `network_error` (HTTP 5xx, connexion échouée)
```typescript
{
  success: false,
  error: {
    type: 'network_error',
    message: 'HTTP error 503',
    code: '503',
  }
}
```

### `unknown`
```typescript
{
  success: false,
  error: {
    type: 'unknown',
    message: 'Unknown error',
  }
}
```

---

## 🧪 Tests

### Scripts de Test

```bash
# Test simple (example.com, ~3s)
PLAYWRIGHT_BROWSERS_PATH=0 npm run test:playwright:simple

# Test complet (Gymshark, ~50s)
PLAYWRIGHT_BROWSERS_PATH=0 npm run test:playwright

# Benchmark de performance
PLAYWRIGHT_BROWSERS_PATH=0 npm run benchmark:capture
```

**Ce que fait le script de test** :
1. ✅ Capture mobile (390×844)
2. ✅ Capture desktop (1440×900)
3. ✅ Test `captureBothViewports()`
4. ✅ Test gestion d'erreur (URL invalide)
5. ✅ Sauvegarde screenshots dans `tmp/`

**Output attendu** :
```
📱 Capture Mobile (390×844)...
   ✅ Succès
   • Screenshot: 245.67 KB
   • HTML: 123.45 KB
   • Durée: 2345ms
   • Hauteur page: 3456px
   • Timestamp: 2026-01-24T10:30:45.123Z
   • Sauvegardé: tmp/test-capture-mobile.png

🖥️  Capture Desktop (1440×900)...
   ✅ Succès
   • Screenshot: 567.89 KB
   • HTML: 123.45 KB
   • Durée: 1987ms
   • Hauteur page: 2890px
   • Timestamp: 2026-01-24T10:30:47.456Z
   • Sauvegardé: tmp/test-capture-desktop.png
```

---

## 🔗 Intégration avec EvidenceV2

Le service prépare les métadonnées conformes au contrat SSOT :

```typescript
import { generateEvidenceId, generateEvidenceAnchor } from '@/contracts/export/evidence.v2';
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';

// Après capture
const result = await service.capturePage(url, 'mobile');

if (result.success) {
  // Générer l'evidence_id (SSOT)
  const evidenceId = generateEvidenceId(
    'page_a',
    'mobile',
    'screenshot',
    'Above Fold',
    1
  );
  // => "E_page_a_mobile_screenshot_above_fold_01"

  // Créer l'Evidence
  const evidence: EvidenceV2 = {
    evidence_id: evidenceId,
    level: 'A',
    type: 'screenshot',
    label: 'Screenshot Above-the-fold (Mobile)',
    source: 'page_a',
    viewport: 'mobile',
    timestamp: result.timestamp,
    ref: generateEvidenceAnchor(evidenceId),
    details: {
      width: result.metadata.width,
      height: result.metadata.height,
      device_scale_factor: result.metadata.deviceScaleFactor,
      full_page_height: result.metadata.fullPageHeight,
      load_duration_ms: result.metadata.loadDurationMs,
      storage_ref: `storage://snapshots/${snapshotKey}/page_a/mobile/above_fold.png`,
    },
  };
}
```

---

## 📚 Références

- **Evidence Schema** : `src/contracts/export/evidence.v2.ts`
- **DB Schema** : `docs/DB_SCHEMA.md` (SnapshotSource.artefacts)
- **Pipeline Spec** : `docs/AUDIT_PIPELINE_SPEC.md` (capture stage)
- **Scoring** : `docs/SCORING_AND_DETECTION.md` (viewports standards)

---

**Créé** : 2026-01-24  
**Maintenu par** : Équipe ShopifyStrategist
