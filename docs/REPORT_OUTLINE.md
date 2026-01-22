# ShopifyStrategist — REPORT_OUTLINE.md (SSOT-aligned) — V3.1
**But :** figer le livrable “agency-grade” (structure + règles + formats) pour éviter le drift et réduire le support.  
**SSOT :** le **rapport HTML** est la source de vérité ; le **PDF** est un rendu strict (Playwright) du HTML.

---

## 0) Format versions (anti-drift)
Tout changement de structure doit incrémenter une version.

- `REPORT_OUTLINE_VERSION`: `3.1`
- `TICKET_SCHEMA_VERSION`: `2`
- `EVIDENCE_SCHEMA_VERSION`: `2`
- `CSV_EXPORT_VERSION`: `1`

**Règle :**
- changement breaking (champ supprimé/renommé, enum modifiée) ⇒ incrément majeur de la version concernée.
- le rapport doit afficher ces versions (Cover + metadata).

---

## 1) Définitions rapides
- **PDP** : page produit (Product Detail Page).
- **Teardown** : analyse structurée orientée actions (preuve → action).
- **Battlecard** : comparaison vs concurrent (écarts prouvés + plan).
- **Ticket** : unité actionnable exportable (format stable).
- **Preuve (evidence)** : screenshot / mesure / détection factuelle.
- **Lab metrics** : mesures en environnement de test (≠ données “réelles utilisateurs”).
- **Evidence completeness** : indicateur de complétude du pack de preuves (`complete` / `partial` / `insufficient`).

---

## 2) Règles globales (non négociables)

### 2.1 Evidence-based + niveaux de preuve (A/B/C)
Chaque ticket doit référencer **≥ 1 preuve**. Chaque preuve est qualifiée :

- **A (fort)** : preuve claire et directement pertinente.
  - ex : screenshot net montrant l’absence/présence, ou détection non ambiguë, ou mesure chiffrée avec méthode.
- **B (moyen)** : preuve pertinente mais incomplète (lazy-load, popup, section partiellement visible).
- **C (faible)** : inférence plausible sans preuve suffisante.

**Règles d’acceptation :**
- **Top actions** : tickets avec preuves **A ou B uniquement** et `confidence` ≠ `low`.
- **Appendix** : autorise preuves C (marquées “Best effort”).

### 2.2 Anti-hallucination (interdit)
Interdit d’affirmer des faits non détectés (délais, garanties, retours, labels, certifications, “avis vérifiés”…).
Si l’info business n’est pas détectable :
- utiliser un **placeholder** : `[INSÉRER ...]`, ou
- une formulation **conditionnelle** : “Si vous proposez X, affichez-le ici”.

### 2.3 Mode dégradé (graceful degradation)
Si une capture/mesure échoue :
- produire le rapport quand même,
- déplacer les éléments impactés en **Appendix**,
- expliquer : cause probable + contournement (ex : “popup cookies bloquante”).

### 2.4 Priorisation vendable (anti-checklist)
Le rapport doit rester “décidable” :
- **Top actions : 10 à 14 tickets** (cible)
- **Quick wins 48h : 3 à 5 tickets** (subset)
- le reste (si besoin) en Appendix.

### 2.5 Scorecard (secondaire)
La scorecard est **indicative** :
- jamais argument principal,
- ne doit pas bloquer l’usage du rapport.

### 2.6 Limite “rolls-avoidance” (anti-dev sans fin)
- Les sections sont fixes, mais les analyses internes peuvent évoluer.
- Toute nouvelle catégorie / champ export = version bump.
- Tout ce qui augmente le support est repoussé en Appendix ou en add-on.

---

## 3) Protocole d’audit (cohérence + comparabilité)

### 3.1 Viewports standard (obligatoires)
- **Mobile** : 390×844
- **Desktop** : 1440×900

### 3.2 Set de screenshots standard (best effort) + minimum garanti
Pour chaque page auditée, on vise (best effort) :
- `above_fold_mobile`
- `above_fold_desktop`
- `cta_area_mobile` (si zone CTA distincte)
- `media_section` (si détectée)
- `trust_section` (si détectée)
- `details_section`
- `full_page_mobile` (si possible)
- `full_page_desktop` (si possible)

**Minimum garanti (gating) :**
Le rapport doit produire au moins l’un des 2 ensembles suivants :
- **Set A (préféré)** : `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
- **Set B (fallback)** : `above_fold_mobile` + `cta_area_mobile` + `details_section`

**Décision (SSOT) :**
- si **Set A** est atteint ⇒ `evidence_completeness = complete`
- si **Set B** est atteint (et Set A non atteint) ⇒ `evidence_completeness = partial`
- si **aucun set** n’est atteint ⇒ `evidence_completeness = insufficient`

**Conséquences si `insufficient` :**
- afficher un badge **“Evidence incomplete”** en cover
- déplacer les tickets les plus dépendants des screenshots en Appendix (ou baisser `confidence`)

**DUO (AB / Before-After) — règle conservatrice :**
- calculer un statut **par source** (`page_a/page_b/before/after`)
- afficher en cover un statut global = **pire des sources** (`insufficient > partial > complete`)
- détailler les manques **par source** dans “Missing evidence” (HTML-only)

### 3.3 Pages dynamiques (règles)
- Tentative best effort : fermer cookies/popup/chat overlays.
- Si impossible : continuer et consigner le blocage.

### 3.4 Raisons d’échec standard (pour logs + Appendix)
Si une preuve n’est pas produite, assigner une raison :
- `blocked_by_cookie_consent`
- `blocked_by_popup`
- `infinite_scroll_or_lazyload`
- `navigation_intercepted`
- `timeout`
- `unknown_render_issue`

---

## 4) AB et Before/After : protocole réaliste (anti-promesse impossible)

### 4.1 Alignment level (niveau d’alignement)
Parce que les pages diffèrent, on qualifie la comparaison :

- `alignment_level = high` : mêmes sections repérées, preuves alignées section par section.
- `alignment_level = medium` : alignement partiel.
- `alignment_level = low` : pages trop différentes/dynamiques ; comparaison limitée.

**Règle :**
- le rapport DUO affiche `alignment_level` (Cover + Summary).
- si `low`, limiter les claims et privilégier des tickets “single-side” + notes.

### 4.2 Conséquences si `alignment_level = low` (règle produit)
- Cap : **6–8 tickets comparatifs max**
- privilégier tickets “single-side” (preuve d’un seul côté)
- `confidence` max = `medium` sauf preuve comparative A
- note standard visible :  
  “Comparison limited due to dynamic content / template mismatch. Focus is on actionable gaps supported by available evidence.”

### 4.3 AB (toi vs concurrent)
- mêmes viewports
- timestamps visibles
- preuves comparatives si possible ; sinon preuves séparées et `confidence` ajustée.

### 4.4 Before/After
- afficher : “before timestamp” / “after timestamp”
- si contenu dynamique (stock, promos), noter en Appendix.

---

## 5) Artefacts livrés (outputs)
Pour chaque run :
1) **HTML report (SSOT)** : consultable, ancré, preuve → action  
2) **PDF** : rendu strict du HTML (Playwright)  
3) **Export tickets CSV** : format stable (section 12)  
4) **Metadata** (dans le rapport et/ou JSON) :
   - URL(s), horodatage, langue, mode, options
   - versions (pipeline + format versions)
   - ids clés si disponibles (product/snapshot/run/audit/render)
   - `evidence_completeness` et `alignment_level` (si DUO)

---

## 6) Règles PDF “agency-grade” (réalistes)
Objectif : PDF lisible et présentable, sans exiger l’impossible.

**Garanties minimales :**
- Header ou footer : titre + date + page X/Y (best effort)
- pas de texte illisible (taille minimale)
- sections et titres clairement séparés

**Best effort :**
- sommaire 1 page max (sinon HTML-only)
- éviter de couper un ticket en plein milieu (préféré, pas garanti)
- répéter le titre de section si une section se poursuit

---

## 7) Structure commune du rapport (tous modes)
> Les IDs de sections doivent être **stables** (ancres) pour éviter le drift.

### 7.1 Cover (`#cover`)
- Titre : “ShopifyStrategist Report”
- Mode : SOLO / DUO AB / DUO Before-After
- URL(s)
- Date/heure (Europe/Paris)
- Langue (FR/EN)
- Versions : pipeline + format versions
- `evidence_completeness` (complete/partial/insufficient)
- (DUO) valeur affichée = **pire des sources** (`insufficient > partial > complete`) ; le détail par source est dans “Missing evidence”.
- (DUO) `alignment_level` (high/medium/low)
- (Option) White-label léger :
  - Logo
  - “Prepared for: {Client}”
  - “Prepared by: {Agency}”

### 7.2 Executive summary (`#executive-summary`)
**Max 6 lignes** (copiable dans un email) :
- frein principal (1 phrase)
- opportunité principale (1 phrase)
- top 3 actions (bullets)
- quick wins 48h (1–3 bullets)
- effort global (S/M/L)
- next step (ex : sprint 72h)

### 7.3 Top actions (`#top-actions`)
- 10–14 tickets (cible)
- uniquement preuves A/B et `confidence` ≠ low
- inclut un sous-ensemble “Quick wins 48h” (3–5 tickets)

**Règle de diversité (anti-rapport monocorde)**
Dans Top actions :
- au moins 1 ticket `offer_clarity`
- au moins 1 ticket `ux`
- au moins 1 ticket `performance` OU `media` (selon détections)
- au moins 1 ticket `trust` **si applicable** (i.e. signal trust “missing/weak” détecté)
- max 4 tickets d’une même `category`

### 7.4 Evidence pack (`#evidence-pack`)
- preuves regroupées par type : screenshots / measurements / detections
- chaque preuve affiche : source (A/B/before/after), viewport, timestamp, `evidence_id`, level A/B/C
- inclut “What we detected” (faits) séparé des interprétations
- inclut un tableau “Missing evidence” si `evidence_completeness != complete` (raison codifiée + impact).

### 7.5 Appendix (`#appendix`)
- scorecard (option)
- tickets “Best effort” (preuve C ou confidence low)
- erreurs rencontrées + contournements (raisons codifiées)
- limites & hypothèses

---

## 8) Format Ticket (TICKET_SCHEMA_VERSION: 2)

### 8.1 Champs (format stable)
Chaque ticket contient :

- `ticket_id`
- `mode` : `solo` | `duo_ab` | `duo_before_after`
- `title`
- `impact` : `high` | `medium` | `low`
- `effort` : `small` | `medium` | `large`
- `risk` : `low` | `medium` | `high`
- `confidence` : `high` | `medium` | `low`
- `category` : `offer_clarity` | `trust` | `media` | `ux` | `performance` | `seo_basics` | `accessibility` | `comparison`
- `why`
- `evidence_refs` : liste `evidence_id` (≥ 1)
- `how_to` : 3–7 étapes (bullets) — **exécutable**
- `validation` : checks observables (bullets)
- `quick_win` : `true/false`
- `owner_hint` : `design` | `dev` | `content` | `ops`
- `notes` : optionnel

### 8.2 Règles “confidence”
- preuve A ⇒ `confidence=high`
- preuve B ⇒ `confidence=medium`
- preuve C ⇒ `confidence=low` (Appendix uniquement)

### 8.3 Tri stable (priorisation) + garde-fous
Mapping :
- impact: high=3, medium=2, low=1  
- effort: small=1, medium=2, large=3  
- risk: low=1, medium=2, high=3  
- confidence: high=3, medium=2, low=1  

**PriorityScore = impact*3 + confidence*2 - effort*2 - risk*1**

Tri :
1) PriorityScore décroissant
2) impact décroissant
3) confidence décroissant
4) effort croissant
5) risk croissant
6) ticket_id

**Garde-fous Top actions :**
- exclure `confidence=low`
- max 2 tickets `effort=large` (sauf changement structurants en before/after)
- viser 3–5 quick wins (effort small + confidence high/medium)

---

## 9) Format Evidence (EVIDENCE_SCHEMA_VERSION: 2)

### 9.1 Champs (format stable)
- `evidence_id`
- `level` : `A` | `B` | `C`
- `type` : `screenshot` | `measurement` | `detection`
- `label`
- `source` : `page_a` | `page_b` | `before` | `after`
- `viewport` : `mobile` | `desktop` | `na`
- `timestamp`
- `ref` : **ancre HTML stable** `#evidence-<evidence_id>` (règle dure). Tout storage/path/json pointer va dans `details`.
- `details` : libre (metric, value, method, threshold)

### 9.1.1 Compat exports — wrappers / anchors (règles dures)
Pour garantir la navigabilité et l’anti-drift avec l’API :
- chaque ticket exporté DOIT avoir un wrapper HTML : `id="ticket-<ticket_id>"`
- chaque evidence exportée DOIT avoir un wrapper HTML : `id="evidence-<evidence_id>"`
- `Evidence.ref` DOIT pointer vers l’ancre : `#evidence-<evidence_id>`

### 9.2 Measurements : règles
- “Web Vitals” = **Lab metrics** par défaut.
- Toujours afficher : méthode + contexte + limitation.
- Si indisponible : fallback `detection` (ex : “images > 300KB détectées”).

---

## 10) Variantes par mode

## 10A) SOLO — Instant Teardown
Le rapport reste centré sur Executive summary + Top actions + Evidence pack.
Rubriques internes de génération :
- offer_clarity, trust, media, ux, performance, seo_basics, accessibility.

## 10B) DUO — AB Battlecard
Sections spécifiques :
- `#battlecard-summary` : gaps (3–10) + copy in 72h + do-not-copy + `alignment_level`
- `#gap-tickets` : tickets comparaison (preuves alignées si possible)

## 10C) DUO — Before/After Diff
Sections spécifiques :
- `#diff-summary` : what changed + expected impact (prudent) + risks + `alignment_level`
- `#change-tickets` : tickets par changement majeur

---

## 11) Copy-ready (option IA) — format concret (anti-blabla)

### 11.1 Scope copy-ready (limité par design)
Pour éviter l’expansion infinie :
- Copy-ready s’applique uniquement aux **Top 5 tickets** (par défaut).
- Par ticket, maximum : **headline + 3 bullets + 1 CTA**.

### 11.2 Format de sortie (stable)
Chaque proposition est liée à un ticket :
- `ticket_id`
- `placement` : ex “above CTA”, “under price”, “FAQ block”
- `constraints` : ex “headline ≤ 60 chars”, “bullets ≤ 90 chars”
- `safe_version` : prudente (toujours autorisée)
- `assertive_version` : seulement si preuves suffisantes, sinon `null`
- `rationale` : 1 phrase liée au problème détecté
- `placeholders_required` : liste des placeholders à remplir si info business manquante

### 11.3 Interdits
- inventer chiffres, délais, garanties, labels
- sur-vendre sans preuve

---

## 12) Export CSV (tickets) — CSV_EXPORT_VERSION: 1
Colonnes (format stable) :
- `ticket_id`
- `mode`
- `title`
- `impact`
- `effort`
- `risk`
- `confidence`
- `category`
- `why`
- `evidence_refs` (séparateur `|`)
- `how_to` (séparateur `|`)
- `validation` (séparateur `|`)
- `quick_win`
- `owner_hint`
- `url_context`

---

## 13) Labels FR/EN
- Structure identique
- Seuls labels/textes changent
- Les enums d’export restent stables (high/medium/low etc.), l’affichage peut être traduit.

---

## 14) Critères “rapport envoyable”
Un rapport est “envoyable” si :
- executive summary clair et court
- top actions 10–14 tickets, preuves A/B, confidence ≠ low
- quick wins 3–5 tickets
- evidence pack lisible (viewport + source + timestamp + ids)
- “Missing evidence” explicite si incomplet + raisons codifiées
- erreurs/limites en Appendix
- PDF lisible (structure claire, pas de texte minuscule)

---

## 15) Checklist anti-drift (release gate)
- sections/ids conformes à ce doc
- versions (outline/ticket/evidence/csv) affichées
- CSV stable
- SOLO + DUO AB + DUO Before/After passent smoke tests
- PDF fidèle au HTML SSOT (Playwright)
