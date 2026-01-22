# ShopifyStrategist — SCORING_AND_DETECTION.md (SSOT) — v2.2
**Statut :** SSOT  
**Owner :** Nicolas  
**But :** Définir un système **opérationnel** de détection (signals) + mapping signal → ticket(s) + preuves (evidence) + priorisation, sans drift, conforme à :
- `docs/SPEC.md`
- `docs/REPORT_OUTLINE.md` (V3.1)

---

## 0) Versions & anti-drift
- `REPORT_OUTLINE_VERSION`: `3.1`
- `TICKET_SCHEMA_VERSION`: `2`
- `EVIDENCE_SCHEMA_VERSION`: `2`
- `CSV_EXPORT_VERSION`: `1`

**Règles**
- Aucun nouveau champ export (ticket/evidence/csv) ne doit être inventé ici.
- Tout changement de : seuils, signaux, mapping, merge/dedup, formats d’IDs ⇒ bump `SCORING_VERSION`.
- Outputs déterministes : mêmes entrées + mêmes versions ⇒ mêmes tickets (IDs inclus) et même tri.

---

## 1) Contrats fondamentaux
### 1.1 SSOT
- HTML report = source de vérité
- PDF = rendu Playwright strict du HTML

### 1.2 Evidence-based (anti-hallucination)
- Chaque ticket référence **≥ 1 evidence**.
- Interdit d’affirmer des faits business non détectés (délais, garanties, retours, labels, certifications, “avis vérifiés”…).
- Si l’info business n’est pas détectable :
  - utiliser un placeholder : `[INSÉRER ...]`, ou
  - une formulation conditionnelle : “Si vous proposez X, affichez-le ici”.

### 1.3 Lab metrics uniquement
Toutes métriques perf = lab (toujours méthode + contexte + limitation). Si indisponible : fallback `detection`.

---

## 2) Protocole screenshots & gating (aligné REPORT_OUTLINE)
### 2.1 Viewports standard (obligatoires)
- **Mobile** : 390×844
- **Desktop** : 1440×900

### 2.2 Screenshots cibles (best effort)
- `above_fold_mobile`
- `above_fold_desktop`
- `cta_area_mobile` (si zone CTA distincte)
- `media_section` (si détectée)
- `trust_section` (si détectée)
- `details_section`
- `full_page_mobile` (si possible)
- `full_page_desktop` (si possible)

### 2.3 Minimum garanti (gating)
Le rapport doit produire au moins l’un des ensembles :
- **Set A (préféré)** : `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
- **Set B (fallback)** : `above_fold_mobile` + `cta_area_mobile` + `details_section`

**Décision (SSOT) :**
- si **Set A** est atteint ⇒ `evidence_completeness = complete`
- si **Set B** est atteint (et Set A non atteint) ⇒ `evidence_completeness = partial`
- si **aucun set** n’est atteint ⇒ `evidence_completeness = insufficient`

**Conséquences si `insufficient` :**
- badge “Evidence incomplete” en cover
- déplacer les tickets dépendants des screenshots en Appendix (ou baisser `confidence`)

**DUO (AB / Before-After) — règle conservatrice :**
- calculer `evidence_completeness` **par source**
- cover = **pire des sources** (`insufficient > partial > complete`)


### 2.4 Raisons d’échec standard (pour logs + Appendix)
- `blocked_by_cookie_consent`
- `blocked_by_popup`
- `infinite_scroll_or_lazyload`
- `navigation_intercepted`
- `timeout`
- `unknown_render_issue`

---

## 3) Formats (rappel) — tickets & evidence
### 3.1 Ticket (TICKET_SCHEMA_VERSION=2)
Champs (format stable) :
- `ticket_id`
- `mode` : `solo` | `duo_ab` | `duo_before_after`
- `title`
- `impact` : `high|medium|low`
- `effort` : `small|medium|large`
- `risk` : `low|medium|high`
- `confidence` : `high|medium|low`
- `category` : `offer_clarity|trust|media|ux|performance|seo_basics|accessibility|comparison`
- `why`
- `evidence_refs[]` (≥1)
- `how_to[]` (3–7)
- `validation[]`
- `quick_win` : `true|false`
- `owner_hint` : `design|dev|content|ops`
- `notes` (optionnel)

### 3.2 Evidence (EVIDENCE_SCHEMA_VERSION=2)
- `evidence_id`
- `level` : `A|B|C`
- `type` : `screenshot|measurement|detection`
- `label`
- `source` : `page_a|page_b|before|after`
- `viewport` : `mobile|desktop|na`
- `timestamp`
- `ref` : **ancre HTML stable** `#evidence-<evidence_id>` (règle dure). Tout storage/path/json pointer va dans `details`.
- `details` (libre : metric/value/method/threshold/notes)

### 3.3 Confidence (règle dure)
- preuve A ⇒ `confidence=high`
- preuve B ⇒ `confidence=medium`
- preuve C ⇒ `confidence=low` (Appendix uniquement)

---

## 4) IDs déterministes (tickets + evidences) + `url_context`
### 4.1 Format `ticket_id`
`T_<mode>_<category>_<signal_id>_<scope>_<idx>`
- `<mode>` : `solo|duo_ab|duo_before_after`
- `<category>` : enum stable
- `<signal_id>` : ex `SIG_OFFER_02`
- `<scope>` :
  - SOLO : `pdp`
  - DUO AB : `page_a|page_b|gap`
  - DUO BA : `before|after|diff`
- `<idx>` : `01..99` (déterministe)

### 4.2 Indexation `<idx>` (déterministe)
- 1 occurrence ⇒ `01`
- multi-occurrences :
  - trier par clé stable (URL ressource puis DOM order)
  - **préférer bundling** en 1 ticket si même root cause
  - sinon `01`, `02`…

### 4.3 Format `evidence_id` (déterministe)
`E_<source>_<viewport>_<type>_<label>_<idx>`
- `label` = slug stable (ex `above_fold`, `buybox_detect`, `lh_perf`)
- `<idx>` = `01..99` si multiples

### 4.4 Anchors HTML (recommandation forte)
- Ticket HTML wrapper : `id="ticket-<ticket_id>"`
- Evidence HTML wrapper : `id="evidence-<evidence_id>"`

### 4.5 CSV `url_context` (CSV_EXPORT_VERSION=1)
But : indiquer **sur quelle URL agir** (pas l’URL du report).
- SOLO : `url_context = <audited_pdp_url>`
- DUO AB :
  - `scope=page_a` ⇒ `<url_a>`
  - `scope=page_b` ⇒ `<url_b>`
  - `scope=gap` ⇒ `<url_a>|<url_b>`
- DUO Before/After :
  - `before` ⇒ `<url_before>`
  - `after` ⇒ `<url_after>`
  - `diff` ⇒ `<url_before>|<url_after>`
> Note : `gap/diff` n’existe que pour `ticket_id.scope` et `csv.url_context` ; `Evidence.source` reste strictement `page_a|page_b|before|after`.


---

## 5) Priorisation vendable (tri stable) + garde-fous Top actions
### 5.1 Mapping (dures)
- impact: high=3, medium=2, low=1
- effort: small=1, medium=2, large=3
- risk: low=1, medium=2, high=3
- confidence: high=3, medium=2, low=1

**PriorityScore = impact*3 + confidence*2 - effort*2 - risk*1**

### 5.2 Tri stable
1) PriorityScore décroissant  
2) impact décroissant  
3) confidence décroissant  
4) effort croissant  
5) risk croissant  
6) ticket_id

### 5.3 Garde-fous (Top actions)
- exclure `confidence=low`
- max 2 tickets `effort=large` (sauf changements structurants en before/after)
- viser 3–5 quick wins (effort small + confidence high/medium)

### 5.4 Diversité (anti-rapport monocorde)
Dans Top actions :
- ≥ 1 `offer_clarity`
- ≥ 1 `ux`
- ≥ 1 `performance` **OU** `media`
- ≥ 1 `trust` **si applicable** (signal trust “missing/weak” détecté)
- max 4 tickets d’une même `category`

---

## 6) Strict vs Best effort (contrat)
### 6.1 Strict (garanti si page accessible)
- viewports standard
- gating Set A ou Set B
- détections DOM non ambiguës (H1, meta, buybox strict, alt manquants)
- mesures chiffrées seulement si méthode/valeur/threshold disponibles

### 6.2 Best effort (tenté, jamais promis)
- fermeture overlays cookies/popup/chat
- repérage trust/media/faq via heuristiques
- Lighthouse lab (peut échouer)
- full_page_desktop

**Règle :** best effort ⇒ Top actions uniquement si evidence B robuste (sinon Appendix).

---

## 7) “Facts vs interpretations” (anti-support)
Les détecteurs produisent des **facts** séparés des tickets :
- facts = “What we detected” (Evidence pack)
- tickets = action basée sur facts + evidence_refs
Si `evidence_completeness != complete` : générer “Missing evidence” (raison codifiée + impact).

---

## 8) Constants (SSOT defaults) — seuils officiels
(Defaults. Utilisés uniquement si mesurable. Tout changement ⇒ bump `SCORING_VERSION`.)

### 8.1 Performance / poids
- `IMG_HEAVY_KB = 300`
- `IMG_VERY_HEAVY_KB = 700`
- `LH_PERF_SCORE_BAD = 40`
- `LH_LCP_BAD_S = 4.0`
- `LH_CLS_BAD = 0.25`
- `LH_TBT_BAD_MS = 600`

### 8.2 UX heuristiques (déterministes)
- `LONG_PAGE_SCROLL_PX = 3 * viewport_height` (mobile)
- `GALLERY_MIN_IMAGES = 4`

### 8.3 Tiers (Appendix-first)
- `THIRD_PARTY_HOSTS_BAD = 16` (uniquement si mesure fiable)

---

## 9) Contrat BUYBOX (fondation)
### 9.1 Définition
BUYBOX = zone contenant :
- un form ATC (ou équivalent),
- un CTA primaire (Add to cart / Buy now / Ajouter au panier / Acheter maintenant),
- idéalement prix et variantes (si applicables).

### 9.2 Détection BUYBOX — ordre strict → fallback
1) **Strict DOM (niveau A)**  
   détecter un `form` contenant un bouton CTA (text/aria/classes Shopify usuels).  
   BUYBOX = bounding box du form.
2) **Fallback DOM (niveau B)**  
   trouver premier bouton CTA visible (ordre DOM) et remonter un conteneur parent (max 3) contenant bouton + (prix OU inputs variants).  
3) **No buybox**  
   `buybox_detected=false` ⇒ 1 ticket “Structure PDP non standard” + tout signal dépendant BUYBOX en Appendix.

### 9.3 “Near CTA” (règle dure)
Near CTA = dans BUYBOX ou à ≤ 2 niveaux parents DOM.  
Sans BUYBOX ⇒ interdiction de conclure “près du CTA”.

---

## 10) Patch 1 — Copy-ready contract (anti-drift)
Copy-ready (option IA) s’applique uniquement aux **Top 5 tickets**.
**Contrat obligatoire :** la sortie copy-ready DOIT suivre exactement le format `REPORT_OUTLINE` :
- `ticket_id`
- `placement`
- `constraints`
- `safe_version`
- `assertive_version` (sinon `null` si preuves insuffisantes)
- `rationale`
- `placeholders_required`

**Important**
- Les “hints internes” (placement_hint/constraints_hint/…) sont autorisés **uniquement en interne** (non export) et ne remplacent jamais ce format.
- Interdit : inventer chiffres/délais/garanties/labels. (Placeholders ou phrasing conditionnel.)

---

## 11) Patch 2 — Keyword lists FR/EN (SSOT minimal)
Objectif : réduire les faux positifs sur les signaux “keywords” (shipping/returns/trust/reviews).
Ces listes sont **minimales** et **versionnées** (tout changement ⇒ bump `SCORING_VERSION`).

### 11.1 SHIPPING (FR/EN)
- FR : livraison, expédition, envoi, délai, sous 24h/48h/72h, gratuit, frais de port, tracking, point relais, colissimo, chronopost
- EN : shipping, delivery, dispatch, dispatched, ETA, free shipping, returns shipping, tracking, courier, standard/express

### 11.2 RETURNS (FR/EN)
- FR : retours, retour gratuit, satisfait ou remboursé, remboursement, échange, politique de retour, retour sous 14/30 jours
- EN : returns, refund, exchange, return policy, money-back, 14/30-day returns

### 11.3 TRUST (FR/EN)
- FR : paiement sécurisé, sécurisé, garantie, authentique, SAV, support, contact, avis clients, vérifié (⚠️ ne jamais affirmer “vérifié” sans preuve explicite)
- EN : secure checkout, guarantee, warranty, support, contact, authentic, customer reviews, verified (⚠️ same rule)

### 11.4 REVIEWS (FR/EN)
- FR : avis, note, étoiles, commentaires, X avis, évaluations
- EN : reviews, rating, stars, (X) reviews, testimonials

**Règle** : si détection keywords incertaine (matches faibles / contexte ambigu) ⇒ confidence down + Appendix.

---

## 12) Patch 3 — DOM-first rules (anti-faux positifs) + evidence gating par signal
Pour les signaux “contestables” (reviews visible, shipping/returns near CTA, benefits above fold) :
1) **DOM-first** : si preuve DOM non ambiguë possible ⇒ evidence `detection` niveau A ⇒ Top actions OK.
2) Sinon **screenshot-only** : exige screenshot niveau B “visuellement évident” (sans interprétation) ⇒ Top actions possible (confidence=medium).
3) Sinon ⇒ Appendix-only (confidence=low).

### 12.1 Définition “screenshot B visuellement évident”
Un screenshot est “évident” si :
- l’élément est lisible sans zoom,
- l’absence/présence est incontestable (ex : pas un pixel-crop, pas un overlay),
- le viewport et timestamp sont présents dans l’evidence pack.

### 12.2 Min evidence level for Top actions (interne, sans nouveau champ export)
- `SIG_TRUST_01` (reviews near title/price) : min = B (A si DOM disponible)
- `SIG_OFFER_04` (shipping/returns near CTA) : min = B (A si DOM disponible)
- `SIG_OFFER_05` (benefits above fold) : min = B (A si DOM structure claire)
- `SIG_UX_01` (sticky ATC) : min = B + buybox_detected=true
- `SIG_MEDIA_02` (video absent) : min = B (Appendix si doute)
- `SIG_PERF_03` (third-party hosts) : min = B + mesure fiable (sinon Appendix)

---

## 13) Signal catalog MVP (agency-grade) — détectable → prouvable → actionnable
> Chaque signal : trigger déterministe, evidence minimale attendue, catégorie, impact/effort/risk (valeurs), et hints copy-ready (internes).

### 13.1 OFFER_CLARITY
#### SIG_OFFER_02 — Prix non détecté dans BUYBOX
- Detectability : strong (buybox strict) / medium (fallback)
- Trigger : buybox_detected=true ET aucun prix détecté dans BUYBOX
- Evidence : `detection` A/B + screenshot `cta_area_mobile` (B) si possible
- Ticket (quick_win=true) :
  - FR: Afficher le prix dans le bloc d’achat
  - EN: Show price inside the buy box
  - impact high / effort small / risk low / owner design
- Copy-ready hints (internes) :
  - placement: under price / near CTA
  - constraints: headline ≤ 60 chars; bullets ≤ 90 chars
  - placeholders: none

#### SIG_OFFER_04 — Info livraison/retours absente près du CTA
- Contestable : oui ⇒ appliquer Patch 3 (DOM-first)
- Trigger : buybox_detected=true ET aucun terme shipping/returns détecté dans BUYBOX/near-CTA
- Evidence : B “évident” (`cta_area_mobile`) + detection B (keywords) OU detection A si DOM fiable
- Ticket (quick_win=true) :
  - FR: Ajouter un bloc livraison/retours rassurant près du CTA
  - EN: Add shipping/returns reassurance near the CTA
  - impact high / effort small / risk low / owner content
- Placeholders (si info business inconnue) :
  - `[INSÉRER délai livraison]`, `[INSÉRER politique retours]`, `[INSÉRER seuil livraison gratuite]`

#### SIG_OFFER_01 — CTA primaire sous le fold (mobile)
- Trigger :
  - buybox_detected=true
  - top(BUYBOX) >= viewport_height_mobile
- Evidence : screenshot `above_fold_mobile` (B) + detection (rect) B/A
- Ticket :
  - FR: Rendre le CTA principal visible above-the-fold (mobile)
  - EN: Make primary CTA visible above the fold (mobile)
  - impact high / effort medium / risk medium / owner design

#### SIG_OFFER_03 — Variants > 1 mais sélecteur absent de BUYBOX
- Detectability : strong
- Trigger : variants_count>1 ET aucun select/radio/options détecté dans BUYBOX
- Evidence : detection A
- Ticket :
  - FR: Rendre la sélection de variantes explicite et sans ambiguïté
  - EN: Make variant selection explicit and unambiguous
  - impact high / effort medium / risk medium / owner dev

#### SIG_OFFER_05 — Bénéfices clés absents above-the-fold (mobile)
- Contestable : oui ⇒ Patch 3 (DOM-first)
- Trigger (déterministe, conservateur) :
  - sur `above_fold_mobile`, aucun bloc “benefits” détectable via (a) liste/bullets ≥3 items OU (b) pattern icône+texte répété ≥3
  - si incertain ⇒ ne pas émettre en Top actions
- Evidence : screenshot `above_fold_mobile` (B) + detection B
- Ticket (quick_win=true) :
  - FR: Remonter 3–5 bénéfices clés au-dessus du fold (mobile)
  - EN: Bring 3–5 key benefits above the fold (mobile)
  - impact high / effort small / risk low / owner content

### 13.2 TRUST
#### SIG_TRUST_01 — Avis (note + volume) non visibles près du titre/prix
- Contestable : oui ⇒ Patch 3 (DOM-first)
- Trigger : `above_fold_mobile` ne montre pas rating+count (DOM ou visuel)
- Evidence : screenshot B “évident” `above_fold_mobile` OU detection A si DOM disponible
- Ticket (quick_win=true) :
  - FR: Afficher les avis (note + volume) près du titre/prix
  - EN: Surface reviews (rating + count) near title/price
  - impact high / effort small / risk low / owner design

#### SIG_TRUST_02 — Réassurance (paiement/retours/garantie) absente sur page
- Trigger : aucun cluster trust keywords détecté sur page (liste Patch 2)
- Evidence : detection B (+ screenshot `trust_section` B si détectée)
- Ticket (quick_win=true) :
  - FR: Ajouter une section réassurance concise (paiement, retours, garantie)
  - EN: Add a concise trust section (payment, returns, warranty)
  - impact high / effort small / risk low / owner content
- Placeholders possibles :
  - `[INSÉRER garanties]`, `[INSÉRER retours]`, `[INSÉRER moyens paiement]`

#### SIG_TRUST_03 — Contact/support introuvable
- Trigger : aucun lien contact/support/help détecté (DOM + footer)
- Evidence : detection B (+ screenshot full page mobile si dispo)
- Ticket :
  - FR: Rendre l’accès au support/contact évident (footer + PDP)
  - EN: Make support/contact easy to find (footer + PDP)
  - impact medium / effort small / risk low / owner ops

### 13.3 MEDIA
#### SIG_MEDIA_01 — Galerie produit faible (< GALLERY_MIN_IMAGES)
- Règle comptage (déterministe) :
  - compter images “product media” (exclure SVG/icônes), uniques par URL, visibles dans la zone top-page
- Trigger : product_image_count < GALLERY_MIN_IMAGES
- Evidence : detection A
- Ticket :
  - FR: Enrichir la galerie (angles, détails, usage, zoom)
  - EN: Improve the gallery (angles, close-ups, in-use, zoom)
  - impact high / effort medium / risk low / owner content

#### SIG_MEDIA_02 — Vidéo produit absente (best effort)
- Contestable : modéré ⇒ Patch 3 light (B robuste sinon Appendix)
- Trigger : aucun `<video>`/iframe provider détecté
- Evidence : detection B (+ screenshot `media_section` B si détectée)
- Ticket :
  - FR: Ajouter une courte vidéo de démonstration (10–30s)
  - EN: Add a short product demo video (10–30s)
  - impact medium / effort medium / risk low / owner content

### 13.4 UX
#### SIG_UX_01 — Sticky ATC mobile absent sur page longue
- Prérequis Top actions : buybox_detected=true
- Trigger :
  - page_longue si scroll_height_mobile > LONG_PAGE_SCROLL_PX
  - screenshot mobile à Y=0 et à Y=2*viewport_height
  - si CTA visible à Y=0 mais aucun CTA sticky visible à Y=2*viewport_height ⇒ signal
- Evidence : 2 screenshots B (top + scrolled) + detection B
- Ticket :
  - FR: Ajouter un sticky Add-to-Cart mobile (si pertinent)
  - EN: Add a sticky mobile Add-to-Cart (if appropriate)
  - impact high / effort medium / risk medium / owner dev

#### SIG_UX_02 — FAQ objections absente
- Trigger : aucun bloc FAQ/accordion détecté
- Evidence : detection B (+ screenshot `details_section` B)
- Ticket (quick_win=true) :
  - FR: Ajouter une FAQ orientée objections (livraison, retours, usage, taille)
  - EN: Add an objection-handling FAQ (shipping, returns, usage, sizing)
  - impact medium / effort small / risk low / owner content

### 13.5 PERFORMANCE
#### SIG_PERF_01 — Images lourdes (≥ IMG_HEAVY_KB)
- Trigger : ≥1 image >= IMG_HEAVY_KB (Top actions si ≥2 ou si >= IMG_VERY_HEAVY_KB)
- Evidence : measurement A (preferred) ou detection B (fallback)
- Ticket (souvent quick_win=true) :
  - FR: Optimiser les images (formats, compression, dimensions, lazy-load)
  - EN: Optimize images (formats, compression, dimensions, lazy-load)
  - impact high / effort small|medium / risk low / owner dev

#### SIG_PERF_02 — Lighthouse perf lab “bad” (si dispo)
- Trigger : perf_score < LH_PERF_SCORE_BAD OU LCP/CLS/TBT au-dessus seuils
- Evidence : measurement A/B (méthode + valeurs + thresholds)
- Ticket :
  - FR: Corriger performance lab (priorité images/scripts/layout)
  - EN: Fix lab performance (prioritize images/scripts/layout)
  - impact high / effort medium / risk medium / owner dev

#### SIG_PERF_03 — Scripts tiers excessifs (Appendix-first)
- Trigger : third_party_hosts > THIRD_PARTY_HOSTS_BAD (si mesure fiable)
- Evidence : measurement/detection B (fiable) sinon Appendix
- Ticket : Top actions seulement si preuves B robustes + impact clair

### 13.6 SEO_BASICS
#### SIG_SEO_01 — H1 manquant ou multiple
- Trigger : H1 count != 1
- Evidence : detection A
- Ticket (quick_win=true) :
  - FR: Corriger la structure H1 de la PDP
  - EN: Fix PDP H1 structure
  - impact medium / effort small / risk low / owner dev

#### SIG_SEO_02 — Meta title/description absents
- Trigger : title ou meta description manquants
- Evidence : detection A
- Ticket (quick_win=true) :
  - FR: Ajouter/optimiser meta title & description (sans promesses)
  - EN: Add/optimize meta title & description (no claims)
  - impact medium / effort small / risk low / owner content

### 13.7 ACCESSIBILITY
#### SIG_A11Y_01 — Alt manquants sur images produit
- Trigger : ≥1 image sans alt (ou alt vide)
- Evidence : detection A
- Ticket (quick_win=true) :
  - FR: Renseigner des textes alternatifs pertinents
  - EN: Add meaningful alt text
  - impact low|medium / effort small / risk low / owner content

---

## 14) DUO (AB & Before/After) — règles + signaux comparison
### 14.1 Alignment level low (cap comparatif)
Si `alignment_level=low` :
- cap 6–8 tickets comparatifs max
- privilégier tickets “single-side”
- `confidence` max = medium sauf preuve comparative A
- note standard visible (REPORT_OUTLINE)

### 14.2 AB gaps (3–10 max)
- mêmes viewports
- timestamps visibles
- preuves comparatives si possible ; sinon preuves séparées et confidence ajustée

#### SIG_DUO_01 — Gap reviews (B a rating+count, A non)
- Evidence : screenshots B (page_a + page_b)
- Ticket category `comparison`, scope `gap`, impact high, effort small

#### SIG_DUO_02 — Gap shipping/returns near CTA (B oui, A non)
- Evidence : screenshots B zone CTA (page_a + page_b)
- Ticket category `comparison`, scope `gap`, impact high, effort small, placeholders si info business inconnue

### 14.3 Before/After (diff)
- afficher “before timestamp” / “after timestamp”
- si contenu dynamique : noter en Appendix

#### SIG_DUO_03 — Régression perf lab (si measures)
- Evidence : measurements A/B before+after (lab)
- Ticket category `comparison`, scope `diff`, impact high, effort medium

---

## 15) Bundling / anti-bruit (règles)
- Fusionner signaux même root cause (perf images + LH faible → 1 ticket perf + evidences multiples).
- Top actions cible : 10–14 tickets. Si moins de tickets éligibles A/B, ne pas “inventer”.
- Appendix : autoriser best-effort (preuves C ou confidence low).

---

## 16) FR/EN (labels & terminologie)
- Structure identique FR/EN (sections/IDs/enums export)
- Seuls labels/textes changent
- Enums export restent stables (high/medium/low etc.)

---

## 17) DoD (Definition of Done) de ce document
- Contrats : viewports + sets A/B + reasons codifiées
- IDs déterministes : ticket_id + evidence_id + url_context
- Priorisation + diversité + garde-fous Top actions
- Buybox contract strict→fallback
- Copy-ready contract (format exact) + placeholders rules
- Keyword lists SSOT minimales (versionnées)
- DOM-first rules sur signaux contestables + evidence gating
- Signal catalog MVP : détectable, prouvable, actionnable, agency-grade
