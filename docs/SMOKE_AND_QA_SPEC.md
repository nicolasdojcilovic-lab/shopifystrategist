# ShopifyStrategist — SMOKE_AND_QA_SPEC.md (SSOT)

- **SMOKE_AND_QA_SPEC_VERSION :** 1.2
- **Objectif :** Définir les **smoke tests** et les **gates QA** garantissant l’anti-drift sur l’API et les livrables (**HTML SSOT**, **PDF strictement dérivé**, CSV v1, exports Ticket/Evidence v2).
- **Portée :** Contrat de tests (pas de code), centré sur :
  - schémas/export, enums, versions,
  - déterminisme (**IDs / tri / troncatures / keys**),
  - DUO sources + `alignment_level`,
  - mode dégradé + `errors[]`,
  - anchors (`Evidence.ref`) + wrappers HTML (`ticket-*`, `evidence-*`),
  - règles “HTML SSOT ⇒ ok” + nulls autorisés.

---

## 0) Références SSOT (source de vérité)

- `docs/API_DOC.md` (contrat API : schémas, enums, tri, `errors[]`, versions)
- `docs/REPORT_OUTLINE.md` (structure HTML SSOT, sections, “Missing evidence”)
- `docs/SCORING_AND_DETECTION.md` (Ticket/Evidence v2, scoring, evidence_completeness, diversity rules, tri)
- `docs/EVIDENCE_PACK_SPEC.md` (Evidence anchors, tri evidences, “Missing evidence” HTML-only)
- `docs/AUDIT_PIPELINE_SPEC.md` (stages macro, keys, copy_ready scope, mode dégradé)
- `docs/DB_SCHEMA.md` (déterminisme keys, contraintes “HTML exists ⇒ ok”)
- `docs/DETECTORS_SPEC.md` (facts-only, déterminisme, interdiction de leak interne)
- `docs/SPEC.md` (invariants : HTML SSOT, PDF dérivé, evidence-based)

> Règle anti-drift : si une règle est déjà SSOT ailleurs, **référencer** au lieu de redéfinir.

---

## 1) Définitions

### 1.1 Smoke test
Exécution end-to-end via l’API qui vérifie :
- conformité réponse API (schemas, enums, versions),
- livrables générés (HTML SSOT obligatoire, PDF/CSV best-effort),
- déterminisme sur rerun (IDs, tri, troncatures, keys),
- gestion mode dégradé (`errors[]` conforme, sans casser `ok` si HTML existe).

### 1.2 Gate QA
Condition **release-blocking**. Si un gate échoue : release bloquée.

### 1.3 Principe clé : “keys ≠ refs storage”
- `keys.*` : **déterministes**, utilisés pour prouver l’anti-drift.
- `artifacts.*_ref` : références de stockage (peuvent varier), **ne prouvent pas** le déterminisme.

### 1.4 Fixtures / environnements de smoke
- Les smoke tests doivent s’exécuter sur des URLs **stables** (fixtures) et versionnées côté projet (liste contrôlée).
- Les fixtures “dégradées” (cookie/popup/…) doivent être **reproductibles**.
- Les smoke ne doivent pas dépendre d’un site tiers instable (sinon flakiness = faux négatifs).

---

## 2) Scénarios smoke requis (minimum)

> Tous les scénarios doivent être exécutés avec `render.pdf=true` et `render.csv=true`, puis au moins :
> - une variante `render.pdf=false`,
> - une variante `render.csv=false`,
> afin de valider les nulls autorisés.

### S1 — SOLO Instant (baseline)
- Endpoint : `POST /api/audit-solo`
- Options : `copy_ready=false`
- Attendus :
  - `status="ok"`
  - `mode="solo"`
  - `report_meta.alignment_level = null`
  - `artifacts.html_ref` non-null (HTML SSOT)
  - `exports.tickets[]` et `exports.evidences[]` valides (Ticket v2 / Evidence v2)
  - `errors[]` vide sur fixture “saine” ; sinon voir §6
  - `versions` présentes **conformément à `docs/API_DOC.md`** (ce document ne redéfinit pas la liste)

### S2 — SOLO Client-Ready (copy-ready)
- Endpoint : `POST /api/audit-solo`
- Options : `copy_ready=true`
- Attendus (en plus de S1) :
  - **Exports strictement inchangés vs S1** : mêmes `ticket_id`, mêmes `evidence_id`, même ordre, même contenu export (tickets/evidences/CSV).
  - Diff autorisée : HTML/PDF (copy-ready dans HTML), `errors[]` inchangé.
  - **Keys attendues (anti-drift)** :
    - `run_key` **identique** à S1 (copy_ready ne change pas le run),
    - `audit_key` et `render_key` **peuvent** changer (car HTML/PDF changent).

### S3 — DUO AB
- Endpoint : `POST /api/audit-duo`
- `compare_type="ab"` (page_a vs page_b)
- Attendus :
  - `status="ok"`
  - `mode="duo_ab"`
  - `report_meta.alignment_level ∈ {high, medium, low}`
  - `report_meta.evidence_completeness` = **pire des sources** (page_a/page_b) (cf. §5.3)
  - `errors[]` : chaque entrée a `source ∈ {page_a, page_b, na}`

### S4 — DUO Before/After
- Endpoint : `POST /api/audit-duo`
- `compare_type="before_after"` (before vs after)
- Attendus :
  - `status="ok"`
  - `mode="duo_before_after"`
  - `report_meta.alignment_level ∈ {high, medium, low}`
  - `report_meta.evidence_completeness` = **pire des sources** (before/after) (cf. §5.3)
  - `errors[]` : chaque entrée a `source ∈ {before, after, na}`

---

## 3) Gates QA anti-drift (release-blocking)

### 3.1 Schémas exports (strict)
- Aucun ticket sans `evidence_refs[]` (>=1).
- `ticket_id` et `evidence_id` respectent les formats SSOT.
- Aucun champ export ajouté (Ticket/Evidence/CSV).
- `Evidence.ref` est **exactement** : `#evidence-<evidence_id>`.

### 3.2 Wrappers / anchors HTML (SSOT)
À partir du HTML pointé par `artifacts.html_ref` :
- Pour chaque `exports.evidences[]` : un élément existe avec `id="evidence-<evidence_id>"`.
- Pour chaque `exports.tickets[]` : un élément existe avec `id="ticket-<ticket_id>"`.
- Chaque `ticket.evidence_refs[]` référence un `evidence_id` existant dans `exports.evidences[]`.

> Gate : si un seul anchor/wrapper manque → FAIL (navigabilité SSOT cassée).

### 3.3 Déterminisme IDs / tri / troncatures / diversité (normatif)
- Tickets :
  - ordre stable conforme SSOT (API_DOC / SCORING),
  - troncatures : **trier puis tronquer** (jamais sampling),
  - respect des **caps** définis SSOT (sans redéfinir les nombres ici),
  - respect des **diversity rules** SSOT (API_DOC / SCORING).
- Evidences :
  - ordre stable conforme SSOT (API_DOC / EVIDENCE_PACK_SPEC),
  - timestamps issus du snapshot/capture (interdit : timestamp de rendu),
  - respect des **caps** définis SSOT.

### 3.4 Versions exposées (anti-drift)
- `versions` et ses clés doivent être **conformes au contrat de `docs/API_DOC.md`**.
- Ajout/suppression/renommage d’une clé de version = **patch SSOT obligatoire** (API_DOC d’abord), sinon FAIL QA.

### 3.5 Erreurs : enums macro uniquement + pas de leak interne
- Chaque entrée de `errors[]` respecte :
  - `stage` ∈ enum **macro** (API_DOC),
  - `source` ∈ enum SSOT :
    - SOLO : `na` uniquement,
    - DUO AB : `page_a|page_b|na`,
    - DUO Before/After : `before|after|na`,
  - `missing_evidence_reason` ∈ enum SSOT (si applicable).
- Interdit : exposer des noms de détecteurs, modules internes, ou sous-stages non SSOT.

### 3.6 SOLO vs DUO : `alignment_level` (contrat)
- SOLO : `report_meta.alignment_level` doit être `null`.
- DUO : `report_meta.alignment_level` doit être dans `{high, medium, low}`.

### 3.7 Cohérence `evidence_completeness` ↔ erreurs capture
- Si une entrée `errors[]` contient `missing_evidence_reason` non-null ⇒ `report_meta.evidence_completeness` **ne peut pas** être `complete`.
- Si `report_meta.evidence_completeness == "complete"` ⇒ aucune erreur capture ne doit porter `missing_evidence_reason`.

---

## 4) Gates HTML : “Missing evidence” (SSOT)

### 4.1 Affichage conditionnel
- Si `report_meta.evidence_completeness != "complete"` :
  - une section **“Missing evidence”** doit exister dans le HTML.
- Si `report_meta.evidence_completeness == "complete"` :
  - la section “Missing evidence” peut être absente.

### 4.2 Vocabulaire des raisons (6 reasons)
La section “Missing evidence” n’utilise que les 6 raisons SSOT (API_DOC / EVIDENCE_PACK_SPEC), sans variantes.

### 4.3 DUO : détail par source (HTML-only)
En DUO, la section “Missing evidence” doit expliciter le détail **par source** (page_a/page_b ou before/after).  
Le cover reflète toujours le **pire des sources** : `insufficient > partial > complete`.

### 4.4 Liaison erreurs ↔ “Missing evidence” (anti-drift)
Pour chaque entrée `errors[]` avec `stage="capture"` et `missing_evidence_reason` non-null :
- la section “Missing evidence” doit contenir un item correspondant (au minimum : **source + reason**).

---

## 5) Gates `evidence_completeness` (SSOT)

### 5.1 Mapping (règle dure)
Mapping gating screenshots → `report_meta.evidence_completeness` :
- **Set A présent** ⇒ `complete`
- **Set B présent** et **Set A absent** ⇒ `partial`
- **Aucun set** ⇒ `insufficient`

### 5.2 SOLO : résultat
- Le smoke vérifie que la valeur renvoyée correspond au mapping ci-dessus, sur des fixtures explicitement construites (A only / B only / none).

### 5.3 DUO : agrégation cover (pire des sources)
- En DUO, le calcul est **par source** (interne) et le cover affiche le **pire des sources** :
  - `insufficient > partial > complete`
- La preuve par source est visible dans la section HTML “Missing evidence” (HTML-only).

---

## 6) Matrice des cas dégradés (obligatoires)

> Objectif : prouver que la stack reste livrable (HTML SSOT) et explicite ses limites via `errors[]`, sans casser les invariants.

| Cas dégradé | Symptôme (haut niveau) | Attendu `status` | Attendu `errors[]` (minimum) | Attendu `missing_evidence_reason` | Notes livrable |
|---|---|---|---|---|---|
| cookie | blocage par consentement | ok si HTML existe | 1+ erreur `stage="capture"` + `source` | `blocked_by_cookie_consent` | “Missing evidence” visible si completeness != complete |
| popup | popup bloquant | ok si HTML existe | 1+ erreur `stage="capture"` + `source` | `blocked_by_popup` | idem |
| timeout | timeout capture | ok si HTML existe | 1+ erreur `stage="capture"` + `source` | `timeout` | idem |
| navigation_intercepted | redirection / intercepte navigation | ok si HTML existe | 1+ erreur `stage="capture"` + `source` | `navigation_intercepted` | idem |
| infinite_scroll_or_lazyload | éléments jamais chargés | ok si HTML existe | 1+ erreur `stage="capture"` + `source` | `infinite_scroll_or_lazyload` | idem |
| unknown_render_issue | erreur capture non classée | ok si HTML existe | 1+ erreur `stage="capture"` + `source` | `unknown_render_issue` | idem |

Règles :
- `missing_evidence_reason` est renseigné **uniquement** pour les erreurs liées à la preuve/capture.
- Pour les erreurs non liées à la preuve (ex : storage), `missing_evidence_reason` doit rester `null`.

---

## 7) Règles “HTML SSOT ⇒ ok” + nulls autorisés

### 7.1 Status
- Si `artifacts.html_ref` est non-null ⇒ `status="ok"` (même si dégradé).
- Si `status="error"` ⇒ `artifacts.html_ref` doit être `null` (aucun livrable SSOT possible).

### 7.2 PDF / CSV (best-effort)
- `artifacts.pdf_ref` peut être `null` si :
  - rendu PDF désactivé (`render.pdf=false`), ou
  - rendu/storage échoue (alors `errors[]` reflète un stage macro SSOT, ex. `render_pdf` ou `storage`).
- `artifacts.csv_ref` peut être `null` si :
  - rendu CSV désactivé (`render.csv=false`), ou
  - storage échoue (alors `errors[]` reflète `storage`).

---

## 8) Tests de rerun (déterminisme keys + stabilité exports)

### 8.1 Rerun “same request”
Relancer exactement le même payload :
- mêmes `ticket_id` / `evidence_id`,
- même ordre (tickets/evidences),
- mêmes `report_meta.*`,
- mêmes `keys.*` attendues (déterminisme selon DB_SCHEMA),
- `artifacts.*_ref` : non utilisé comme preuve de déterminisme.

### 8.2 Rerun “same request” avec `copy_ready` togglé
À payload identique sauf `copy_ready` :
- exports inchangés (IDs/ordre/contenu),
- `run_key` identique,
- `audit_key`/`render_key` peuvent changer (si HTML/PDF changent).

### 8.3 Rerun “by key”
Quand l’API supporte le rerun par `snapshot_key`/`run_key`/`audit_key`/`render_key` :
- rerun par key reproduit les mêmes exports et le même HTML SSOT (si mêmes versions et mêmes options applicables).

### 8.4 Variantes render (pdf/csv)
- `render.pdf=false` :
  - `status="ok"` si HTML existe,
  - `artifacts.pdf_ref` peut être `null`,
  - pas d’erreur requise si la non-génération est volontaire.
- `render.csv=false` :
  - `artifacts.csv_ref` peut être `null`,
  - exports JSON (tickets/evidences) restent présents.

> Gate : une option “disable render” ne doit pas provoquer `status="error"` si HTML existe.

---

## 9) DoD (Definition of Done) — SMOKE & QA

- [ ] S1 SOLO Instant : OK (HTML SSOT, exports valides, tri stable, versions conformes API_DOC).
- [ ] S2 SOLO Client-Ready : exports strictement identiques à S1 (IDs/ordre/contenu export) + `run_key` identique.
- [ ] S3 DUO AB : OK + `alignment_level` enum + `evidence_completeness` = pire des sources.
- [ ] S4 DUO Before/After : OK + `alignment_level` enum + `evidence_completeness` = pire des sources.
- [ ] HTML anchors : wrappers `ticket-*` et `evidence-*` présents et cohérents avec exports.
- [ ] `Evidence.ref` = `#evidence-<evidence_id>` (règle dure).
- [ ] “Missing evidence” : présent si completeness != complete + vocabulaire 6 reasons + **liaison avec errors capture** + détail par source en DUO.
- [ ] Dégradé : 6 cas couverts avec `errors[]` + `missing_evidence_reason` SSOT, sans leak interne.
- [ ] Nulls autorisés : PDF/CSV peuvent être null sans casser `status="ok"` si HTML existe.
- [ ] Rerun : stabilité IDs/tri + `keys.*` déterministes (refs storage non utilisées comme preuve).
- [ ] Aucune dérive schéma : aucun champ export / colonne CSV ajoutée.
- [ ] Conformité caps + diversité : conforme SSOT (SCORING/API_DOC), sans redéfinition ici.
