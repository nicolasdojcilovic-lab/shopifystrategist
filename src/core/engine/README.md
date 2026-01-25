# Core Engine — Moteur de Clés Déterministes

Ce dossier contient le cœur du système de cache multi-couches de ShopifyStrategist.

**Référence SSOT** : `docs/DB_SCHEMA.md` sections 3 & 4

---

## 📋 Principe Fondamental

**Déterminisme total** : Mêmes entrées effectives + mêmes versions → mêmes clés → même résultat.

Le système garantit :
- ✅ Idempotence (reruns identiques = cache hits)
- ✅ Invalidation précise (bump version = nouvelles clés)
- ✅ Auditabilité (canonical_input stocké en DB)

---

## 🏗️ Architecture du Cache Multi-Couches

```
┌─────────────────────────────────────────────────────────────┐
│ Couche 1: product_key                                       │
│ → Produit normalisé (URL + mode)                            │
│ → Invariant: mode + normalized_urls + NORMALIZE_VERSION     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Couche 2: snapshot_key                                      │
│ → Capture (DOM + screenshots + artefacts)                   │
│ → Invariant: product_key + locale + viewports + ENGINE_V    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Couche 3: run_key                                           │
│ → Scoring (facts → evidences v2 + tickets v2)               │
│ → Invariant: snapshot_key + DETECTORS_V + SCORING_V + mode  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Couche 4: audit_key                                         │
│ → Rapport HTML (SSOT)                                       │
│ → Invariant: run_key + REPORT_V + copy_ready + white_label  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Couche 5: render_key                                        │
│ → Rendus dérivés (PDF + CSV)                                │
│ → Invariant: audit_key + RENDER_V + CSV_V                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Fichiers

### `keys.ts`
Moteur principal de génération de clés.

**Fonctions principales** :
- `normalizeUrl(url)` : Normalisation URL (minuscule, sans UTM, sans ancres)
- `generateProductKey(params)` : Clé couche 1
- `generateSnapshotKey(params)` : Clé couche 2
- `generateRunKey(params)` : Clé couche 3
- `generateAuditKey(params)` : Clé couche 4
- `generateRenderKey(params)` : Clé couche 5
- `analyzeKey(key)` : Debug/analyse d'une clé

### `keys.test.ts`
Tests unitaires validant :
- ✅ Déterminisme (mêmes inputs → mêmes outputs)
- ✅ Normalisation URL (règles SSOT)
- ✅ Format des clés (prefix + hash 16 chars)
- ✅ Unicité entre couches

---

## 🔑 Format des Clés

Toutes les clés suivent le pattern : `<prefix>_<hash>`

| Préfixe | Longueur hash | Exemple |
|---------|---------------|---------|
| `prod_` | 16 chars | `prod_a1b2c3d4e5f67890` |
| `snap_` | 16 chars | `snap_1234567890abcdef` |
| `run_` | 16 chars | `run_fedcba0987654321` |
| `audit_` | 16 chars | `audit_abcdef123456789` |
| `render_` | 16 chars | `render_0fedcba9876543` |

**Hash** : SHA-256 (64 bits d'entropie = 16 caractères hex)

---

## 📖 Normalisation URL

### Règles Appliquées

1. **Minuscule** : `Example.com/Product` → `example.com/product`
2. **Sans UTM** : Suppression de tous les paramètres UTM/tracking
   - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`
   - `gclid` (Google Ads), `fbclid` (Facebook), `msclkid` (Microsoft)
3. **Sans ancres** : `#reviews` → supprimé
4. **Sans slash final** : `/product/` → `/product` (sauf root `/`)

### Exemples

```typescript
// Avant normalisation
'https://Example.com/Product/?utm_source=fb&utm_medium=cpc#reviews/'

// Après normalisation
'https://example.com/product?utm_medium=cpc'
```

**⚠️ Paramètres conservés** : Tous les paramètres non-UTM sont préservés (ex: `?color=red&size=M`).

---

## 🔄 Workflow Typique

### 1. Nouvelle Requête d'Audit

```typescript
import {
  generateProductKey,
  generateSnapshotKey,
  generateRunKey,
  generateAuditKey,
  generateRenderKey,
} from '@/core/engine/keys';

// 1. Générer product_key
const productKey = generateProductKey({
  mode: 'solo',
  urls: { page_a: 'https://example.com/product' },
});
// => 'prod_a1b2c3d4e5f67890'

// 2. Vérifier si product existe en DB
// Si non, créer entry products table

// 3. Générer snapshot_key
const snapshotKey = generateSnapshotKey({
  productKey,
  locale: 'fr',
  viewports: {
    mobile: { width: 390, height: 844 },
    desktop: { width: 1440, height: 900 },
  },
});
// => 'snap_1234567890abcdef'

// 4. Vérifier si snapshot existe en DB
// Si oui → cache hit (skip capture)
// Si non → run capture + store

// 5-7. Idem pour run → audit → render
```

### 2. Invalidation Cache

Quand une version change (ex: `SCORING_VERSION: 2.2 → 2.3`) :

```typescript
// Ancien run_key (avec SCORING_VERSION = 2.2)
const oldRunKey = generateRunKey({
  snapshotKey: 'snap_1234567890abcdef',
  mode: 'solo',
});
// => 'run_abc123...' (calculé avec v2.2)

// Nouveau run_key (avec SCORING_VERSION = 2.3)
const newRunKey = generateRunKey({
  snapshotKey: 'snap_1234567890abcdef',
  mode: 'solo',
});
// => 'run_def456...' (différent car v2.3)

// Cache miss → rerun scoring
```

**Invalidation en cascade** :
- Bump `SCORING_VERSION` → invalide `run_key` + `audit_key` + `render_key`
- Bump `ENGINE_VERSION` → invalide `snapshot_key` + toutes les couches au-dessus
- Bump `NORMALIZE_VERSION` → invalide `product_key` + **TOUT**

---

## 🔐 Sécurité & Conformité

### Stockage en DB

Chaque couche stocke :

```sql
CREATE TABLE snapshots (
  snapshot_key TEXT PRIMARY KEY,           -- Clé déterministe
  canonical_input JSONB NOT NULL,          -- Input exact utilisé pour le hash
  versions JSONB NOT NULL,                 -- Versions ayant un impact
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... autres champs
);
```

**Auditabilité** : `canonical_input` permet de reproduire le hash et valider l'intégrité.

### Collisions

Probabilité de collision SHA-256 (64 bits) : **~1 / 18 quintillions**.

Pour 1 million d'audits → risque < 0.0000000000001%.

**Mitigation** : Si collision détectée (improbable), comparer `canonical_input` en DB.

---

## 📊 Métriques de Performance

### Cache Hit Rates Attendus

| Couche | Hit Rate Typique | Raison |
|--------|------------------|--------|
| **product_key** | ~90% | Même produit ré-audité |
| **snapshot_key** | ~70% | Snapshots réutilisés (même locale) |
| **run_key** | ~50% | Dépend de la fréquence de bump versions |
| **audit_key** | ~40% | copy_ready / white_label changent souvent |
| **render_key** | ~80% | Rarement régénéré (sauf bug PDF) |

### Gain Performance

- **Cache hit snapshot** : Skip 30-60s de capture
- **Cache hit run** : Skip 5-15s de scoring
- **Cache hit audit** : Skip 2-5s de génération HTML
- **Cache hit render** : Skip 3-10s de PDF Playwright

**Total potentiel** : 40-90s économisés par audit en cache.

---

## 🧪 Tests

### Lancer les tests

```bash
npm test src/core/engine/keys.test.ts
```

### Propriétés testées

✅ **Déterminisme** : Mêmes inputs → mêmes outputs  
✅ **Normalisation** : URL transformées selon règles SSOT  
✅ **Format** : Clés respectent `<prefix>_<hash16>`  
✅ **Unicité** : Pipeline complet génère 5 clés différentes  
✅ **Analyse** : `analyzeKey()` détecte clés valides/invalides

---

## 🚨 Points d'Attention

### 1. Versions dans canonical_input

⚠️ **CRITIQUE** : Toute version ayant un impact sur le résultat DOIT être incluse dans `canonical_input`.

**Exemple** : Si on ajoute `DETECTORS_SPEC_VERSION_PER_CATEGORY`, l'ajouter dans `run_key`.

### 2. Ordre des clés JSON

✅ La fonction `canonicalJSON()` trie les clés récursivement.

**Garanti** : `{ b: 2, a: 1 }` === `{ a: 1, b: 2 }` (même hash).

### 3. Arrays préservent l'ordre

✅ `[1, 2, 3]` ≠ `[3, 2, 1]` (ordre sémantique préservé).

**Utilisation** : Trier manuellement si l'ordre n'est pas sémantique.

### 4. Locale séparée de product_key

⚠️ **RÈGLE SSOT** : `locale` N'entre PAS dans `product_key`.

La séparation par langue vit au niveau `snapshot_key`.

**Conséquence** : Un même produit peut avoir plusieurs snapshots (1 par locale).

---

## 📚 Références

- **SSOT Principal** : `docs/DB_SCHEMA.md` sections 3-4
- **Versions** : `src/ssot/versions.ts`
- **Schemas Export** : `src/contracts/export/`
- **Tests** : `src/core/engine/keys.test.ts`

---

**Date de création** : 2026-01-23  
**Version** : DB_SCHEMA_VERSION = 1.0  
**Statut** : ✅ SSOT-compliant — Production-ready
