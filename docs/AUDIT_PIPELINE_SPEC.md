# ShopifyStrategist - AUDIT_PIPELINE_SPEC.md
**Spec version:** 1.0  
**Statut :** SSOT (spécification d'orchestration)  
**But :** Verrouiller le pipeline end-to-end **sans drift** : snapshot → detectors (facts) → scoring (evidences+tickets) → report HTML (SSOT) → PDF (Playwright) → CSV v1.  
**Compat obligatoire :** `docs/SPEC.md`, `docs/REPORT_OUTLINE.md (V3.1)`, `docs/SCORING_AND_DETECTION.md (v2.2)`, `docs/DETECTORS_SPEC.md (v1.3)`.

---

## 0) Invariants (non negociables)
1) **HTML report = SSOT** ; **PDF** strictement derive du HTML (Playwright).
2) **Evidence-based** : aucun ticket sans `evidence_refs[]` (>= 1).
3) **No RUM** : perf/poids = labo best-effort ; jamais de real user metrics.
4) **Anti-drift** :
   - **Aucun nouveau champ export** (Ticket v2 / Evidence v2 / CSV v1).
   - Toute info additionnelle doit rester **interne** ou dans `Evidence.details` (sans changer le schema).
   - Ne pas redefinir thresholds/keywords/enums/regles deja SSOT : **referencer `SCORING_AND_DETECTION`**.
5) **Mode degrade** : livrer un report exploitable meme si capture/mesure partielle echoue (avec limitations explicites).
6) **Determinisme** : memes entrees + memes versions => memes sorties (IDs, tri, troncatures, contenu).

---

## 1) Objectifs / Non-objectifs
### 1.1 Objectifs
- Specifier l'orchestration **SOLO + DUO (AB & Before/After)**.
- Definir des contrats internes (request/result) pour executer sans ambiguite.
- Specifier timeouts, erreurs, determinisme, cache/keys, mode degrade.
- Garantir la conformite des exports : **Tickets v2**, **Evidence v2**, **CSV v1**.

### 1.2 Non-objectifs
- Definir signaux, mapping signal->ticket, seuils, diversity rules : c'est `SCORING_AND_DETECTION`.
- Definir le detail des detecteurs : c'est `DETECTORS_SPEC`.
- Definir la structure du report : c'est `REPORT_OUTLINE`.
- Definir l'API publique : ce sera `API_DOC.md`.

---

## 2) Versions (anti-drift)
Le report HTML (Cover + metadata) DOIT afficher :
- `REPORT_OUTLINE_VERSION = 3.1`
- `TICKET_SCHEMA_VERSION = 2`
- `EVIDENCE_SCHEMA_VERSION = 2`
- `CSV_EXPORT_VERSION = 1`
- `DETECTORS_SPEC_VERSION = 1.3`

Et les versions runtime :
- `NORMALIZE_VERSION`
- `SCORING_VERSION`
- `ENGINE_VERSION`
- `RENDER_VERSION`

Regles :
- Changement signaux/seuils/mapping/merge/dedup/IDs/tri => bump `SCORING_VERSION`.
- Changement structure report => bump `REPORT_OUTLINE_VERSION`.

---

## 3) Modes & sources
### 3.1 Mode
- `mode = "solo" | "duo_ab" | "duo_before_after"`

### 3.2 Source (utilise dans Evidence)
- `source = "page_a" | "page_b" | "before" | "after"`

Regle : en DUO, capture + detectors s'executent **par source**. Les comparaisons/diffs sont produites au scoring.

### 3.3 Viewports
- Mobile : 390x844
- Desktop : 1440x900

---

## 4) Capture artefacts (best effort)
Les noms exacts des screenshots/artefacts a produire sont SSOT (voir `DETECTORS_SPEC` et references dans `SCORING_AND_DETECTION` / `REPORT_OUTLINE`).

Le pipeline tente (best effort) :
- DOM snapshot (`dom`)
- Screenshots SSOT
- `network_log` (optionnel)
- `lighthouse` (optionnel)

### 4.1 Gating screenshots & evidence_completeness (SSOT)
La definition des sets A/B et du gating vit dans `SCORING_AND_DETECTION` (et est reprise dans `REPORT_OUTLINE`).

> **EXTRAIT VERBATIM - DO NOT EDIT HERE (source SSOT)**
- Set A (prefere) : `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
- Set B (fallback) : `above_fold_mobile` + `cta_area_mobile` + `details_section`

Decision pipeline (alignement SSOT) :
- `evidence_completeness = complete` si Set A atteint
- `evidence_completeness = partial` si Set B atteint (et Set A non atteint)
- `evidence_completeness = insufficient` si aucun set atteint

Consequence (SSOT) : si `insufficient`, afficher badge + table "Missing evidence" + deplacer en Appendix les tickets qui dependent des preuves manquantes (ou abaisser `confidence`).

---

## 5) Cache & keys (determinisme)
SPEC impose un cache multi-couches avec des keys deterministes (conceptuellement : `product_key`, `snapshot_key`, `run_key`, `audit_key`, `render_key`).

### 5.1 Invariants normatifs
- Keys derivees d'un **JSON canonique** (tri stable), puis hash (ex sha256).
- Une key DOIT inclure toutes les options/versions qui changent le résultat **de sa couche** (cf. `DB_SCHEMA` §4).  
  Exemples normatifs : `locale` vit dans `snapshot_key` ; `copy_ready` vit dans `audit_key` ; `copy_ready` n’affecte pas `run_key`.
- Aucune key ne depend de `now()` ; les timestamps proviennent du snapshot/capture.
- Rerun identique => meme resultat OU cache hit sur la couche attendue.

Note : le detail exact des champs composant chaque key est documente ailleurs (schema DB / cache spec). Ici : invariants uniquement.

---

## 6) Contrats internes (JSON)
> Ces contrats sont **internes** a l'orchestration. Ils ne changent pas les schemas export.

### 6.1 AuditJobRequest (interne)
```json
{
  "mode": "solo",
  "locale": "fr",
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  },
  "urls": {
    "page_a": "https://example.com/products/abc"
  },
  "options": {
    "copy_ready": false
  }
}
```

DUO AB (interne)
```json
{
  "mode": "duo_ab",
  "locale": "en",
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  },
  "urls": {
    "page_a": "https://brand-a.com/products/x",
    "page_b": "https://brand-b.com/products/y"
  },
  "options": {
    "copy_ready": true
  }
}
```

DUO Before/After (interne)
```json
{
  "mode": "duo_before_after",
  "locale": "fr",
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  },
  "urls": {
    "before": "https://example.com/products/abc?v=2025-12-01",
    "after": "https://example.com/products/abc?v=2026-01-10"
  },
  "options": {
    "copy_ready": false
  }
}
```

### 6.2 AuditJobResult (interne) — exemples par mode

SOLO (interne) — exemple
```json
{
  "status": "ok",
  "mode": "solo",
  "keys": {
    "product_key": "prod_...",
    "snapshot_key": "snap_...",
    "run_key": "run_...",
    "audit_key": "audit_...",
    "render_key": "render_..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "x.y.z",
    "SCORING_VERSION": "x.y.z",
    "ENGINE_VERSION": "x.y.z",
    "RENDER_VERSION": "x.y.z"
  },
  "report_meta": {
    "evidence_completeness": "partial",
    "alignment_level": null
  },
  "artifacts": {
    "html_ref": "storage://.../report.html",
    "pdf_ref": "storage://.../report.pdf",
    "csv_ref": "storage://.../tickets.csv"
  },
  "exports": {
    "tickets": [],
    "evidences": []
  },
  "errors": [],
  "timings_ms": {
    "capture_total": 0,
    "detectors_total": 0,
    "scoring_total": 0,
    "report_total": 0,
    "render_pdf_total": 0,
    "end_to_end": 0
  }
}
```

DUO AB (interne) — exemple
```json
{
"status": "ok",
"mode": "duo_ab",
"keys": {
"product_key": "prod_...",
"snapshot_key": "snap_...",
"run_key": "run_...",
"audit_key": "audit_...",
"render_key": "render_..."
},
"versions": {
"REPORT_OUTLINE_VERSION": "3.1",
"TICKET_SCHEMA_VERSION": "2",
"EVIDENCE_SCHEMA_VERSION": "2",
"CSV_EXPORT_VERSION": "1",
"DETECTORS_SPEC_VERSION": "1.3",
"NORMALIZE_VERSION": "x.y.z",
"SCORING_VERSION": "x.y.z",
"ENGINE_VERSION": "x.y.z",
"RENDER_VERSION": "x.y.z"
},
"report_meta": {
"evidence_completeness": "partial",
"alignment_level": "medium"
},
"artifacts": {
"html_ref": "storage://.../report.html",
"pdf_ref": "storage://.../report.pdf",
"csv_ref": "storage://.../tickets.csv"
},
"exports": { "tickets": [], "evidences": [] },
"errors": [],
"timings_ms": { "capture_total": 0, "detectors_total": 0, "scoring_total": 0, "report_total": 0, "render_pdf_total": 0, "end_to_end": 0 }
}
```

DUO Before/After (interne) — exemple
```json
{
"status": "ok",
"mode": "duo_before_after",
"keys": {
"product_key": "prod_...",
"snapshot_key": "snap_...",
"run_key": "run_...",
"audit_key": "audit_...",
"render_key": "render_..."
},
"versions": {
"REPORT_OUTLINE_VERSION": "3.1",
"TICKET_SCHEMA_VERSION": "2",
"EVIDENCE_SCHEMA_VERSION": "2",
"CSV_EXPORT_VERSION": "1",
"DETECTORS_SPEC_VERSION": "1.3",
"NORMALIZE_VERSION": "x.y.z",
"SCORING_VERSION": "x.y.z",
"ENGINE_VERSION": "x.y.z",
"RENDER_VERSION": "x.y.z"
},
"report_meta": {
"evidence_completeness": "partial",
"alignment_level": "medium"
},
"artifacts": {
"html_ref": "storage://.../report.html",
"pdf_ref": "storage://.../report.pdf",
"csv_ref": "storage://.../tickets.csv"
},
"exports": { "tickets": [], "evidences": [] },
"errors": [],
"timings_ms": { "capture_total": 0, "detectors_total": 0, "scoring_total": 0, "report_total": 0, "render_pdf_total": 0, "end_to_end": 0 }
}
```

Normatif :
- `exports.tickets[]` conforme **Ticket v2**.
- `exports.evidences[]` conforme **Evidence v2**.
- `artifacts.csv_ref` conforme **CSV v1** (aucune colonne ajoutee).
- SOLO : `report_meta.alignment_level = null` ; DUO : `high|medium|low` (voir §9.2).

---

## 7) Erreurs + mapping SSOT "Missing evidence reason"
### 7.1 Enum SSOT (non negociable)
Tout `missing_evidence_reason` doit etre `null` ou l'un des 6 enums SSOT :
- `blocked_by_cookie_consent`
- `blocked_by_popup`
- `infinite_scroll_or_lazyload`
- `navigation_intercepted`
- `timeout`
- `unknown_render_issue`

### 7.2 Error (interne pipeline)
```json
{
  "code": "CAPTURE_TIMEOUT",
  "stage": "capture",
  "message": "Navigation timed out on mobile viewport",
  "missing_evidence_reason": "timeout",
  "source": "page_a"
}
```

- `stage` : `normalize|capture|detectors|scoring|report|render_pdf|storage|unknown`
- `source` : `page_a|page_b|before|after|na`

Note anti-drift :
- Les erreurs internes des détecteurs (`DETECTORS_SPEC` : stages `dom_query|screenshot|network|lighthouse|dependency|unknown`) ne DOIVENT PAS être copiées telles quelles dans `errors[]` pipeline.
- `errors[]` (pipeline) expose uniquement le `stage` **macro** ci-dessus. Les détails détecteurs restent internes (ex: logs ou `Evidence.details`).

### 7.3 Regles d'assignation (recommandees, conservatrices)
- Timeout navigation / screenshot / mesure => `timeout`
- Overlay cookie present et non contournable => `blocked_by_cookie_consent`
- Popup/chat bloquant non contournable => `blocked_by_popup`
- Scroll infini / lazyload empechant capture stable => `infinite_scroll_or_lazyload`
- Redirections / navigation intercept / antibot => `navigation_intercepted`
- Crash rendu / DOM vide / incoherence majeure => `unknown_render_issue`

Si plusieurs causes plausibles : choisir la **plus explicative** ; si doute : `unknown_render_issue`.

---

## 8) Determinisme (regles dures)
1) **Tri stable puis troncature** : toujours trier avec une cle stable avant de limiter (N).
2) **IDs deterministes** : formats `ticket_id` et `evidence_id` = SSOT (`SCORING_AND_DETECTION`).
3) **Anchors HTML** (SSOT-friendly) :
   - `id="ticket-<ticket_id>"`
   - `id="evidence-<evidence_id>"`
4) **No random / no now()** : pas d'aleatoire, pas de sampling, pas d'horloge dans le resultat.
5) **Rounding stable** : Rect = int px ; Money = arrondi 2 decimales (calcul interne en cents recommande).

---

## 9) Orchestration end-to-end (normative)
### 9.1 Etapes
1) **Normalize** URL(s) -> `product_key` (NORMALIZE_VERSION)
2) **Capture** par source (viewports SSOT) : DOM + screenshots (+ option network_log + option lighthouse)
3) **Detectors** par source (facts-only, `DETECTORS_SPEC`)
4) **Scoring** (`SCORING_VERSION`, `SCORING_AND_DETECTION`) :
   - facts -> `evidences[]` (v2) + `tickets[]` (v2)
   - appliquer tri stable + caps + diversity rules SSOT
   - en DUO : appliquer les regles de comparaison / limitations SSOT
5) **Build HTML report (SSOT)** (`REPORT_OUTLINE`)
6) **Render PDF** Playwright **depuis HTML SSOT uniquement** (`RENDER_VERSION`)
7) **Export CSV v1** depuis tickets v2 (SSOT)
8) **Persist** artefacts + metadata + errors + timings

### 9.2 DUO : `alignment_level` (SSOT)
`REPORT_OUTLINE` definit la semantique et les consequences (high/medium/low).

Decision pipeline (conservatrice, anti-support) :
- `low` si :
  - une source a `evidence_completeness=insufficient`, ou
  - les preuves comparables minimales ne peuvent pas etre etablies (ex overlays bloquants, navigation intercept, timeouts repetes)
- `high` seulement si :
  - les deux sources ont un evidence pack de qualite (au moins Set A), et
  - l'alignement "section par section" est prouvable par evidences (pas d'inference)
- sinon `medium`

Si `alignment_level=low` : appliquer les caps/limitations DUO definis dans `REPORT_OUTLINE` (notamment reduction de tickets comparatifs, exposition des limitations).

---

## 10) Mode degrade (graceful degradation)
### 10.1 Principe
Un echec partiel ne doit pas empecher la livraison.
- Livrer report complet + limitations explicites.
- Deplacer en Appendix tout ticket dependant de preuves manquantes (ou abaisser `confidence`), selon regles SSOT.

### 10.2 Cas & regles
- **DOM indisponible** :
  - detectors DOM => `available=false` + reason SSOT
  - scoring : eviter les claims contestables ; Appendix-only si preuves faibles
- **Screenshots insuffisants** :
  - `evidence_completeness` selon SSOT
  - table "Missing evidence" visible (reason SSOT + impact)
- **network_log absent** :
  - pas de mesures bytes fiables ; basculer vers evidence type `detection` (niveau C) si possible, sinon omission
- **Lighthouse indispo** :
  - aucune metrique inventee ; lab-only quand dispo ; sinon omission / Appendix

### 10.3 Regle screenshot B (SSOT)
Si un detecteur utilise `method="screenshot_b"` :
- facts **ultra conservateurs**, uniquement visuellement evident
- pas de conclusions business non prouvables
- scoring ajuste `confidence` et/ou relague (Appendix) si necessaire

---

## 11) Copy-ready (add-on IA) - verrou SSOT
- Copy-ready s'applique uniquement aux **Top 5 tickets** (regle SSOT).
- Le format copy-ready suit strictement `REPORT_OUTLINE`.
- Si preuves insuffisantes : `assertive_version = null` (SSOT).

---

## 12) DoD (Definition of Done)
- SOLO + DUO (AB & Before/After) produisent : **HTML SSOT**, **PDF Playwright**, **CSV v1**.
- `tickets[]` et `evidences[]` conformes SSOT (v2/v2) ; CSV conforme v1 ; **aucune colonne ajoutee**.
- `evidence_completeness` visible (Cover) + table "Missing evidence" si != complete (reason ∈ 6 enums).
- DUO : `alignment_level` visible + limitations/caps appliques si low (OUTLINE).
- IDs deterministes + anchors `ticket-...` / `evidence-...`.
- Mode degrade valide : report livre meme en cas d'echec partiel.
- Observabilite : timings par etape + traces erreurs ; rerun identique => cache hit attendu.



