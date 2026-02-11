# Pipeline — AuditService (Orchestrator)

**Version:** 1.0  
**SSOT Reference:** `docs/AUDIT_PIPELINE_SPEC.md`

## 📖 Objective

The **AuditService** is the central orchestrator of the ShopifyStrategist audit pipeline. It coordinates end-to-end execution:

1. **Cache Check** : Deterministic key verification
2. **Capture** : Playwright (Mobile + Desktop)
3. **Storage** : Supabase upload (screenshots + HTML)
4. **Persistence** : Prisma records (Product → Snapshot → SnapshotSource → ScoreRun)
5. **Scoring** : *(TODO: Detectors + Scoring Engine)*
6. **Report Generation** : *(TODO: HTML SSOT)*

---

## 🎯 Usage

### Import

```typescript
import { AuditService } from '@/core/pipeline/audit.service';
```

### Running a SOLO audit

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

## 🔑 Deterministic Keys (SSOT)

The service automatically generates all multi-layer cache keys:

- **`product_key`** : Hash(mode + normalized_urls + NORMALIZE_VERSION)
- **`snapshot_key`** : Hash(product_key + locale + viewports + ENGINE_VERSION)
- **`run_key`** : Hash(snapshot_key + DETECTORS_VERSION + SCORING_VERSION + mode)
- **`audit_key`** : Hash(run_key + REPORT_OUTLINE_VERSION + copy_ready + white_label)

**SSOT Rule** : Same inputs + same versions → same keys → guaranteed cache hit.

---

## 💾 Cache Hit Detection

If a `ScoreRun` with the same `run_key` already exists in the database and has `status = "ok"`, the service **returns immediately** the cached result:

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

**Typical cache hit duration** : < 100ms (simple Prisma query).

**Benefit** : Avoids expensive captures and guarantees consistency.

---

## 📸 Capture (Playwright)

The service uses `PlaywrightService.captureBothViewports()` to:

- Capture **Mobile** (390×844) and **Desktop** (1440×900) **in parallel**
- Apply **resource blocking** (analytics, fonts, media)
- Use **smart waiting** + **fast-scroll** for lazy-load
- Enforce a **hard timeout** (default: 15s per viewport)

**Degraded Mode** : If capture fails, the service records the error in `errors[]` and returns `status: 'failed'`.

---

## ☁️  Storage (Supabase)

Captured artifacts are uploaded to Supabase Storage:

**Screenshots** :
- `screenshots/${audit_key}_mobile.png`
- `screenshots/${audit_key}_desktop.png`

**HTML** :
- `html-reports/${audit_key}_mobile.html`
- `html-reports/${audit_key}_desktop.html`

**Error handling** : If an upload fails, the error is recorded in `errors[]` and `storage_path` remains `undefined`.

---

## 🗄️  Persistence (Prisma)

The service records in order:

1. **Product** : `upsert` with `product_key` (updates `last_seen_at`)
2. **Snapshot** : `upsert` with `snapshot_key`
3. **SnapshotSource** : `upsert` for `page_a` (SOLO) with artifacts
4. **ScoreRun** : `upsert` with exports (Ticket v2 + Evidence v2)

**SSOT Anti-Drift** : Keys are `UNIQUE`, guaranteeing that the same result will never be duplicated.

---

## 🚧 Current State (MVP)

### ✅ Implemented

- Deterministic key generation
- Cache check (Product → Snapshot → ScoreRun)
- Playwright capture (Mobile + Desktop, optimized)
- Supabase upload (screenshots + HTML)
- Prisma persistence (4 tables)
- Robust error handling (try/catch per stage)

### ⏳ TODO (Next steps)

- **Detectors** : Implementation of SSOT signals (`docs/DETECTORS_SPEC.md`)
- **Scoring Engine** : Real ticket generation (`docs/SCORING_AND_DETECTION.md`)
- **Evidence v2** : Structured evidence creation
- **HTML Report** : SSOT report generation (`docs/REPORT_OUTLINE.md`)
- **PDF Export** : Via Playwright (derived from HTML)
- **CSV v1** : Tabular export (`docs/REPORT_OUTLINE.md` section 12)

---

## 🎛️  Audit Options

```typescript
interface AuditOptions {
  locale?: string; // Default: 'fr'
  copyReady?: boolean; // Default: false (technical vs business-ready text)
  whiteLabel?: {
    logo?: string;
    clientName?: string;
    agencyName?: string;
  } | null;
  captureTimeout?: number; // ms (default: 15000)
  blockResources?: boolean; // Default: true (block analytics/fonts/media)
}
```

---

## 📊 Result Structure

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

## 🔒 Degraded Mode (SSOT)

Per `docs/AUDIT_PIPELINE_SPEC.md`, the service **must always deliver an exploitable result**, even on partial failure.

### Statuses

- **`ok`** : Pipeline complete without error
- **`degraded`** : Pipeline finished with non-blocking errors (e.g. one missing screenshot)
- **`failed`** : Fatal failure (e.g. total capture impossible)

### Degradation Examples

| Scenario | Status | Exports | Artifacts |
|----------|--------|---------|-----------|
| Capture success, storage OK | `ok` | ✅ Tickets + Evidences | ✅ All refs |
| Capture OK, mobile storage fails | `degraded` | ✅ Tickets (partial evidence) | ❌ Mobile screenshot missing |
| Total capture timeout | `failed` | ❌ None | ❌ None |

---

## 🧪 Testing

### Test script

```bash
npm run test:audit
```

*(To be created)*

### Manual test

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

## 📚 SSOT References

- `docs/AUDIT_PIPELINE_SPEC.md` — Pipeline architecture
- `docs/DB_SCHEMA.md` — Database schema
- `docs/SCORING_AND_DETECTION.md` — Signals + Tickets
- `docs/DETECTORS_SPEC.md` — Detectors
- `docs/REPORT_OUTLINE.md` — HTML report structure
- `src/core/engine/keys.ts` — Deterministic key generation
- `src/adapters/capture/playwright.service.ts` — Optimized capture
- `src/adapters/storage/supabase.service.ts` — Cloud storage
- `src/contracts/export/ticket.v2.ts` — Ticket v2 schema
- `src/contracts/export/evidence.v2.ts` — Evidence v2 schema

---

## 🚀 Next Steps (Roadmap)

1. **Create test script** : `scripts/test-audit.ts`
2. **Implement detectors** : `src/core/detectors/*`
3. **Wire scoring engine** : `src/core/scoring/*`
4. **Generate HTML report** : `src/core/pipeline/report-generator.ts`
5. **Integrate public API** : `app/api/audit-solo/route.ts`
