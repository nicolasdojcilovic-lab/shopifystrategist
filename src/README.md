# src/ — Architecture Gold (Anti-Drift)

Cette arborescence respecte strictement les documents SSOT dans `/docs`.

## Structure

### `ssot/`
Source de vérité unique pour les versions de schémas.
- `versions.ts` : Versions extraites de `docs/REPORT_OUTLINE.md` et `docs/SCORING_AND_DETECTION.md`

### `contracts/`
Schémas Zod et types TypeScript (Contract-First).

#### `contracts/export/`
Schémas d'export stables (API publique) :
- `ticket.v2.ts` : TICKET_SCHEMA_VERSION = 2
- `evidence.v2.ts` : EVIDENCE_SCHEMA_VERSION = 2
- `csv.v1.ts` : CSV_EXPORT_VERSION = 1

**RÈGLE DURE** : Aucun nouveau champ export sans bump de version + doc SSOT.

#### `contracts/internal/`
Schémas internes (pipeline, détecteurs, états intermédiaires).

### `core/`
Logique métier pure (sans dépendances externes).

#### `core/engine/`
Moteur principal d'audit (orchestration).

#### `core/pipeline/`
Pipeline de traitement :
- `capture.ts` : Capture (screenshots, mesures)
- `detect.ts` : Détection (signals, DOM, keywords)
- `report.ts` : Génération rapport (HTML SSOT, PDF, CSV)

#### `core/detectors/`
Détecteurs de signals (selon `docs/SCORING_AND_DETECTION.md`) :
- `buybox.ts` : Détection BUYBOX (strict → fallback)
- `signals.ts` : Catalog de signals MVP

#### `core/scoring/`
Priorisation et scoring :
- `priority.ts` : PriorityScore + tri stable
- `diversity.ts` : Règles de diversité (anti-rapport monocorde)

### `adapters/`
Adaptateurs vers services externes (Dependency Inversion).

#### `adapters/capture/`
Adaptateur de capture (Playwright, Puppeteer, etc.).

#### `adapters/storage/`
Adaptateur stockage (Supabase, PostgreSQL).

#### `adapters/ai/`
Adaptateur IA (OpenAI, Anthropic) pour Copy-ready.

### `app/`
Next.js App Router (UI).

#### `app/dashboard/`
Dashboard principal.

#### `app/report/[id]/`
Page de rapport individuel.

### `devtools/`
Outils de développement.

#### `devtools/facts-viewer/`
Visualiseur de "facts vs interpretations" (Evidence pack).

### `jobs/`
Jobs asynchrones (audit complet, batch processing).

---

## Règles Anti-Drift

1. **Docs SSOT** : `/docs` est la source de vérité. Aucune modification sans demande explicite.
2. **Contract-First** : Schémas Zod avant implémentation.
3. **Minimal Diff** : Pas de refactor inutile, pas de dépendances superflues.
4. **Déterminisme** : Clés déterministes (audit_key, ticket_id, evidence_id).
5. **Evidence-Based** : Chaque ticket ≥ 1 evidence.

Voir `/AGENTS.md` et `/.cursorrules` pour les règles complètes.
