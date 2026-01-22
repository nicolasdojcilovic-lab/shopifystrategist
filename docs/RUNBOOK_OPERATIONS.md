# ShopifyStrategist — RUNBOOK_OPERATIONS.md (SSOT)

- **RUNBOOK_OPERATIONS_VERSION:** 1.2
- **Objectif:** runbook opérationnel pour minimiser le support, empêcher le drift, et garantir un livrable “agency-grade” **même en mode dégradé**.
- **Principe:** ce document **ne redéfinit pas** les règles SSOT ; il **référence** et verrouille l’opérationnel.

---

## 0) Références SSOT (source de vérité)

- `docs/SPEC.md` (invariants produit)
- `docs/API_DOC.md` (contrats API, schémas exports, enums, erreurs)
- `docs/REPORT_OUTLINE.md` (structure HTML SSOT)
- `docs/SCORING_AND_DETECTION.md` (tri/troncatures/caps/diversity rules, Ticket/Evidence v2)
- `docs/DETECTORS_SPEC.md` (facts-only, anti-leak)
- `docs/AUDIT_PIPELINE_SPEC.md` (pipeline, mode dégradé, keys)
- `docs/EVIDENCE_PACK_SPEC.md` (Evidence.ref, tri evidences, Missing evidence)
- `docs/DB_SCHEMA.md` (keys, idempotence, drift detection, `html_content_hash`)
- `docs/SMOKE_AND_QA_SPEC.md` (gates QA & smoke scenarios)

### 0.1 Hiérarchie contractuelle (anti-drift)
- **API/livrables:** `docs/API_DOC.md` est l’**autorité** contractuelle.
- **Release gates:** `docs/SMOKE_AND_QA_SPEC.md` est **release-blocking**.
- Ce runbook est **opérationnel** : en cas de divergence, **API_DOC + SMOKE** priment.

---

## 1) Invariants opérationnels (rappel)

Ces règles sont **release-blocking** en production.

1. **HTML report = SSOT.** PDF strictement dérivé du HTML (Playwright). (API_DOC, SPEC)
2. **Evidence-based:** aucun ticket exporté sans `evidence_refs[]` (>=1). (API_DOC)
3. **No RUM:** métriques perf/poids = **lab metrics** best-effort. (API_DOC)
4. **Anti-drift export:** aucun nouveau champ export (Ticket v2 / Evidence v2 / CSV v1). Info additionnelle = interne ou `Evidence.details`. (API_DOC)
5. **Mode dégradé:** si `artifacts.html_ref` existe, `status="ok"` doit tenir ; les limites doivent apparaître dans `errors[]` + “Missing evidence” si applicable. (API_DOC, REPORT_OUTLINE)
6. **SOLO / DUO (contrat):**
   - SOLO: `report_meta.alignment_level = null`
   - DUO: `report_meta.alignment_level ∈ {high, medium, low}` (API_DOC)
7. **Anchors / wrappers (contrat):**
   - `Evidence.ref` = `#evidence-<evidence_id>`
   - wrappers HTML requis: `id="ticket-<ticket_id>"` et `id="evidence-<evidence_id>"` (API_DOC, REPORT_OUTLINE)
8. **DUO preuves:** `evidence_completeness` calculé **par source** ; la cover expose le **pire des sources** ; détail par source en “Missing evidence” (**HTML-only**). (API_DOC, EVIDENCE_PACK_SPEC)

### 1.1 Principe clé : keys ≠ refs storage
- `keys.*` (ex: `run_key`, `audit_key`, `render_key`) : déterminisme / idempotence.
- `artifacts.*_ref` : références de stockage (peuvent varier), **ne prouvent pas** le déterminisme.

---

## 2) Intake support / ops (signal minimum)

### 2.1 À demander systématiquement (copier/coller)
- **Type:** SOLO Instant / SOLO Client-Ready / DUO AB / DUO Before/After
- **Request JSON complet (redacted)** (payload API)
- **Response JSON complète (redacted)** (incluant `versions`, `keys`, `errors`, `artifacts`, `exports`)
- **Keys:** `product_key`, `snapshot_key`, `run_key`, `audit_key`, `render_key`
- **Artifacts:** `html_ref`, `pdf_ref`, `csv_ref`
- **En DUO:** `compare_type` + URLs `page_a/page_b` ou `before/after`
- **Heure / timezone**
- **Si possible:** accès au HTML (car c’est le SSOT)

### 2.2 Anti-support (ce qu’on refuse)
- “Ça ne marche pas” sans payload/response → non actionnable.
- Screenshot du PDF seulement → insuffisant (SSOT = HTML + JSON).

### 2.3 Redaction / sécurité (obligatoire)
Avant partage :
- masquer tokens, cookies, headers sensibles, URLs signées, identifiants persos.
- si URL contient des paramètres sensibles : fournir une version masquée + les `keys.*`.
- ne jamais partager de contenu HTML contenant des infos personnelles non nécessaires (préférer la preuve via `keys.*` + checks contractuels).

---

## 3) Triage (P0/P1/P2) — routine 90 secondes

### 3.1 Fast Contract Check (release-blocking)
À faire **sur chaque incident** (et avant toute conclusion “livrable”) :

1. **Status ↔ HTML**
   - si `html_ref != null` ⇒ `status` doit être `"ok"`
   - si `status="error"` ⇒ `html_ref` doit être `null`

2. **Exports (strict)**
   - aucun ticket sans `evidence_refs[]` (>=1)
   - pas de champ export additionnel (Ticket v2 / Evidence v2 / CSV v1)

3. **Anchors / wrappers**
   - `Evidence.ref` exact = `#evidence-<evidence_id>`
   - wrappers HTML : `ticket-*` et `evidence-*` existent

4. **Enums fermées**
   - `errors[].stage` : enum macro (API_DOC)
   - `missing_evidence_reason` : enum 6 reasons (API_DOC)
   - `alignment_level` : SOLO `null`, DUO `{high, medium, low}`

5. **Sources (anti-drift)**
   - SOLO : `errors[].source` doit être **toujours `na`**
   - DUO : `errors[].source` dans `{page_a,page_b,before,after,na}` selon le mode

6. **Cohérence erreurs ↔ HTML**
   - si `missing_evidence_reason` est présent → “Missing evidence” doit l’expliquer (vocabulaire SSOT)
   - DUO : détail par source dans le HTML

7. **Versions & keys**
   - `versions` présentes (selon API_DOC)
   - pas de situation “keys identiques mais versions différentes” (drift keys)

> Si un seul point échoue → **P0** (même si HTML existe).

### 3.2 Sévérité
- **P0 (bloquant):** HTML absent, mismatch status/html, drift contractuel (cf. Fast Contract Check), ou incohérence keys/versions.
- **P1 (dégradé mais livrable):** HTML ok + limites explicites (capture issues, completeness < complete, PDF/CSV manquants best-effort).
- **P2 (optimisation):** timings, headers best-effort absents, variations `artifacts.*_ref`, micro-diff non contractuelle.

---

## 4) Lecture de `errors[]` (macro stages) — interprétation

`errors[].stage` est un enum **macro** (autorité = API_DOC). Lecture opérationnelle typique :
- `normalize` : normalisation entrée
- `capture` : navigation + screenshots + collecte DOM
- `detectors` : détecteurs facts-only
- `scoring` : scoring + tri + troncatures
- `report` : assemblage HTML
- `render_pdf` : HTML → PDF
- `storage` : upload/références stockage
- `unknown` : non classé

Règles (ops gates) :
- `missing_evidence_reason` uniquement pour preuve/capture, et dans l’enum des 6 reasons.
- **SOLO:** `errors[].source = na` uniquement.
- **DUO:** `errors[].source` dans l’enum du mode.
- Interdit : leak interne (sous-stages, noms de détecteurs, traces) dans `errors[]`. (DETECTORS_SPEC)

### 4.1 Cohérence “errors[]” ↔ HTML “Missing evidence”
Si `errors[]` contient un `missing_evidence_reason` :
- la section HTML “Missing evidence” doit refléter la/les raison(s) (vocabulaire SSOT),
- en DUO : détail **par source** (HTML-only).

---

## 5) Playbooks (sans code)

### 5.1 P0 — HTML SSOT absent
**Symptômes**
- `status="error"` et `html_ref=null`
- ou `status="ok"` mais `html_ref=null`

**Checks**
- `errors[].stage` (inclure `normalize`)
- présence/cohérence de `versions`

**Conclusion**
- Run non livrable : rerun contrôlé ou correction avant livraison.

---

### 5.2 P0 — Drift schéma export / anchors / enums / leak
**Symptômes**
- ticket sans `evidence_refs`
- `Evidence.ref` incorrect
- wrappers HTML manquants
- enums fermées violées
- leak interne dans `errors[]`

**Conclusion**
- Drift contractuel : release bloquée (même si HTML existe).

---

### 5.3 P1 — Dégradé “capture” (preuves incomplètes)
**Symptômes**
- `status="ok"` + `errors[].stage="capture"`
- `missing_evidence_reason` présent
- `evidence_completeness` = `partial` ou `insufficient`

**Checks**
- SOLO: `errors[].source=na` uniquement.
- DUO: `errors[].source` dans les sources du mode.
- HTML :
  - “Missing evidence” existe si completeness != complete
  - vocabulaire = 6 reasons
  - DUO : détail par source, cover = pire des sources (`insufficient > partial > complete`)

**Conclusion**
- Livrable acceptable si HTML SSOT existe et si les limites sont explicitement exposées.

---

### 5.4 P1 — PDF/CSV manquants (best-effort)
**Symptômes**
- `status="ok"` + `html_ref` non-null, mais `pdf_ref=null` et/ou `csv_ref=null`
- `errors[]` contient `stage=render_pdf` et/ou `stage=storage`

**Checks**
- Si `render.pdf=false` ou `render.csv=false` → pas un incident.
- Sinon, échec explicite dans `errors[]` (macro stage SSOT).

**Conclusion**
- Livrable SSOT = HTML.
- Backfill dérivés autorisé sous conditions (§7).

---

### 5.5 P0 — Keys/versions incohérents (drift)
**Symptômes**
- keys “semblent” identiques mais `versions` différentes
- ou drift détecté via `html_content_hash` pour un même `audit_key`

**Conclusion**
- P0 : les versions doivent être encodées dans les keys ; sinon idempotence cassée. (DB_SCHEMA)

---

## 6) Flakiness & reruns (politique ops v1)

Objectif : éviter l’inflation de coûts/support tout en réduisant les faux négatifs.

- Pour `capture`/`storage`/`render_pdf` : **1 rerun contrôlé maximum** (même payload) est acceptable.
- Si le rerun échoue de la même manière → escalader en P0/P1 selon Fast Contract Check.
- Pour `detectors`/`scoring`/`report` : pas de rerun “en boucle” (probable drift/bug).

> Les reruns ne doivent jamais overwrite un output SSOT existant pour une même key (DB_SCHEMA).

---

## 7) Retry / idempotence / backfill (sans drift)

Références : DB_SCHEMA + AUDIT_PIPELINE_SPEC.

### 7.1 Règles dures (SSOT immuable)
- Ne jamais modifier un **HTML SSOT** déjà produit pour une même `audit_key`.
- Ne jamais modifier les **exports** déjà produits pour une même `audit_key`.
- Un retry n’est acceptable que si l’exécution précédente était `failed` (ou équivalent interne), et qu’on ne ré-écrit pas un SSOT “réussi”.

### 7.2 Backfill autorisé (dérivés uniquement)
Backfill pour `pdf_ref`/`csv_ref` autorisé uniquement si :
- le HTML de référence est inchangé (**même `html_content_hash`**),
- les exports de référence sont inchangés,
- le PDF est strictement dérivé du HTML,
- le CSV est strictement dérivé des exports (CSV v1, sans colonnes supplémentaires),
- et surtout : **ne jamais overwrite une ref non-null**.
  - transitions autorisées : `null → non-null`
  - transitions interdites : `non-null → autre non-null`

> Objectif : réparer une panne `render_pdf`/`storage` sans toucher au SSOT et sans créer de variabilité.

### 7.3 Cas “nouvelle version de rendu”
Si `RENDER_VERSION` change, on ne “corrige” pas l’historique : on produit un **nouveau render_key** (nouvelle sortie) sans overwrite des anciens.

---

## 8) Rétention & régénération (politique interne v1)

> Politique interne (ne change pas les schémas exports). Les durées sont des **targets** (pas des garanties externes).

### 8.1 Principes
- Priorité : HTML SSOT.
- PDF régénérable depuis HTML.
- CSV régénérable depuis exports JSON.
- `Evidence.details` est **interne** (peut devenir stale si purge d’assets), cela ne doit pas être traité comme incident tant que SSOT (HTML + exports) est OK.

### 8.2 Targets (v1)
- DB (keys + exports) : conserver (auditabilité + idempotence).
- HTML : target long (ex: >= 12 mois).
- PDF/CSV : target plus court acceptable (ex: >= 6 mois).
- Assets capture (screenshots/traces internes) : target court (ex: >= 3 mois).

---

## 9) Communication support “agency-grade”

### 9.1 Ce qu’on promet
- Un HTML SSOT qui explique ce qui est constaté **et** ce qui n’a pas pu être prouvé.
- Des tickets actionnables, evidence-based.

### 9.2 Ce qu’on ne promet pas
- Pas de RUM.
- Pas de certitude quand `evidence_completeness != complete`.

### 9.3 Framing recommandé (dégradé)
Toujours inclure :
- `evidence_completeness`,
- raison standard (6 reasons) si applicable,
- en DUO : source(s) impactée(s).
Interdit : inventer une nouvelle raison / libellé.

---

## 10) Discipline release & versioning (mini-spec)

### 10.1 Gouvernance “API_DOC d’abord”
- Toute modification impactant API/livrables est décrite **d’abord** dans `docs/API_DOC.md`.
- Ensuite, aligner les autres docs SSOT (dont SMOKE et ce runbook).

### 10.2 Release gates
Release autorisée uniquement si :
- `SMOKE_AND_QA_SPEC.md` (DoD) passe (4 scénarios + matrice dégradée),
- aucun drift schéma/anchors/enums,
- aucun leak interne dans `errors[]`.

---

## 11) Templates (copier/coller)

### 11.1 Template “incident support”
**Résumé (1 phrase):**

**Type:** SOLO Instant / SOLO Client-Ready / DUO AB / DUO Before/After

**Request JSON (redacted):**

**Response JSON (redacted):**

**Keys:** product_key=… snapshot_key=… run_key=… audit_key=… render_key=…

**Artifacts:** html_ref=… pdf_ref=… csv_ref=…

**Fast Contract Check:** PASS / FAIL (préciser lequel)

**Observed:** (ce que le client voit)

**Expected:** (ce qui est attendu)

**Severity:** P0 / P1 / P2

### 11.2 Template “message client (dégradé)”
- Le rapport HTML est livrable (SSOT).
- Les preuves sont **{complete|partial|insufficient}**.
- Limitation rencontrée : **{blocked_by_cookie_consent|blocked_by_popup|infinite_scroll_or_lazyload|navigation_intercepted|timeout|unknown_render_issue}**.
- Source(s) impactée(s) (DUO) : **{page_a/page_b/before/after}**.
- Conséquence : certaines constatations sont présentées avec la limite de preuve correspondante (section “Missing evidence”).

---

## 12) DoD — RUNBOOK_OPERATIONS
- [ ] Hiérarchie contractuelle explicite (API_DOC + SMOKE priment).
- [ ] Fast Contract Check opérationnel (P0 même si HTML existe en cas de drift).
- [ ] Flakiness policy (rerun max 1 pour capture/storage/render_pdf).
- [ ] Backfill strict : SSOT immuable, dérivés uniquement, `null → non-null` seulement.
- [ ] Redaction / sécurité incluses.
- [ ] Cohérence `errors[]` ↔ “Missing evidence” verrouillée.
