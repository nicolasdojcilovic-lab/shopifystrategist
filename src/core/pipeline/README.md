# Pipeline — AuditService (Orchestrateur)

**Version:** 1.0  
**Référence SSOT:** `docs/AUDIT_PIPELINE_SPEC.md`

## 📖 Objectif

L'**AuditService** est l'orchestrateur central du pipeline d'audit ShopifyStrategist. Il coordonne l'exécution end-to-end :

1. **Cache Check** : Vérification des clés déterministes
2. **Capture** : Playwright (Mobile + Desktop)
3. **Storage** : Upload Supabase (screenshots + HTML)
4. **Persistence** : Enregistrement Prisma (Product → Snapshot → SnapshotSource → ScoreRun)
5. **Scoring** : *(TODO: Détecteurs + Scoring Engine)*
6. **Report Generation** : *(TODO: HTML SSOT)*

---

## 🎯 Usage

### Import

```typescript
import { AuditService } from '@/core/pipeline/audit.service';
```

### Exécution d'un audit SOLO

```typescript
const service = new AuditService();

const result = await service.runSoloAudit(
  'https://fr.gymshark.com/products/gymshark-crest-straight-leg-joggers-black-aw23',
  {
    locale: 'fr',
    copyReady: false,
    captureTimeout: 15000,
    blockResources: true,
  }
);

console.log('Status:', result.status); // 'ok' | 'degraded' | 'failed'
console.log('From Cache:', result.fromCache);
console.log('Duration:', result.duration, 'ms');
console.log('Tickets:', result.exports?.tickets.length);
console.log('Evidences:', result.exports?.evidences.length);
```

---

## 🔑 Clés Déterministes (SSOT)

Le service génère automatiquement toutes les clés du cache multi-couches :

- **`product_key`** : Hash(mode + normalized_urls + NORMALIZE_VERSION)
- **`snapshot_key`** : Hash(product_key + locale + viewports + ENGINE_VERSION)
- **`run_key`** : Hash(snapshot_key + DETECTORS_VERSION + SCORING_VERSION + mode)
- **`audit_key`** : Hash(run_key + REPORT_OUTLINE_VERSION + copy_ready + white_label)

**Règle SSOT** : Mêmes entrées + mêmes versions → mêmes clés → cache hit garanti.

---

## 💾 Cache Hit Detection

Si un `ScoreRun` avec le même `run_key` existe déjà en base et a un `status = "ok"`, le service **retourne immédiatement** le résultat en cache :

```typescript
if (existingRun && existingRun.status === 'ok') {
  return {
    keys,
    status: 'ok',
    fromCache: true,
    exports: existingRun.exports,
    // ...
  };
}
```

**Durée typique d'un cache hit** : < 100ms (simple query Prisma).

**Avantage** : Évite les captures coûteuses et garantit la cohérence.

---

## 📸 Capture (Playwright)

Le service utilise `PlaywrightService.captureBothViewports()` pour :

- Capturer **Mobile** (390×844) et **Desktop** (1440×900) **en parallèle**
- Appliquer le **resource blocking** (analytics, fonts, media)
- Utiliser **smart waiting** + **fast-scroll** pour lazy-load
- Enforcer un **hard timeout** (défaut: 15s par viewport)

**Mode Dégradé** : Si la capture échoue, le service enregistre l'erreur dans `errors[]` et retourne `status: 'failed'`.

---

## ☁️  Storage (Supabase)

Les artifacts capturés sont uploadés vers Supabase Storage :

**Screenshots** :
- `screenshots/${audit_key}_mobile.png`
- `screenshots/${audit_key}_desktop.png`

**HTML** :
- `html-reports/${audit_key}_mobile.html`
- `html-reports/${audit_key}_desktop.html`

**Gestion d'erreurs** : Si un upload échoue, l'erreur est enregistrée dans `errors[]` et le `storage_path` reste `undefined`.

---

## 🗄️  Persistence (Prisma)

Le service enregistre dans l'ordre :

1. **Product** : `upsert` avec `product_key` (mise à jour de `last_seen_at`)
2. **Snapshot** : `upsert` avec `snapshot_key`
3. **SnapshotSource** : `upsert` pour `page_a` (SOLO) avec artefacts
4. **ScoreRun** : `upsert` avec exports (Ticket v2 + Evidence v2)

**SSOT Anti-Drift** : Les clés sont `UNIQUE`, garantissant qu'un même résultat ne sera jamais dupliqué.

---

## 🚧 État Actuel (MVP)

### ✅ Implémenté

- Génération clés déterministes
- Cache check (Product → Snapshot → ScoreRun)
- Capture Playwright (Mobile + Desktop, optimisée)
- Upload Supabase (screenshots + HTML)
- Persistence Prisma (4 tables)
- Gestion d'erreurs robuste (try/catch par stage)

### ⏳ TODO (Prochaines étapes)

- **Détecteurs** : Implémentation des signaux SSOT (`docs/DETECTORS_SPEC.md`)
- **Scoring Engine** : Génération des tickets réels (`docs/SCORING_AND_DETECTION.md`)
- **Evidence v2** : Création des preuves structurées
- **Report HTML** : Génération du rapport SSOT (`docs/REPORT_OUTLINE.md`)
- **PDF Export** : Via Playwright (dérivé du HTML)
- **CSV v1** : Export tabular (`docs/REPORT_OUTLINE.md` section 12)

---

## 🎛️  Options d'Audit

```typescript
interface AuditOptions {
  locale?: string; // Défaut: 'fr'
  copyReady?: boolean; // Défaut: false (textes techniques vs business-ready)
  whiteLabel?: {
    logo?: string;
    clientName?: string;
    agencyName?: string;
  } | null;
  captureTimeout?: number; // ms (défaut: 15000)
  blockResources?: boolean; // Défaut: true (bloquer analytics/fonts/media)
}
```

---

## 📊 Structure du Résultat

```typescript
interface AuditResult {
  keys: {
    productKey: string;
    snapshotKey: string;
    runKey: string;
    auditKey: string;
  };

  status: 'ok' | 'degraded' | 'failed';
  duration: number; // ms
  fromCache: boolean;

  exports?: {
    tickets: TicketV2[];
    evidences: EvidenceV2[];
  };

  errors: Array<{
    stage: string; // 'capture_mobile', 'storage', 'persistence', etc.
    code: string; // 'TIMEOUT', 'STORAGE_ERROR', etc.
    message: string;
    timestamp: string;
  }>;

  reportMeta?: {
    mode: 'solo';
    evidence_completeness: 'complete' | 'partial' | 'insufficient';
    alignment_level: null; // SOLO = null
    url: string;
    normalized_url: string;
    locale: string;
    captured_at: string;
  };

  artifacts?: {
    screenshots: {
      mobile?: { above_fold?: string };
      desktop?: { above_fold?: string };
    };
    html_refs?: {
      mobile?: string;
      desktop?: string;
    };
  };
}
```

---

## 🔒 Mode Dégradé (SSOT)

Conformément à `docs/AUDIT_PIPELINE_SPEC.md`, le service **doit toujours livrer un résultat exploitable**, même en cas d'échec partiel.

### Statuts

- **`ok`** : Pipeline complet sans erreur
- **`degraded`** : Pipeline terminé avec des erreurs non-bloquantes (ex: un screenshot manquant)
- **`failed`** : Échec fatal (ex: capture totale impossible)

### Exemples de Dégradation

| Scénario | Status | Exports | Artifacts |
|----------|--------|---------|-----------|
| Capture réussie, storage OK | `ok` | ✅ Tickets + Evidences | ✅ Tous les refs |
| Capture OK, storage mobile échoue | `degraded` | ✅ Tickets (evidence partielle) | ❌ Mobile screenshot manquant |
| Capture timeout total | `failed` | ❌ Aucun | ❌ Aucun |

---

## 🧪 Testing

### Script de test

```bash
npm run test:audit
```

*(À créer)*

### Test manuel

```typescript
// scripts/test-audit.ts
import { AuditService } from '@/core/pipeline/audit.service';

async function main() {
  const service = new AuditService();

  const result = await service.runSoloAudit(
    'https://www.allbirds.com/products/mens-tree-runners'
  );

  console.log(JSON.stringify(result, null, 2));
}

main();
```

---

## 📚 Références SSOT

- `docs/AUDIT_PIPELINE_SPEC.md` — Architecture pipeline
- `docs/DB_SCHEMA.md` — Schéma base de données
- `docs/SCORING_AND_DETECTION.md` — Signaux + Tickets
- `docs/DETECTORS_SPEC.md` — Détecteurs
- `docs/REPORT_OUTLINE.md` — Structure rapport HTML
- `src/core/engine/keys.ts` — Génération clés déterministes
- `src/adapters/capture/playwright.service.ts` — Capture optimisée
- `src/adapters/storage/supabase.service.ts` — Storage cloud
- `src/contracts/export/ticket.v2.ts` — Schéma Ticket v2
- `src/contracts/export/evidence.v2.ts` — Schéma Evidence v2

---

## 🚀 Prochaines Étapes (Roadmap)

1. **Créer le script de test** : `scripts/test-audit.ts`
2. **Implémenter les détecteurs** : `src/core/detectors/*`
3. **Brancher le scoring engine** : `src/core/scoring/*`
4. **Générer le rapport HTML** : `src/core/pipeline/report-generator.ts`
5. **Intégrer l'API publique** : `app/api/audit-solo/route.ts`
