# Prisma Schema — ShopifyStrategist

**Référence SSOT** : `docs/DB_SCHEMA.md` (v1.0)  
**Contrats exports** : `src/contracts/export/` (Ticket v2, Evidence v2, CSV v1)  
**Date** : 2026-01-24

---

## 🎯 Architecture du Schéma

### Système de Cache Multi-Couches

Le schéma implémente un système de cache **déterministe** à 5 couches :

```
1. Product    (product_key)   → Produit normalisé (URL + mode)
2. Snapshot   (snapshot_key)  → Capture (DOM + screenshots)
3. ScoreRun   (run_key)       → Scoring (facts → evidences + tickets)
4. AuditJob   (audit_key)     → Rapport HTML (SSOT)
5. AuditRender(render_key)    → Rendus dérivés (PDF + CSV)
```

**Principe fondamental** : Mêmes entrées effectives + mêmes versions ⇒ mêmes clés ⇒ cache hit

---

## 📊 Modèles (Tables)

### 1. `Product` — Racine "Produit Normalisé"

**Rôle** : Identifier un "même objet" indépendamment des runs.

**Clé déterministe** :
```
product_key = hash(mode + normalized_urls + NORMALIZE_VERSION)
```

**Colonnes principales** :
- `product_key` (UNIQUE) : Clé déterministe
- `mode` : `solo` | `duo_ab` | `duo_before_after`
- `normalized_urls` (JSON) : URLs normalisées selon le mode
- `versions` (JSON) : Versions SSOT ayant un impact
- `canonical_input` (JSON) : Input canonique utilisé pour le hash

**Relations** :
- `snapshots[]` : Un produit peut avoir plusieurs snapshots (différentes locales, etc.)

---

### 2. `Snapshot` — Pack de Capture

**Rôle** : Pack de capture DOM + screenshots + artefacts.

**Clé déterministe** :
```
snapshot_key = hash(product_key + locale + viewports + ENGINE_VERSION)
```

**Colonnes principales** :
- `snapshot_key` (UNIQUE) : Clé déterministe
- `product_key` (FK) : Lien vers Product
- `locale` : `fr` | `en` (MVP)
- `viewports` (JSON) : Mobile (390×844) + Desktop (1440×900)
- `status` : `ok` | `partial` | `failed`
- `errors` (JSON) : Erreurs macro stages
- `timings_ms` (JSON) : Timings pour observabilité

**Relations** :
- `product` : Lien vers Product
- `sources[]` : Détail par source (page_a/page_b/before/after)
- `scoreRuns[]` : Résultats de scoring

---

### 3. `SnapshotSource` — Détail par Source

**Rôle** : Stocker les artefacts et `evidence_completeness` **PAR SOURCE** (SSOT DUO).

**Colonnes principales** :
- `snapshot_key` (FK) : Lien vers Snapshot
- `source` : `page_a` | `page_b` | `before` | `after`
- `url` : URL normalisée utilisée
- `captured_at` : Timestamp de capture (source de vérité pour `Evidence.timestamp`)
- `artefacts` (JSON) : Refs storage (DOM, screenshots, logs, lighthouse)
- `evidence_completeness` : `complete` | `partial` | `insufficient`
- `missing_evidence` (JSON) : Items manquants avec raisons

**Contrainte UNIQUE** : `(snapshot_key, source)`

**⚠️ SSOT DUO** :
- `evidence_completeness` est calculé **PAR SOURCE**
- Le pire des sources est affiché en cover (insufficient > partial > complete)

---

### 4. `ScoreRun` — Résultat Scoring

**Rôle** : Stocker le résultat du scoring : `Ticket v2[]` + `Evidence v2[]`.

**Clé déterministe** :
```
run_key = hash(snapshot_key + DETECTORS_VERSION + SCORING_VERSION + mode)
```

**Colonnes principales** :
- `run_key` (UNIQUE) : Clé déterministe
- `snapshot_key` (FK) : Lien vers Snapshot
- `mode` : Mode du rapport
- `exports` (JSON) : **⚠️ EXPORTS SSOT**
  ```json
  {
    "tickets": [...Ticket v2...],
    "evidences": [...Evidence v2...]
  }
  ```
- `status` : `ok` | `degraded` | `failed`
- `errors` (JSON) : Erreurs macro pipeline
- `timings_ms` (JSON) : Timings

**Relations** :
- `snapshot` : Lien vers Snapshot
- `auditJobs[]` : Rapports HTML générés

**⚠️ Immutabilité** : Le champ `exports` est **immutable** une fois écrit (auditabilité).

---

### 5. `AuditJob` — Rapport HTML SSOT

**Rôle** : Rapport HTML SSOT (structure V3.1) + metadata.

**Clé déterministe** :
```
audit_key = hash(run_key + REPORT_OUTLINE_VERSION + copy_ready + white_label)
```

**Colonnes principales** :
- `audit_key` (UNIQUE) : Clé déterministe
- `run_key` (FK) : Lien vers ScoreRun
- `report_meta` (JSON) : Métadonnées du rapport
  - SOLO : `{ "evidence_completeness": "...", "alignment_level": null }`
  - DUO : `{ "evidence_completeness": "...", "alignment_level": "high|medium|low" }`
- `html_ref` : Storage ref du HTML SSOT
- `html_content_hash` : Hash du HTML (détection drift)
- `status` : `ok` | `degraded` | `failed`

**Relations** :
- `scoreRun` : Lien vers ScoreRun
- `renders[]` : Rendus dérivés (PDF, CSV)

**⚠️ Drift Detection** : Le `html_content_hash` permet de détecter toute divergence inattendue.

---

### 6. `AuditRender` — Rendus Dérivés

**Rôle** : Exports dérivés du HTML SSOT (PDF via Playwright, CSV v1).

**Clé déterministe** :
```
render_key = hash(audit_key + RENDER_VERSION + CSV_EXPORT_VERSION)
```

**Colonnes principales** :
- `render_key` (UNIQUE) : Clé déterministe
- `audit_key` (FK) : Lien vers AuditJob
- `pdf_ref` (nullable) : Storage ref du PDF (null si échec)
- `csv_ref` (nullable) : Storage ref du CSV (null si échec)
- `status` : `ok` | `partial` | `failed`

**⚠️ Best Effort** : PDF/CSV peuvent être `null` sans casser le `status="ok"` si HTML existe.

---

### 7. `RequestLog` (Optionnel MVP)

**Rôle** : Observabilité + anti-abus (sans coupler au cache).

**Colonnes principales** :
- `request_id` (UNIQUE) : ID de la requête
- `endpoint` : `/api/audit-solo` | `/api/audit-duo`
- `keys` (JSON) : Clés générées (product/snapshot/run/audit/render)
- `status` : `ok` | `error`
- `http_status` : Code HTTP
- `duration_ms` : Durée de traitement

---

## 🔑 Index et Performances

Tous les index nécessaires sont créés pour garantir des performances optimales :

### Index sur les clés déterministes
- `Product.product_key`
- `Snapshot.snapshot_key`
- `ScoreRun.run_key`
- `AuditJob.audit_key`
- `AuditRender.render_key`

### Index sur les relations
- `Snapshot.product_key`
- `SnapshotSource.snapshot_key`
- `ScoreRun.snapshot_key`
- `AuditJob.run_key`
- `AuditRender.audit_key`

### Index sur les status (pour monitoring)
- `Snapshot.status`
- `ScoreRun.status`
- `AuditJob.status`
- `AuditRender.status`

---

## 🚀 Utilisation

### Installation

```bash
# Installer les dépendances
npm install

# Générer le Prisma Client
npm run db:generate
```

### Développement

```bash
# Push du schéma vers la DB (dev)
npm run db:push

# Créer une migration
npm run db:migrate

# Ouvrir Prisma Studio (UI)
npm run db:studio
```

### Production

```bash
# Appliquer les migrations
npx prisma migrate deploy

# Générer le client
npx prisma generate
```

---

## 🔗 Relations et Navigation

### Depuis une URL jusqu'au Rapport

```typescript
// 1. Product → Snapshot → ScoreRun → AuditJob → AuditRender
const product = await prisma.product.findUnique({
  where: { productKey: 'prod_abc123' },
  include: {
    snapshots: {
      include: {
        sources: true,
        scoreRuns: {
          include: {
            auditJobs: {
              include: {
                renders: true
              }
            }
          }
        }
      }
    }
  }
});
```

### Depuis un Rapport jusqu'à l'URL

```typescript
// AuditJob → ScoreRun → Snapshot → Product
const audit = await prisma.auditJob.findUnique({
  where: { auditKey: 'audit_xyz789' },
  include: {
    scoreRun: {
      include: {
        snapshot: {
          include: {
            product: true,
            sources: true
          }
        }
      }
    }
  }
});

// URL d'origine
const originalUrl = audit.scoreRun.snapshot.product.normalizedUrls;
```

---

## 🔒 Contraintes d'Immutabilité

### Règles Strictes

1. **Uniqueness** : Chaque `*_key` est UNIQUE
2. **Insert-if-absent** : Les écritures doivent être des upserts
3. **Immutabilité logique** : Si un record existe pour une key, on ne ré-écrit pas `exports`, `html_ref`, etc. (sauf retry explicite)
4. **Drift detection** : Le `html_content_hash` détecte toute divergence inattendue
5. **Conservation** : Les `exports` sont conservés tels quels (auditabilité)

### Champs Opérationnels (Non-Immutables)

Ces champs peuvent évoluer sans affecter les outputs :
- `timings_ms`
- `completed_at`
- `last_seen_at`

---

## 📚 Références

- **DB Schema** : `docs/DB_SCHEMA.md`
- **Contrats Exports** : `src/contracts/export/`
- **Moteur de Clés** : `src/core/engine/keys.ts`
- **Versions SSOT** : `src/ssot/versions.ts`

---

## ✅ Checklist DoD (Release Gate)

- [x] Tables MVP présentes : `Product`, `Snapshot`, `SnapshotSource`, `ScoreRun`, `AuditJob`, `AuditRender`
- [x] UNIQUE sur `product_key`, `snapshot_key`, `run_key`, `audit_key`, `render_key`
- [x] `SnapshotSource` porte `evidence_completeness` **par source** + `missing_evidence`
- [x] `AuditJob.report_meta.evidence_completeness` = **pire des sources**
- [x] SOLO : `alignment_level=null` ; DUO : `high|medium|low`
- [x] `ScoreRun.exports` stocke Ticket v2 + Evidence v2 **sans drift**
- [x] `Evidence.ref` exporté = `#evidence-<evidence_id>` ; storage refs dans `Evidence.details`
- [x] `captured_at` (par source) source de vérité pour `Evidence.timestamp`
- [x] `html_content_hash` stocké pour détecter drift
- [x] `pdf_ref`/`csv_ref` peuvent être `null` si échec
- [x] Index sur toutes les clés déterministes
- [x] Relations permettent de remonter d'un rapport jusqu'à l'URL d'origine

---

**Créé** : 2026-01-24  
**Maintenu par** : Équipe ShopifyStrategist
