# ShopifyStrategist — Architecture Gold (SSOT-Driven)

## Vue d'Ensemble

ShopifyStrategist est une application Next.js TypeScript stricte qui génère des audits PDP et battlecards "agency-grade" selon une architecture **documentation-first**.

### Principes Fondamentaux

1. **HTML Report = SSOT** : Le rapport HTML est la source de vérité. PDF/CSV sont dérivés.
2. **Contract-First** : Schémas Zod avant implémentation.
3. **Evidence-Based** : Chaque ticket référence ≥ 1 preuve.
4. **Déterminisme** : Mêmes entrées + mêmes versions → mêmes outputs.
5. **Anti-Drift** : Aucune modification sans validation SSOT.

---

## Structure du Projet

```
ShopifyStrategist/
├── docs/                           # 📚 Source de Vérité (SSOT) — NE PAS MODIFIER
│   ├── SPEC.md
│   ├── REPORT_OUTLINE.md          # V3.1 (versions schemas)
│   ├── SCORING_AND_DETECTION.md   # v2.2 (signals catalog)
│   ├── API_DOC.md
│   ├── DB_SCHEMA.md
│   ├── AUDIT_PIPELINE_SPEC.md
│   ├── DETECTORS_SPEC.md
│   ├── EVIDENCE_PACK_SPEC.md
│   ├── FIXTURES_AND_ENV_SPEC.md
│   ├── RUNBOOK_OPERATIONS.md
│   └── SMOKE_AND_QA_SPEC.md
│
├── fixtures/smoke/                 # 🧪 Fixtures pour smoke tests
│   ├── fixtures.index.json
│   ├── solo_ok_instant.json
│   ├── duo_ab_ok.json
│   └── ...
│
├── scripts/                        # 🔧 Scripts Node.js
│   └── smoke.mjs                   # Smoke runner (Step 2)
│
├── supabase/                       # 🗄️ Database
│   └── migrations/                 # SQL migrations versionnées
│
├── src/                            # 💻 Source Code (Architecture Gold)
│   ├── ssot/                       # Source de vérité des versions
│   │   └── versions.ts             # Versions extraites des docs SSOT
│   │
│   ├── contracts/                  # Schémas Zod (Contract-First)
│   │   ├── export/                 # API publique (stable)
│   │   │   ├── ticket.v2.ts        # TICKET_SCHEMA_VERSION = 2
│   │   │   ├── evidence.v2.ts      # EVIDENCE_SCHEMA_VERSION = 2
│   │   │   ├── csv.v1.ts           # CSV_EXPORT_VERSION = 1
│   │   │   └── index.ts
│   │   └── internal/               # Schémas internes
│   │
│   ├── core/                       # Logique métier pure
│   │   ├── constants.ts            # Seuils SSOT (keywords, viewports, etc.)
│   │   ├── engine/                 # Moteur d'audit (orchestration)
│   │   ├── pipeline/               # Pipeline (capture → detect → report)
│   │   ├── detectors/              # Détecteurs de signals
│   │   └── scoring/                # Priorisation + diversité
│   │
│   ├── adapters/                   # Adaptateurs externes (DI)
│   │   ├── capture/                # Playwright, Puppeteer
│   │   ├── storage/                # Supabase, PostgreSQL
│   │   └── ai/                     # OpenAI, Anthropic (Copy-ready)
│   │
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home
│   │   ├── dashboard/              # Dashboard principal
│   │   │   └── page.tsx
│   │   └── report/[id]/            # Rapport HTML individuel
│   │       └── page.tsx
│   │
│   ├── devtools/                   # Outils de développement
│   │   └── facts-viewer/           # Visualiseur evidence pack
│   │
│   └── jobs/                       # Jobs asynchrones
│
├── .cursorrules                    # Règles Cursor (Constitution Anti-Drift)
├── AGENTS.md                       # Guidelines pour agents (Step fences)
├── tsconfig.json                   # TypeScript strict config
├── next.config.mjs                 # Next.js config
├── package.json                    # Dependencies
├── .env.example                    # Template env vars
├── .gitignore                      # Git ignore patterns
├── MIGRATION_GOLD_ARCH.md          # Document de migration
└── ARCHITECTURE.md                 # Ce fichier
```

---

## Versions SSOT

Les versions sont extraites automatiquement des docs SSOT et centralisées dans `src/ssot/versions.ts`.

### Versions Actuelles

| Composant | Version | Source |
|-----------|---------|--------|
| **REPORT_OUTLINE** | `3.1` | `docs/REPORT_OUTLINE.md` |
| **TICKET_SCHEMA** | `2` | `docs/REPORT_OUTLINE.md` section 8 |
| **EVIDENCE_SCHEMA** | `2` | `docs/REPORT_OUTLINE.md` section 9 |
| **CSV_EXPORT** | `1` | `docs/REPORT_OUTLINE.md` section 12 |
| **SCORING** | `2.2` | `docs/SCORING_AND_DETECTION.md` |

**Règle** : Toute modification breaking doit incrémenter la version correspondante dans les docs SSOT **ET** dans `src/ssot/versions.ts`.

---

## Contracts (Schémas d'Export)

### `src/contracts/export/`

Les schémas d'export sont **stables** et versionnés (anti-drift).

#### Ticket v2 (`ticket.v2.ts`)

```typescript
{
  ticket_id: string,           // T_<mode>_<category>_<signal_id>_<scope>_<idx>
  mode: 'solo' | 'duo_ab' | 'duo_before_after',
  title: string,
  impact: 'high' | 'medium' | 'low',
  effort: 'small' | 'medium' | 'large',
  risk: 'low' | 'medium' | 'high',
  confidence: 'high' | 'medium' | 'low',
  category: 'offer_clarity' | 'trust' | 'media' | 'ux' | 'performance' | 'seo_basics' | 'accessibility' | 'comparison',
  why: string,
  evidence_refs: string[],     // ≥ 1 obligatoire
  how_to: string[],            // 3-7 steps
  validation: string[],
  quick_win: boolean,
  owner_hint: 'design' | 'dev' | 'content' | 'ops',
  notes?: string,
}
```

#### Evidence v2 (`evidence.v2.ts`)

```typescript
{
  evidence_id: string,         // E_<source>_<viewport>_<type>_<label>_<idx>
  level: 'A' | 'B' | 'C',      // A=fort, B=moyen, C=faible (Appendix only)
  type: 'screenshot' | 'measurement' | 'detection',
  label: string,
  source: 'page_a' | 'page_b' | 'before' | 'after',
  viewport: 'mobile' | 'desktop' | 'na',
  timestamp: string,           // ISO 8601
  ref: string,                 // #evidence-<evidence_id> (ancre HTML)
  details?: Record<string, unknown>,
}
```

#### CSV v1 (`csv.v1.ts`)

15 colonnes fixes (voir `docs/REPORT_OUTLINE.md` section 12).

**RÈGLE DURE** : Aucun nouveau champ export sans :
1. Bump de version
2. Mise à jour docs SSOT
3. Validation contract-first

---

## Core (Logique Métier)

### `src/core/constants.ts`

Seuils et valeurs SSOT (extraction de `docs/SCORING_AND_DETECTION.md` section 8) :

- **Viewports** : Mobile 390×844, Desktop 1440×900
- **Performance** : `IMG_HEAVY_KB=300`, `LH_PERF_SCORE_BAD=40`, etc.
- **UX Heuristics** : `GALLERY_MIN_IMAGES=4`, `LONG_PAGE_SCROLL_PX=3*viewport_height`
- **Keywords Lists** : Shipping, Returns, Trust, Reviews (FR/EN)

### Pipeline (à implémenter)

1. **Capture** : Screenshots + mesures (Playwright)
2. **Detect** : Signals detection (DOM, keywords, heuristics)
3. **Score** : Priorisation (PriorityScore + diversité)
4. **Report** : Génération HTML (SSOT) → PDF (Playwright) → CSV

---

## Adapters (Dependency Inversion)

### `src/adapters/capture/`
Adaptateur de capture (Playwright, Puppeteer).

### `src/adapters/storage/`
Adaptateur stockage (Supabase, PostgreSQL).

### `src/adapters/ai/`
Adaptateur IA (OpenAI, Anthropic) pour Copy-ready (option).

---

## Next.js App Router

### Pages

- `/` : Home (redirection dashboard ou landing)
- `/dashboard` : Liste audits + création
- `/report/[id]` : Rapport HTML individuel (SSOT)

### Configuration

- **TypeScript Strict** : `strict: true`, `noUncheckedIndexedAccess: true`
- **Path Aliases** : `@/*`, `@ssot/*`, `@contracts/*`, `@core/*`, etc.
- **React Strict Mode** : Activé
- **Output** : Standalone (optimisé déploiement)

---

## Workflow de Développement

### Step 1 — Fixtures ✅
**Statut** : Complet
- `fixtures/smoke/` contient 11 fixtures + index
- Couvre : SOLO, DUO AB, DUO Before/After, Degraded modes

### Step 2 — Smoke Runner (En cours)
**Objectif** : Implémenter `scripts/smoke.mjs`
- Lire fixtures depuis `fixtures.index.json`
- Appeler API selon `docs/API_DOC.md`
- Valider gates selon `docs/SMOKE_AND_QA_SPEC.md`
- Générer artifacts dans `tmp/smoke/`

### Step 3 — CI (À venir)
**Objectif** : `.github/workflows/smoke.yml`
- Runner smoke tests automatiquement
- Upload artifacts en cas d'échec
- Bloquer merge si P0 fail

---

## Anti-Drift Guarantees

### 1. Versions Synchronisées
✅ `src/ssot/versions.ts` est extrait automatiquement des docs SSOT.

### 2. Schémas Stables
✅ Aucun nouveau champ export sans bump + validation SSOT.

### 3. Déterminisme
✅ IDs déterministes (`ticket_id`, `evidence_id`).
✅ Tri stable (PriorityScore → impact → confidence → effort → risk → ticket_id).

### 4. Evidence-Based
✅ Chaque ticket DOIT avoir `evidence_refs.length >= 1`.

### 5. HTML = SSOT
✅ PDF/CSV sont dérivés du HTML (jamais l'inverse).

---

## Commandes Utiles

```bash
# Installation
npm install

# Développement
npm run dev

# Build production
npm run build

# Type checking
npm run typecheck

# Smoke tests (Step 2)
npm run smoke

# Linter
npm run lint
```

---

## Références

- **Docs SSOT** : `/docs`
- **Règles** : `/AGENTS.md`, `/.cursorrules`
- **Migration** : `/MIGRATION_GOLD_ARCH.md`
- **Env Vars** : `/.env.example`

---

**Date de création** : 2026-01-23  
**Version Architecture** : Gold v1.0  
**Statut** : ✅ Fondations complètes — Prêt pour Step 2
