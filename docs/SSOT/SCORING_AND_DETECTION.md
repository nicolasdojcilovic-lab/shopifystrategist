# ShopifyStrategist — SCORING_AND_DETECTION.md (SSOT) — v2.3
## Owned Concepts (Canonical)
- TBD

## Not Owned (References)
- TBD

**Status:** SSOT  
**Owner:** Nicolas  
**Purpose:** Define an **operational** detection system (signals) + mapping signal → ticket(s) + evidence + prioritization, without drift, compliant with:
- `docs/SPEC.md`
- `docs/REPORT_OUTLINE.md` (V3.1)

---

## 0) Versions & anti-drift
- `REPORT_OUTLINE_VERSION`: `3.1`
- `TICKET_SCHEMA_VERSION`: `2`
- `EVIDENCE_SCHEMA_VERSION`: `2`
- `CSV_EXPORT_VERSION`: `1`

**Rules**
- No new export field (ticket/evidence/csv) MUST be invented here.
- Any change to: thresholds, signals, mapping, merge/dedup, ID formats ⇒ bump `SCORING_VERSION`.
- Deterministic outputs: same inputs + same versions ⇒ same tickets (including IDs) and same sorting.

---

## 1) Fundamental contracts
### 1.1 SSOT
- HTML report = source of truth
- PDF = strict Playwright rendering of the HTML

### 1.2 Evidence-based (anti-hallucination)
- Each ticket references **≥ 1 evidence**.
- MUST NOT assert business facts that were not detected (delivery times, warranties, returns, labels, certifications, “verified reviews”…).
- If business info is not detectable:
  - use a placeholder: `[INSERT ...]`, or
  - a conditional phrasing: “If you offer X, display it here”.

### 1.3 Lab metrics only
All performance metrics = lab (always method + context + limitation). If unavailable: fallback `detection`.

---

## 2) Screenshot protocol & gating (aligned with REPORT_OUTLINE)
### 2.1 Standard viewports (MUST)
- **Mobile**: 390×844
- **Desktop**: 1440×900

### 2.2 Target screenshots (best effort)
- `above_fold_mobile`
- `above_fold_desktop`
- `cta_area_mobile` (if CTA area is distinct)
- `media_section` (if detected)
- `trust_section` (if detected)
- `details_section`
- `full_page_mobile` (if possible)
- `full_page_desktop` (if possible)

### 2.3 Minimum guaranteed (gating)
The report MUST produce at least one of these sets:
- **Set A (preferred)**: `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
- **Set B (fallback)**: `above_fold_mobile` + `cta_area_mobile` + `details_section`

**Decision (SSOT):**
- if **Set A** is achieved ⇒ `evidence_completeness = complete`
- if **Set B** is achieved (and Set A not achieved) ⇒ `evidence_completeness = partial`
- if **no set** is achieved ⇒ `evidence_completeness = insufficient`

**Consequences if `insufficient`:**
- “Evidence incomplete” badge on cover
- move tickets depending on screenshots to Appendix (or lower `confidence`)

**DUO (AB / Before-After) — conservative rule:**
- compute `evidence_completeness` **per source**
- cover = **worst of sources** (`insufficient > partial > complete`)

### 2.4 Standard failure reasons (for logs + Appendix)
- `blocked_by_cookie_consent`
- `blocked_by_popup`
- `infinite_scroll_or_lazyload`
- `navigation_intercepted`
- `timeout`
- `unknown_render_issue`

---

## 3) Formats (reminder) — tickets & evidence
### 3.1 Ticket (TICKET_SCHEMA_VERSION=2)
Fields (stable format):
- `ticket_id`
- `rule_id`
- `subject_key`
- `root_cause_key`
- `source_side`: `solo|a|b|before|after`
- `mode`: `solo` | `duo_ab` | `duo_before_after`
- `title`
- `impact`: `high|medium|low`
- `effort`: `s|m|l`
- `risk`: `low|medium|high`
- `confidence`: `high|medium|low`
- `affected_criteria_ids[]` (≥1)
- `why`
- `evidence_refs[]` (≥1)
- `how_to[]` (3–7)
- `validation[]`
- `quick_win`: `true|false`
- `owner`: `cro|copy|design|dev|merch|data`
- `notes` (optional)

### 3.2 Evidence (EVIDENCE_SCHEMA_VERSION=2)
- `evidence_id`
- `level`: `A|B|C`
- `type`: `dom_fact|selector_fact|screenshot|screenshot_crop|html_fragment|network_fact|config_fact|lab_metric|console_fact`
- `label`
- `source`: `solo|a|b|before|after`
- `viewport`: `mobile|desktop|na`
- `timestamp`
- `ref`: **stable HTML anchor** `#evidence-<evidence_id>` (hard rule). Any storage/path/json pointer goes in `details`.
- `details` (free-form: metric/value/method/threshold/notes)

### 3.3 Confidence (hard rule)
- evidence A ⇒ `confidence=high`
- evidence B ⇒ `confidence=medium`
- evidence C ⇒ `confidence=low` (Appendix only)

---

## 4) Deterministic IDs (tickets + evidences) + `url_context`
### 4.1 `ticket_id` format
`T.<rule_id>.<subject_key>.<source_side>.<idx>`
- `<idx>`: `01..99` (deterministic) [CHECK]

### 4.2 `<idx>` indexing (deterministic)
- 1 occurrence ⇒ `01`
- multi-occurrences:
  - sort by stable key (resource URL then DOM order)
  - **prefer bundling** into 1 ticket if same root cause
  - otherwise `01`, `02`…

### 4.3 `evidence_id` format (deterministic)
`E_<source>_<viewport>_<type>_<label>_<idx>`
- `label` = stable slug (e.g. `above_fold`, `buybox_detect`, `lh_perf`)
- `<idx>` = `01..99` if multiple

### 4.4 HTML anchors (strong recommendation)
- Ticket HTML wrapper: `id="ticket-<ticket_id>"`
- Evidence HTML wrapper: `id="evidence-<evidence_id>"`

### 4.5 CSV `url_context` (CSV_EXPORT_VERSION=1)
Purpose: indicate **which URL to act on** (not the report URL).
- SOLO: `url_context = <audited_pdp_url>`
- DUO AB:
  - `scope=page_a` ⇒ `<url_a>`
  - `scope=page_b` ⇒ `<url_b>`
  - `scope=gap` ⇒ `<url_a>|<url_b>`
- DUO Before/After:
  - `before` ⇒ `<url_before>`
  - `after` ⇒ `<url_after>`
  - `diff` ⇒ `<url_before>|<url_after>`
> Note: `gap/diff` only exists for `ticket_id.scope` and `csv.url_context`; `Evidence.source` remains strictly `page_a|page_b|before|after`. [CHECK]

---

## 5) Sellable prioritization (stable sorting) + Top actions guardrails
### 5.1 Mapping (hard)
- impact: high=3, medium=2, low=1
- effort: s=1, m=2, l=3
- risk: low=1, medium=2, high=3
- confidence: high=3, medium=2, low=1

**PriorityScore = impact*3 + confidence*2 - effort*2 - risk*1**

### 5.2 Stable sorting
1) PriorityScore descending  
2) impact descending  
3) confidence descending  
4) effort ascending  
5) risk ascending  
6) ticket_id

### 5.3 Guardrails (Top actions)
- exclude `confidence=low`
- max 2 tickets `effort=l` (except structural changes in before/after)
- target 3–5 quick wins (effort `s` + confidence high/medium)

### 5.4 Diversity (anti-monotone report)
In Top actions:
- ≥ 1 `offer_clarity`
- ≥ 1 `ux`
- ≥ 1 `performance` **OR** `media`
- ≥ 1 `trust` **if applicable** (trust “missing/weak” signal detected)
- max 4 tickets of the same `category` [CHECK]

---

## 6) Strict vs Best effort (contract)
### 6.1 Strict (guaranteed if page accessible)
- standard viewports
- gating Set A or Set B
- unambiguous DOM detections (H1, meta, strict buybox, missing alts)
- numeric measures only if method/value/threshold available

### 6.2 Best effort (attempted, never promised)
- closing cookie/popup/chat overlays
- locating trust/media/faq via heuristics
- Lighthouse lab (may fail)
- full_page_desktop

**Rule:** best effort ⇒ Top actions only if robust evidence B (otherwise Appendix).

---

## 7) “Facts vs interpretations” (anti-support)
Detectors produce **facts** separated from tickets:
- facts = “What we detected” (Evidence pack)
- tickets = action based on facts + evidence_refs
If `evidence_completeness != complete`: generate “Missing evidence” (coded reason + impact).

---

## 8) Constants (SSOT defaults) — official thresholds
(Defaults. Used only if measurable. Any change ⇒ bump `SCORING_VERSION`.)

### 8.1 Performance / weight
- `IMG_HEAVY_KB = 300`
- `IMG_VERY_HEAVY_KB = 700`
- `LH_PERF_SCORE_BAD = 40`
- `LH_LCP_BAD_S = 4.0`
- `LH_CLS_BAD = 0.25`
- `LH_TBT_BAD_MS = 600`

### 8.2 UX heuristics (deterministic)
- `LONG_PAGE_SCROLL_PX = 3 * viewport_height` (mobile)
- `GALLERY_MIN_IMAGES = 4`

### 8.3 Tiers (Appendix-first)
- `THIRD_PARTY_HOSTS_BAD = 16` (only if reliable measurement)

---

## 9) BUYBOX contract (foundation)
### 9.1 Definition
BUYBOX = area containing:
- an ATC form (or equivalent),
- a primary CTA (Add to cart / Buy now / Ajouter au panier / Acheter maintenant),
- ideally price and variants (if applicable).

### 9.2 BUYBOX detection — strict order → fallback
1) **Strict DOM (level A)**  
   detect a `form` containing a CTA button (Shopify-typical text/aria/classes).  
   BUYBOX = bounding box of the form.
2) **Fallback DOM (level B)**  
   find first visible CTA button (DOM order) and walk up a parent container (max 3) containing button + (price OR variant inputs).  
3) **No buybox**  
   `buybox_detected=false` ⇒ 1 ticket “Non-standard PDP structure” + any BUYBOX-dependent signal in Appendix.

### 9.3 “Near CTA” (hard rule)
Near CTA = inside BUYBOX or within ≤ 2 DOM parent levels.  
Without BUYBOX ⇒ forbidden to conclude “near the CTA”.

---

## 10) Patch 1 — Copy-ready contract (anti-drift)
Copy-ready (optional AI) applies only to the **Top 5 tickets**.
**Required contract:** the copy-ready output MUST follow exactly the `REPORT_OUTLINE` format:
- `ticket_id`
- `placement`
- `constraints`
- `safe_version`
- `assertive_version` (otherwise `null` if evidence insufficient)
- `rationale`
- `placeholders_required`

**Important**
- “Internal hints” (placement_hint/constraints_hint/…) are allowed **internal-only** (not exported) and never replace this format.
- Forbidden: invent numbers/timelines/warranties/labels. (Placeholders or conditional phrasing.)

---

## 11) Patch 2 — Keyword lists FR/EN (SSOT minimal) [CHECK]
Goal: reduce false positives on “keywords” signals (shipping/returns/trust/reviews).
These lists are **minimal** and **versioned** (any change ⇒ bump `SCORING_VERSION`).

### 11.1 SHIPPING (FR/EN)
- FR: livraison, expédition, envoi, délai, sous 24h/48h/72h, gratuit, frais de port, tracking, point relais, colissimo, chronopost
- EN: shipping, delivery, dispatch, dispatched, ETA, free shipping, returns shipping, tracking, courier, standard/express

### 11.2 RETURNS (FR/EN)
- FR: retours, retour gratuit, satisfait ou remboursé, remboursement, échange, politique de retour, retour sous 14/30 jours
- EN: returns, refund, exchange, return policy, money-back, 14/30-day returns

### 11.3 TRUST (FR/EN)
- FR: paiement sécurisé, sécurisé, garantie, authentique, SAV, support, contact, avis clients, vérifié (⚠️ ne jamais affirmer “vérifié” sans preuve explicite)
- EN: secure checkout, guarantee, warranty, support, contact, authentic, customer reviews, verified (⚠️ same rule)

### 11.4 REVIEWS (FR/EN)
- FR: avis, note, étoiles, commentaires, X avis, évaluations
- EN: reviews, rating, stars, (X) reviews, testimonials

**Rule:** if keyword detection is uncertain (weak matches / ambiguous context) ⇒ confidence down + Appendix.

---

## 12) Patch 3 — DOM-first rules (anti-false-positives) + per-signal evidence gating
For “debatable” signals (reviews visible, shipping/returns near CTA, benefits above fold):
1) **DOM-first**: if an unambiguous DOM proof is possible ⇒ evidence `dom_fact|selector_fact` level A ⇒ Top actions OK.
2) Otherwise **screenshot-only**: require level B “visually obvious” screenshot (no interpretation) ⇒ Top actions possible (confidence=medium).
3) Otherwise ⇒ Appendix-only (confidence=low).

### 12.1 Definition “level B visually obvious screenshot”
A screenshot is “obvious” if:
- the element is readable without zoom,
- presence/absence is indisputable (e.g., not a pixel-crop, not an overlay),
- viewport and timestamp are present in the evidence pack.

### 12.2 Min evidence level for Top actions (internal, no new export field)
- `SIG_TRUST_01` (reviews near title/price): min = B (A if DOM available)
- `SIG_OFFER_04` (shipping/returns near CTA): min = B (A if DOM available)
- `SIG_OFFER_05` (benefits above fold): min = B (A if DOM structure clear)
- `SIG_UX_01` (sticky ATC): min = B + buybox_detected=true
- `SIG_MEDIA_02` (video absent): min = B (Appendix if doubt)
- `SIG_PERF_03` (third-party hosts): min = B + reliable measurement (otherwise Appendix)

---

## 13) Signal catalog MVP (agency-grade) — detectable → provable → actionable
> Each signal: deterministic trigger, expected minimal evidence, category, impact/effort/risk (values), and copy-ready hints (internal).

### 13.1 OFFER_CLARITY
#### SIG_OFFER_02 — Price not detected in BUYBOX
- rule_id: `R.PDP.PRICE.MISSING_OR_AMBIGUOUS` [CHECK]
- Detectability: strong (strict buybox) / medium (fallback)
- Trigger: buybox_detected=true AND no price detected in BUYBOX
- Evidence: `dom_fact|selector_fact` A/B + screenshot `cta_area_mobile` (B) if possible
- Ticket (quick_win=true):
  - FR: Display the price inside the buy box
  - EN: Display the price inside the buy box
  - impact high / effort s / risk low / owner merch
- Copy-ready hints (internal):
  - placement: under price / near CTA
  - constraints: headline ≤ 60 chars; bullets ≤ 90 chars
  - placeholders: none

#### SIG_OFFER_04 — Shipping/returns info absent near the CTA
- rule_id: `R.PDP.SHIPPING.MISSING_POLICY_AT_PDP` [CHECK]
- Contestable: yes ⇒ apply Patch 3 (DOM-first)
- Trigger: buybox_detected=true AND no shipping/returns terms detected in BUYBOX/near-CTA
- Evidence: B “obvious” (`cta_area_mobile`) + `dom_fact|selector_fact` B (keywords) OR `dom_fact|selector_fact` A if DOM reliable
- Ticket (quick_win=true):
  - FR: Add shipping/returns reassurance near the CTA
  - EN: Add shipping/returns reassurance near the CTA
  - impact high / effort s / risk low / owner cro
- Placeholders (if business info unknown):
  - `[INSERT delivery ETA]`, `[INSERT returns policy]`, `[INSERT free shipping threshold]`

#### SIG_OFFER_01 — Primary CTA below the fold (mobile)
- rule_id: `R.PDP.CTA.MISSING_ATF` [CHECK]
- Trigger:
  - buybox_detected=true
  - top(BUYBOX) >= viewport_height_mobile
- Evidence: screenshot `above_fold_mobile` (B) + `dom_fact|selector_fact` (rect) B/A
- Ticket:
  - FR: Make the primary CTA visible above the fold (mobile)
  - EN: Make the primary CTA visible above the fold (mobile)
  - impact high / effort m / risk medium / owner design

#### SIG_OFFER_03 — Variants > 1 but selector absent from BUYBOX
- rule_id: `R.PDP.VARIANTS.CONFUSING_PICKER` [CHECK]
- Detectability: strong
- Trigger: variants_count>1 AND no select/radio/options detected in BUYBOX
- Evidence: `dom_fact|selector_fact` A
- Ticket:
  - FR: Make variant selection explicit and unambiguous
  - EN: Make variant selection explicit and unambiguous
  - impact high / effort m / risk medium / owner dev

#### SIG_OFFER_05 — Key benefits absent above the fold (mobile)
- rule_id: `R.PDP.BENEFITS.MISSING_SCANNABLE_LIST` [CHECK]
- Contestable: yes ⇒ Patch 3 (DOM-first)
- Trigger (deterministic, conservative):
  - on `above_fold_mobile`, no “benefits” block detectable via (a) list/bullets ≥3 items OR (b) repeated icon+text pattern ≥3
  - if uncertain ⇒ do not emit in Top actions
- Evidence: screenshot `above_fold_mobile` (B) + `dom_fact|selector_fact` B
- Ticket (quick_win=true):
  - FR: Bring 3–5 key benefits above the fold (mobile)
  - EN: Bring 3–5 key benefits above the fold (mobile)
  - impact high / effort s / risk low / owner copy

### 13.2 TRUST
#### SIG_TRUST_01 — Reviews (rating + count) not visible near title/price
- rule_id: `R.PDP.REVIEWS.MISSING_OR_HIDDEN` [CHECK]
- Contestable: yes ⇒ Patch 3 (DOM-first)
- Trigger: `above_fold_mobile` does not show rating+count (DOM or visual)
- Evidence: B “obvious” screenshot `above_fold_mobile` OR `dom_fact|selector_fact` A if DOM available
- Ticket (quick_win=true):
  - FR: Surface reviews (rating + count) near title/price
  - EN: Surface reviews (rating + count) near title/price
  - impact high / effort s / risk low / owner cro

#### SIG_TRUST_02 — Reassurance (payment/returns/warranty) absent on page
- rule_id: `R.PDP.TRUST.MISSING_SIGNALS` [CHECK]
- Trigger: no trust keyword cluster detected on page (list Patch 2)
- Evidence: `dom_fact|selector_fact` B (+ screenshot `trust_section` B if detected)
- Ticket (quick_win=true):
  - FR: Add a concise trust section (payment, returns, warranty)
  - EN: Add a concise trust section (payment, returns, warranty)
  - impact high / effort s / risk low / owner copy
- Possible placeholders:
  - `[INSERT warranty]`, `[INSERT returns]`, `[INSERT payment methods]`

#### SIG_TRUST_03 — Contact/support hard to find
- rule_id: `R.PDP.TRUST.MISSING_SIGNALS` [CHECK]
- Trigger: no contact/support/help link detected (DOM + footer)
- Evidence: `dom_fact|selector_fact` B (+ screenshot full page mobile if available)
- Ticket:
  - FR: Make support/contact easy to find (footer + PDP)
  - EN: Make support/contact easy to find (footer + PDP)
  - impact medium / effort s / risk low / owner cro

### 13.3 MEDIA
#### SIG_MEDIA_01 — Weak product gallery (< GALLERY_MIN_IMAGES)
- rule_id: `R.PDP.GALLERY.INSUFFICIENT_IMAGES` [CHECK]
- Counting rule (deterministic):
  - count “product media” images (exclude SVG/icons), unique by URL, visible in the top-page zone
- Trigger: product_image_count < GALLERY_MIN_IMAGES
- Evidence: `dom_fact|selector_fact` A
- Ticket:
  - FR: Improve the gallery (angles, close-ups, in-use, zoom)
  - EN: Improve the gallery (angles, close-ups, in-use, zoom)
  - impact high / effort m / risk low / owner merch

#### SIG_MEDIA_02 — Product video absent (best effort)
- rule_id: `R.PDP.MEDIA.VIDEO.MISSING` [CHECK]
- Contestable: moderate ⇒ Patch 3 light (robust B otherwise Appendix)
- Trigger: no `<video>`/iframe provider detected
- Evidence: `dom_fact|selector_fact` B (+ screenshot `media_section` B if detected)
- Ticket:
  - FR: Add a short product demo video (10–30s)
  - EN: Add a short product demo video (10–30s)
  - impact medium / effort m / risk low / owner merch

### 13.4 UX
#### SIG_UX_01 — Sticky mobile ATC absent on long page
- rule_id: `R.PDP.STICKY_ATC.MISSING_MOBILE` [CHECK]
- Top actions prerequisite: buybox_detected=true
- Trigger:
  - long_page if scroll_height_mobile > LONG_PAGE_SCROLL_PX
  - mobile screenshot at Y=0 and at Y=2*viewport_height
  - if CTA visible at Y=0 but no sticky CTA visible at Y=2*viewport_height ⇒ signal
- Evidence: 2 screenshots B (top + scrolled) + `dom_fact|selector_fact` B
- Ticket:
  - FR: Add a sticky mobile Add-to-Cart (if appropriate)
  - EN: Add a sticky mobile Add-to-Cart (if appropriate)
  - impact high / effort m / risk medium / owner dev

#### SIG_UX_02 — Objection-handling FAQ absent
- rule_id: `R.PDP.FAQ.MISSING_OBJECTIONS` [CHECK]
- Trigger: no FAQ/accordion block detected
- Evidence: `dom_fact|selector_fact` B (+ screenshot `details_section` B)
- Ticket (quick_win=true):
  - FR: Add an objection-handling FAQ (shipping, returns, usage, sizing)
  - EN: Add an objection-handling FAQ (shipping, returns, usage, sizing)
  - impact medium / effort s / risk low / owner copy

### 13.5 PERFORMANCE
#### SIG_PERF_01 — Heavy images (≥ IMG_HEAVY_KB)
- rule_id: `R.TECH.PERF_LAB.POOR_BUCKET` [CHECK]
- Trigger: ≥1 image >= IMG_HEAVY_KB (Top actions if ≥2 or if >= IMG_VERY_HEAVY_KB)
- Evidence: `lab_metric` A (preferred) or `dom_fact|selector_fact` B (fallback)
- Ticket (often quick_win=true):
  - FR: Optimize images (formats, compression, dimensions, lazy-load)
  - EN: Optimize images (formats, compression, dimensions, lazy-load)
  - impact high / effort s|m / risk low / owner dev

#### SIG_PERF_02 — Lighthouse lab perf “bad” (if available)
- rule_id: `R.TECH.PERF_LAB.POOR_BUCKET` [CHECK]
- Trigger: perf_score < LH_PERF_SCORE_BAD OR LCP/CLS/TBT above thresholds
- Evidence: `lab_metric` A/B (method + values + thresholds)
- Ticket:
  - FR: Fix lab performance (prioritize images/scripts/layout)
  - EN: Fix lab performance (prioritize images/scripts/layout)
  - impact high / effort m / risk medium / owner dev

#### SIG_PERF_03 — Excessive third-party scripts (Appendix-first)
- rule_id: `R.TECH.PERF_LAB.POOR_BUCKET` [CHECK]
- Trigger: third_party_hosts > THIRD_PARTY_HOSTS_BAD (if reliable measurement)
- Evidence: `network_fact|lab_metric` B (reliable) otherwise Appendix
- Ticket: Top actions only if robust B evidence + clear impact

### 13.6 SEO_BASICS
#### SIG_SEO_01 — H1 missing or multiple
- rule_id: `R.SEO.META.MISSING_TITLE_OR_DESC` [CHECK]
- Trigger: H1 count != 1
- Evidence: `dom_fact|selector_fact` A
- Ticket (quick_win=true):
  - FR: Fix PDP H1 structure
  - EN: Fix PDP H1 structure
  - impact medium / effort s / risk low / owner dev

#### SIG_SEO_02 — Meta title/description missing
- rule_id: `R.SEO.META.MISSING_TITLE_OR_DESC`
- Trigger: title or meta description missing
- Evidence: `dom_fact|selector_fact` A
- Ticket (quick_win=true):
  - FR: Add/optimize meta title & description (no claims)
  - EN: Add/optimize meta title & description (no claims)
  - impact medium / effort s / risk low / owner copy

### 13.7 ACCESSIBILITY
#### SIG_A11Y_01 — Missing alts on product images
- rule_id: `R.A11Y.IMG.ALT.MISSING` [CHECK]
- Trigger: ≥1 image without alt (or empty alt)
- Evidence: `dom_fact|selector_fact` A
- Ticket (quick_win=true):
  - FR: Add meaningful alt text
  - EN: Add meaningful alt text
  - impact low|medium / effort s / risk low / owner copy

---

## 14) DUO (AB & Before/After) — rules + comparison signals
### 14.1 Low alignment level (comparison cap) [CHECK]
If `alignment_level=low`:
- `comparability_status` MUST be `partial` (winner forbidden)
- cap 6–8 comparative tickets max
- prefer “single-side” tickets
- `confidence` max = medium unless comparative evidence A
- standard visible note (REPORT_OUTLINE)

### 14.2 AB gaps (3–10 max)
- same viewports
- visible timestamps
- comparative evidence if possible; otherwise separate evidence and adjusted confidence

#### SIG_DUO_01 — Gap reviews (B has rating+count, A does not)
- Evidence: screenshots B (page_a + page_b)
- Ticket category `comparison`, scope `gap`, impact high, effort s

#### SIG_DUO_02 — Gap shipping/returns near CTA (B yes, A no)
- Evidence: screenshots B CTA area (page_a + page_b)
- Ticket category `comparison`, scope `gap`, impact high, effort s, placeholders if business info unknown

### 14.3 Before/After (diff)
- display “before timestamp” / “after timestamp”
- if dynamic content: note in Appendix

#### SIG_DUO_03 — Lab perf regression (if measures)
- Evidence: measurements A/B before+after (lab)
- Ticket category `comparison`, scope `diff`, impact high, effort m

---

## 15) Bundling / anti-noise (rules)
- Merge signals with the same root cause (perf images + low LH → 1 perf ticket + multiple evidences).
- Top actions target: 10–14 tickets. If fewer eligible A/B tickets, do not “invent”.
- Appendix: allow best-effort (evidence C or confidence low).

---

## 16) FR/EN (labels & terminology) [CHECK]
- Identical FR/EN structure (sections/IDs/export enums)
- Only labels/text change
- Export enums remain stable (high/medium/low etc.)

---

## 17) DoD (Definition of Done) for this document
- Contracts: viewports + sets A/B + coded reasons
- Deterministic IDs: ticket_id + evidence_id + url_context
- Prioritization + diversity + Top actions guardrails
- Buybox contract strict→fallback
- Copy-ready contract (exact format) + placeholders rules
- Minimal SSOT keyword lists (versioned)
- DOM-first rules on debatable signals + evidence gating
- MVP signal catalog: detectable, provable, actionable, agency-grade
