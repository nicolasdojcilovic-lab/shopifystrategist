# ShopifyStrategist — FIXTURES_AND_ENV_SPEC.md (SSOT)

## Owned Concepts (Canonical)
- TBD

## Not Owned (References)
- TBD

- **FIXTURES_AND_ENV_SPEC_VERSION:** 1.2
- **Objectif:** définir un pack de fixtures stables + une interface d’environnement pour exécuter les smoke tests de manière déterministe, anti-flaky, et anti-drift.
- **Portée:** fixtures + conventions d’exécution + artefacts attendus. Pas de code.
- **Non-objectif:** redéfinir des schémas/enums/thresholds déjà SSOT.

---

## 0) Références SSOT

- `docs/API_DOC.md`
- `docs/SMOKE_AND_QA_SPEC.md`
- `docs/RUNBOOK_OPERATIONS.md`
- `docs/REPORT_OUTLINE.md`
- `docs/SCORING_AND_DETECTION.md`
- `docs/EVIDENCE_PACK_SPEC.md`
- `docs/DB_SCHEMA.md`
- `docs/AUDIT_PIPELINE_SPEC.md`
- `docs/DETECTORS_SPEC.md`

### 0.1 Hiérarchie
- Payloads API : conformes à `API_DOC.md`.
- Gates/Assertions : conformes à `SMOKE_AND_QA_SPEC.md` + `RUNBOOK_OPERATIONS.md`.
- Autorité de ce doc : structure pack, format fixtures, anti-flaky, env, artefacts.

---

## 1) Structure du pack fixtures

### 1.1 Emplacement
- `fixtures/smoke/`
  - `README.md`
  - `fixtures.index.json`
  - `<fixture_id>.json`

### 1.2 Index canonique (`fixtures.index.json`)
Champs requis :
- `fixture_id`
- `category` ∈ `solo|duo|degraded`
- `scenario`
- `enabled` (bool)
- `tier` ∈ `gold|silver|bronze`
- `profiles` : liste ∈ `pr_gate|nightly`
- `tags` : liste (convention : inclure `solo`, `duo_ab`, `duo_before_after`, `degraded`)

Règles :
- ordre stable dans l’index = ordre d’exécution par défaut.
- `bronze` ∉ `pr_gate`.
- Les 4 baselines `pr_gate` doivent être prioritairement **contrôlées/owned** (voir §4.4).

---

## 2) Format d’une fixture (contrat interne)

### 2.1 Métadonnées
- `fixture_id`
- `name`
- `category`
- `tier`
- `profiles`
- `notes` (optionnel)
- `serial_only` (bool, default false) — force exécution séquentielle de cette fixture

### 2.2 Requête API
- `endpoint` ∈ `/api/audit-solo|/api/audit-duo`
- `request` : payload conforme `API_DOC.md`
- `render` : `{ "pdf": bool, "csv": bool }`

### 2.3 Assertions internes (schema fermé)
`expect` :
- `status` : `"ok"|"error"`
- `mode` : `"solo"|"duo_ab"|"duo_before_after"`
- `alignment_level` : `"null_in_solo"|"enum_in_duo"`
- `evidence_completeness` : `"complete"|"partial"|"insufficient"|"any"`
- `missing_evidence` :
  - `must_exist_if_not_complete` (bool)
  - `must_detail_by_source_in_duo` (bool)
- `errors` :
  - `allowed_stages` : `"any"` ou liste (stages macro SSOT)
  - `required_stage` : `"none"` ou un stage macro
  - `allowed_missing_evidence_reasons` : `"any"` ou liste (6 reasons)
  - `required_missing_evidence_reason` : `"none"` ou une reason (6 reasons)
  - `source_policy` :
    - `solo_source_must_be_na` (bool)
    - `duo_sources_allowed` : `"by_mode"` ou liste
- `determinism` :
  - `runs` : entier (default 2)
  - `must_match` : liste ∈ `{exports, keys, report_meta, html_hash, ticket_order, evidence_order}`
  - `must_not_use` : doit inclure `artifacts_refs`
- `html_fetch_policy` :
  - `required` (bool)
- `skip_conditions` :
  - `skip_pdf_assertions_if_render_pdf_disabled` (bool, default true)
  - `skip_csv_assertions_if_render_csv_disabled` (bool, default true)

Règles :
- Tout champ hors schema est interdit.
- En **PR gate**, `html_fetch_policy.required` doit être `true` (pas de skip HTML).
- `skip_conditions` n’autorise que des skips liés à `render.pdf=false` / `render.csv=false` (pas de contournement contractuel).

---

## 3) Catalogue minimal obligatoire

### 3.1 Baselines (must-pass, `pr_gate`)
1. `solo_ok_instant`
2. `solo_ok_copyready` (mêmes URLs que `solo_ok_instant`)
3. `duo_ab_ok`
4. `duo_before_after_ok`

### 3.2 Dégradés (6 reasons, `nightly`)
5. `degraded_cookie` → `blocked_by_cookie_consent`
6. `degraded_popup` → `blocked_by_popup`
7. `degraded_timeout` → `timeout`
8. `degraded_navigation_intercepted` → `navigation_intercepted`
9. `degraded_infinite_scroll_or_lazyload` → `infinite_scroll_or_lazyload`
10. `degraded_unknown_render_issue` → `unknown_render_issue`

Règles dégradés :
- `expect.errors.required_stage = "capture"`
- `expect.errors.required_missing_evidence_reason` = reason ciblée (jamais `"any"`)
- `expect.evidence_completeness` doit être **`partial` ou `insufficient`** (interdit : `complete`)
- `expect.missing_evidence.must_exist_if_not_complete = true`

---

## 4) Règles anti-flaky (URLs)

### 4.1 Critères gold
- publique, stable, sans login/paywall/geo gating
- DOM relativement stable
- éviter anti-bot instable

### 4.2 Exclusions
- auth/checkout
- promos flash / contenu “today-only”
- sites qui bloquent l’automation

### 4.3 Qualification tiering
- PR gate validation : 2 runs consécutifs sans P0.
- Promotion `gold` : 5 runs sur ≥ 2 jours (nightly), sans violation Fast Contract Check.

### 4.4 Règle “owned baseline” (fortement recommandée)
- Les 4 baselines `pr_gate` doivent idéalement cibler un **shop de test contrôlé** (owned) pour minimiser le risque externe.
- Les pages externes restent recommandées pour `nightly` (détection dérives externes).

---

## 5) Gouvernance des changements

### 5.1 Changer une URL
- Si scénario identique : garder `fixture_id`, documenter dans `notes`, requalifier tier.
- Si scénario change : nouveau `fixture_id`, ancien `enabled=false`.

### 5.2 Trace des changements (anti-support)
Le runner doit produire un hash de la fixture :
- `fixture_contract_hash = SHA256(canonical_json(fixture_file))`
et l’écrire dans les artefacts (§8).

---

## 6) Profils d’exécution

- Local : rapide
- CI PR gate : strict, `profiles=pr_gate`, fail fast
- Nightly : `profiles=nightly` (inclut bronze)

Règles :
- Les fixtures marquées `serial_only=true` s’exécutent toujours séquentiellement, même si `SMOKE_CONCURRENCY>1`.

---

## 7) Variables d’environnement

### 7.1 Réseau / API
- `SMOKE_BASE_URL`
- `SMOKE_TIMEOUT_MS` (reco : 120000)
- `SMOKE_CONCURRENCY` (reco PR gate : 1)

### 7.2 Exécution
- `SMOKE_OUT_DIR` (default `tmp/smoke`)
- `SMOKE_RUNS_PER_FIXTURE` (default 2)
- `SMOKE_MAX_RERUN_TRANSIENT` (default 1)
- `SMOKE_FAIL_FAST` (default true en PR gate)
- `SMOKE_PROFILE` ∈ `pr_gate|nightly|all` (default `pr_gate`)

### 7.3 Fetch HTML (hard rule)
- `SMOKE_FETCH_HTML` (bool, default true)
Règles :
- En PR gate : `SMOKE_FETCH_HTML=true` est obligatoire.
- En nightly : `SMOKE_FETCH_HTML` peut être true/false, mais si false le runner doit marquer explicitement “no html fetch” et ne pas valider les gates wrappers/anchors.

### 7.4 Auth (optionnel)
- `SMOKE_AUTH_HEADER_NAME`
- `SMOKE_AUTH_HEADER_VALUE`

---

## 8) Artefacts attendus

### 8.1 Layout
- `tmp/smoke/<fixture_id>/run_<n>/request.json`
- `tmp/smoke/<fixture_id>/run_<n>/response.json`
- `tmp/smoke/<fixture_id>/run_<n>/assertions.json`
- `tmp/smoke/<fixture_id>/run_<n>/fingerprint.json`
- `tmp/smoke/<fixture_id>/run_<n>/fixture_contract_hash.txt`
- `tmp/smoke/<fixture_id>/run_<n>/errors.txt` (si FAIL)
- `tmp/smoke/<fixture_id>/run_<n>/report.html` (si fetch)
- `tmp/smoke/<fixture_id>/run_<n>/report.pdf` (si `pdf_ref` non-null)
- `tmp/smoke/<fixture_id>/run_<n>/tickets.csv` (si `csv_ref` non-null)

### 8.2 Fingerprint (comparaison rapide)
`fingerprint.json` inclut au minimum :
- `fixture_id`, `fixture_contract_hash`
- `keys.*`
- `versions`
- `report_meta`
- hash HTML (si fetch) + tailles artefacts
- compteurs : `tickets_count`, `evidences_count`, `errors_count`

---

## 9) DoD

- [ ] pack présent (README + index + fixtures)
- [ ] index stable avec `tier` + `profiles` + tags conventionnels
- [ ] 10 fixtures minimales (4 baselines pr_gate + 6 dégradés nightly)
- [ ] `expect` respecte le schema fermé
- [ ] dégradés verrouillés : stage=capture + reason ciblée + completeness not complete
- [ ] qualification gold définie (5 runs / ≥2 jours)
- [ ] `SMOKE_FETCH_HTML` obligatoire en PR gate
- [ ] `serial_only` supporté pour fixtures fragiles
- [ ] artefacts incluent fingerprint + fixture_contract_hash
- [ ] alignement explicite avec SMOKE_AND_QA_SPEC + RUNBOOK
