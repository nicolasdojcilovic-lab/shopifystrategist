# ShopifyStrategist — DB_SCHEMA.md (SSOT)

**DB_SCHEMA_VERSION:** 1.0  
**Statut :** SSOT (schéma DB + clés déterministes + invariants anti-drift)  
**Cible :** Supabase (Postgres + Storage)

## 0) But

Définir le **minimum** de tables/relations nécessaires au MVP pour supporter :
- Pipeline end-to-end : normalize → capture → detectors → scoring → report HTML (SSOT) → PDF (Playwright) → CSV v1
- Cache multi-couches par **clés déterministes**
- Idempotence (mêmes entrées + mêmes versions ⇒ mêmes sorties)
- Conservation des evidence packs (auditabilité) sans créer de nouveaux champs d’export publics

## 1) Références SSOT (source de vérité)

- `docs/SPEC.md` (HTML=SSOT, cache multi-couches, versioning, observabilité)
- `docs/REPORT_OUTLINE.md` (V3.1) : structure report, Ticket v2, Evidence v2, CSV v1
- `docs/SCORING_AND_DETECTION.md` (v2.2) : formats d’IDs, tri stable, gating screenshots, reasons (6), règles DUO
- `docs/AUDIT_PIPELINE_SPEC.md` : orchestration + erreurs macro
- `docs/EVIDENCE_PACK_SPEC.md` : Evidence.ref (ancre), déterminisme evidence pack
- `docs/API_DOC.md` : enveloppes publiques (keys + versions + artifacts + exports)

> Anti-drift : ce document ne change **aucun schéma public d’export** (Ticket v2 / Evidence v2 / CSV v1).  
> Tout champ additionnel = **interne DB** ou `Evidence.details` (sans changer l’export).

## 2) Invariants (non négociables)

1) **HTML report = SSOT** ; PDF strictement dérivé du HTML (Playwright).  
2) **Evidence-based** : aucun ticket exporté sans `evidence_refs[]` (>= 1).  
3) **Déterminisme** : mêmes entrées effectives + mêmes versions ⇒ mêmes keys, mêmes IDs, même tri, mêmes troncatures, mêmes exports.  
4) **No RUM** : perf/poids = lab best-effort ; aucune donnée “real user”.  
5) **Aucun nouveau champ export** (tickets/evidence/csv).  
6) **DUO** : evidence_completeness calculé **par source** et la cover affiche le **pire** (insufficient > partial > complete). Détail par source = HTML-only.  
7) **Reasons (6)** : `missing_evidence_reason` ∈ {blocked_by_cookie_consent, blocked_by_popup, infinite_scroll_or_lazyload, navigation_intercepted, timeout, unknown_render_issue} ou `null`.

## 3) Modèle conceptuel (cache multi-couches)

Couche logique → table pivot → clé :
- **Produit normalisé** → `products` → `product_key`
- **Snapshot capture** (DOM + screenshots + artefacts) → `snapshots` (+ `snapshot_sources`) → `snapshot_key`
- **Run scoring** (facts→evidences+tickets, tri, caps) → `score_runs` → `run_key`
- **Audit report HTML (SSOT)** → `audit_jobs` → `audit_key`
- **Rendus** (PDF + CSV + refs storage) → `audit_renders` → `render_key`

Chaque couche est :
- **adressable** par clé déterministe,
- **immutable** une fois écrite (sauf champs purement opérationnels: retry_count, last_error_at, etc.),
- **rejouable** : un rerun identique doit faire un cache hit sur la couche la plus haute disponible.

## 4) Clés déterministes (où elles vivent, à quoi elles servent)

### 4.1 Règle commune de dérivation (normative)

Chaque key est dérivée de :
1) un **JSON canonique** (tri stable des clés, listes triées si l’ordre n’est pas sémantique),
2) un hash (ex: sha256),
3) un préfixe lisible : `prod_`, `snap_`, `run_`, `audit_`, `render_`.

Interdits :
- dépendre de `now()` ou d’un timestamp de rendu,
- dépendre d’un ordre non stable,
- omettre une option/version qui change le résultat.

La DB stocke toujours :
- `*_key` (text)
- `canonical_input` (jsonb) : le JSON canonique exact utilisé pour le hash
- `versions` (jsonb) : versions ayant un impact sur la couche

### 4.2 `product_key`
**But :** regrouper les audits d’un “même objet” (SOLO ou DUO) indépendamment des runs.

Canonical input (minimum) :
- `mode` (solo|duo_ab|duo_before_after)
- `normalized_urls` :
  - SOLO : `{ "page_a": "<normalized_url>" }`
  - DUO AB : `{ "page_a": "...", "page_b": "..." }`
  - DUO BA : `{ "before": "...", "after": "..." }`
- `NORMALIZE_VERSION`

Notes :
- **Règle SSOT (anti-drift) :** `locale` n’entre **pas** dans `product_key`.  
  La séparation par langue vit au niveau `snapshot_key` (et au-delà).  
  Conséquence : toute isolation par locale se fait via snapshots/runs/audits, pas via `product_key`.

### 4.3 `snapshot_key`
**But :** identifier un pack de capture (par source) : DOM + screenshots + artefacts optionnels.

Canonical input (minimum) :
- `product_key`
- `locale`
- `viewports` (mobile 390×844, desktop 1440×900)
- options capture qui changent les artefacts (ex : user-agent/preset si existant)
- `ENGINE_VERSION` (si c’est la version qui porte capture/orchestration)
- (optionnel) “capture_profile” stable si tu en as plusieurs (sinon omettre)

### 4.4 `run_key`
**But :** identifier un résultat de scoring stable : facts (détecteurs) → evidences v2 + tickets v2, tri + caps + diversity rules.

Canonical input (minimum) :
- `snapshot_key`
- `DETECTORS_SPEC_VERSION`
- (optionnel) versions détecteurs effectives si elles sont indépendantes de `DETECTORS_SPEC_VERSION`
- `SCORING_VERSION`
- `mode` (solo|duo_ab|duo_before_after)
- options qui changent le scoring (si elles existent au MVP) — **pas** `copy_ready`

### 4.5 `audit_key`
**But :** identifier un HTML SSOT (structure V3.1 + contenus).

Canonical input (minimum) :
- `run_key`
- `REPORT_OUTLINE_VERSION`
- options HTML qui changent le rendu SSOT :
  - `copy_ready` (car HTML change)
  - white-label léger (si activé et paramétré)

### 4.6 `render_key`
**But :** identifier les rendus dérivés (PDF/CSV) d’un audit.

Canonical input (minimum) :
- `audit_key`
- `RENDER_VERSION`
- `CSV_EXPORT_VERSION`
- options de rendu (format PDF si paramétrable)

## 5) Tables (MVP) — colonnes & contraintes

> Types indicatifs : `uuid`, `text`, `timestamptz`, `jsonb`, `int`, `bool`.  
> Le MVP vise : **peu de tables**, **clés uniques**, **immutabilité**, **observabilité minimale**.

### 5.1 `products`
**Rôle :** racine “produit normalisé” (SOLO ou DUO)

Colonnes :
- `id` (uuid, PK)
- `product_key` (text, UNIQUE, NOT NULL)
- `mode` (text, NOT NULL) — `solo|duo_ab|duo_before_after`
- `normalized_urls` (jsonb, NOT NULL) — voir §4.2
- `versions` (jsonb, NOT NULL) — inclut `NORMALIZE_VERSION`
- `canonical_input` (jsonb, NOT NULL)
- `created_at` (timestamptz)
- `first_seen_at` (timestamptz)
- `last_seen_at` (timestamptz)

Contraintes :
- UNIQUE(`product_key`)
- `mode` ∈ enum SSOT

### 5.2 `snapshots`
**Rôle :** capture pack “logique” (peut agréger plusieurs sources pour DUO)

Colonnes :
- `id` (uuid, PK)
- `snapshot_key` (text, UNIQUE, NOT NULL)
- `product_key` (text, FK → products.product_key, NOT NULL)
- `locale` (text, NOT NULL) — `fr|en` (MVP)
- `viewports` (jsonb, NOT NULL) — mobile/desktop
- `capture_meta` (jsonb, NOT NULL) — infos stables (UA/profile si applicable)
- `versions` (jsonb, NOT NULL) — inclut `ENGINE_VERSION` (+ NORMALIZE_VERSION si utile)
- `canonical_input` (jsonb, NOT NULL)
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|partial|failed` (interne)
- `errors` (jsonb, NOT NULL, default `[]`) — erreurs capture (interne, stage macro si tu veux les réutiliser)
- `timings_ms` (jsonb, NOT NULL, default `{}`)

Contraintes :
- UNIQUE(`snapshot_key`)
- FK(`product_key`) → products
- `locale` ∈ `fr|en`

### 5.3 `snapshot_sources`
**Rôle :** détail par source (page_a/page_b/before/after) : urls, timestamps, artefacts disponibles

Colonnes :
- `id` (uuid, PK)
- `snapshot_key` (text, FK → snapshots.snapshot_key, NOT NULL)
- `source` (text, NOT NULL) — `page_a|page_b|before|after`
- `url` (text, NOT NULL) — normalized url utilisée
- `captured_at` (timestamptz, NOT NULL) — timestamp capture (source de vérité pour Evidence.timestamp)
- `artefacts` (jsonb, NOT NULL) — disponibilité + refs storage internes (dom_ref, screenshot_refs, network_log_ref, lighthouse_ref)
- `evidence_completeness` (text, NOT NULL) — `complete|partial|insufficient` (calcul SSOT par source)
- `missing_evidence` (jsonb, NOT NULL, default `[]`) — items {reason, artifact_name} (HTML-only au final, mais stock interne utile)
- `created_at` (timestamptz)

Contraintes :
- UNIQUE(`snapshot_key`,`source`)
- `source` ∈ enum SSOT
- `evidence_completeness` ∈ `complete|partial|insufficient`

### 5.4 `score_runs`
**Rôle :** résultat scoring déterministe : evidences v2 + tickets v2 + erreurs + timings

Colonnes :
- `id` (uuid, PK)
- `run_key` (text, UNIQUE, NOT NULL)
- `snapshot_key` (text, FK → snapshots.snapshot_key, NOT NULL)
- `mode` (text, NOT NULL)
- `versions` (jsonb, NOT NULL) — inclut `DETECTORS_SPEC_VERSION`, `SCORING_VERSION`
- `canonical_input` (jsonb, NOT NULL)
- `exports` (jsonb, NOT NULL) — `{ tickets: [...Ticket v2...], evidences: [...Evidence v2...] }`
- `errors` (jsonb, NOT NULL, default `[]`) — erreurs macro (stage pipeline)
- `timings_ms` (jsonb, NOT NULL, default `{}`)
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|degraded|failed` (interne)

Contraintes :
- UNIQUE(`run_key`)
- FK(`snapshot_key`) → snapshots

Notes anti-drift :
- `exports.evidences[].ref` DOIT rester `#evidence-<evidence_id>` (ancre HTML).
- Toute info storage/path/json pointer va dans `exports.evidences[].details`.

### 5.5 `audit_jobs`
**Rôle :** HTML SSOT (structure V3.1) + meta “report_meta”

Colonnes :
- `id` (uuid, PK)
- `audit_key` (text, UNIQUE, NOT NULL)
- `run_key` (text, FK → score_runs.run_key, NOT NULL)
- `mode` (text, NOT NULL)
- `report_meta` (jsonb, NOT NULL) — `{ evidence_completeness, alignment_level }`
- `versions` (jsonb, NOT NULL) — inclut `REPORT_OUTLINE_VERSION` (+ autres versions utiles)
- `canonical_input` (jsonb, NOT NULL)
- `html_ref` (text, NOT NULL) — storage ref du HTML SSOT
- `html_content_hash` (text, NOT NULL) — hash du HTML (détection drift)
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|degraded|failed` (interne)
- `errors` (jsonb, NOT NULL, default `[]`) — erreurs macro (stage pipeline)
- `timings_ms` (jsonb, NOT NULL, default `{}`)

Contraintes :
- UNIQUE(`audit_key`)
- FK(`run_key`) → score_runs
- SOLO : `report_meta.alignment_level` DOIT être `null`
- DUO : `report_meta.alignment_level` ∈ `high|medium|low`

### 5.6 `audit_renders`
**Rôle :** rendus dérivés : PDF + CSV (best effort)

Colonnes :
- `id` (uuid, PK)
- `render_key` (text, UNIQUE, NOT NULL)
- `audit_key` (text, FK → audit_jobs.audit_key, NOT NULL)
- `versions` (jsonb, NOT NULL) — inclut `RENDER_VERSION`, `CSV_EXPORT_VERSION`
- `canonical_input` (jsonb, NOT NULL)
- `pdf_ref` (text, nullable) — null si rendu échoue
- `csv_ref` (text, nullable) — null si export échoue
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|partial|failed` (interne)
- `errors` (jsonb, NOT NULL, default `[]`) — stage `render_pdf|storage|...`
- `timings_ms` (jsonb, NOT NULL, default `{}`)

Contraintes :
- UNIQUE(`render_key`)
- FK(`audit_key`) → audit_jobs

### 5.7 (Optionnel MVP mais recommandé) `request_log`
**Rôle :** observabilité + anti-abus + support minimal (sans coupler au cache)

Colonnes (minimum) :
- `id` (uuid, PK)
- `received_at` (timestamptz)
- `request_id` (text, UNIQUE)
- `endpoint` (text) — `/api/audit-solo|/api/audit-duo`
- `request_hash` (text) — hash du payload canonique (debug)
- `keys` (jsonb) — product/snapshot/run/audit/render si connus
- `status` (text) — `ok|error`
- `http_status` (int)
- `error_code` (text, nullable)
- `duration_ms` (int, nullable)

## 6) Storage (Supabase) — refs internes (sans impact export)

Principe :
- Le DB stocke des `*_ref` internes vers Storage (ex: `storage://...`), mais **les exports publics** restent conformes SSOT.
- `Evidence.ref` reste une **ancre HTML**. Les chemins storage (screenshots, dom, logs) vont dans `Evidence.details.storage_ref`.

Recommandation d’arborescence (non normative) :
- `snapshots/<snapshot_key>/<source>/<viewport>/...`
- `runs/<run_key>/...` (exports JSON, traces)
- `audits/<audit_key>/report.html`
- `renders/<render_key>/report.pdf` et `tickets.csv`

## 7) Anti-drift : contraintes d’immutabilité & idempotence

1) **Uniqueness** : chaque `*_key` est UNIQUE ; les écritures doivent être des upserts “insert-if-absent”.  
2) **Immutabilité logique** : si un record existe pour une key, on ne ré-écrit pas `exports`, `html_ref`, `pdf_ref`, etc. (sauf si le record est explicitement marqué `failed` et qu’un retry produit strictement le même hash).  
3) **Drift detection** :
   - `audit_jobs.html_content_hash` permet de détecter toute divergence inattendue pour une même `audit_key`.
4) **Conservation evidence packs** :
   - `score_runs.exports` est conservé tel quel (auditabilité), même si le rendu HTML évolue via un bump de version.
5) **Séparation strict / best-effort** :
   - Les champs opérationnels (retry_count, last_error_at) peuvent évoluer sans affecter les outputs.
6) **Tri & troncatures** :
   - Stocker des listes déjà triées (tickets/evidences) selon les règles SSOT.
   - Si troncature interne : annoter uniquement dans `Evidence.details` (ex: `{truncated:true,...}`).

## 8) DoD — DB_SCHEMA (release gate)

- [ ] Tables MVP présentes : `products`, `snapshots`, `snapshot_sources`, `score_runs`, `audit_jobs`, `audit_renders`
- [ ] UNIQUE sur `product_key/snapshot_key/run_key/audit_key/render_key`
- [ ] `snapshot_sources` porte `evidence_completeness` **par source** + `missing_evidence` (interne)
- [ ] `audit_jobs.report_meta.evidence_completeness` = **pire des sources**
- [ ] SOLO : `alignment_level=null` ; DUO : `high|medium|low`
- [ ] `score_runs.exports` stocke Ticket v2 + Evidence v2 **sans drift**
- [ ] `Evidence.ref` exporté = `#evidence-<evidence_id>` ; storage refs uniquement dans `Evidence.details`
- [ ] `captured_at` (par source) est la source de vérité pour `Evidence.timestamp` (pas de `now()`)
- [ ] `html_content_hash` stocké pour détecter drift sur une même `audit_key`
- [ ] `pdf_ref/csv_ref` peuvent être `null` si échec, sans casser `status="ok"` quand HTML existe
