# ShopifyStrategist — DETECTORS_SPEC.md (SSOT-aligned)

## Owned Concepts (Canonical)
- TBD

## Not Owned (References)
- TBD

**Role:** SSOT specification of the *facts layer* (detectors) — **MVP**

- **DETECTORS_SPEC_VERSION :** 1.3
- **Principle :** Detectors produce **facts only**. The mapping **facts → evidences → tickets** is defined in `docs/SCORING_AND_DETECTION.md`.
- **Anti-drift :** this document creates **no export field** (Ticket/Evidence/CSV) and does not duplicate business thresholds/keywords/enums that live in `SCORING_AND_DETECTION`.

---

## 0) Invariants (non-negotiable)

1) **Facts-only**: no recommendations, no tickets, no scores, no copy, no “confidence”.
2) **Evidence-based**: every ticket has `evidence_refs`, but detectors **MUST NOT** emit `evidence_refs` (they MAY provide `evidence_hints`).
3) **DOM-first**: when it is contestable, prioritize DOM (Set A). The screenshot (Set B) is **visual support**, not an inference.
4) **Degraded mode**: a detector MAY be `unavailable` without blocking the audit.
5) **Lab-only**: no RUM. Perf / weight = lab measurements if available.
6) **Determinism**: same inputs + same versions ⇒ same outputs (sorting, truncation, IDs, hashes).

---

## 1) SSOT references (source of truth)

- `docs/SCORING_AND_DETECTION.md` :
  - BUYBOX contract (strict→fallback, near-CTA rule)
  - Keyword lists (shipping/returns)
  - Screenshot sets + “screenshot B visually obvious” rules
  - “Missing evidence reason” enums
  - Thresholds/constants (IMG_*, LH_*, etc.)
- `docs/REPORT_OUTLINE.md` : report structure + evidence expectations (A/B, Appendix-only, etc.)

> **Anti-drift rule:** business thresholds/keywords/enums remain in `SCORING_AND_DETECTION`. Here: input/output contracts and *facts-only* detection methods.

---

## 2) Shared concepts

### 2.1 Mode & sources
- `mode` : `solo` | `duo_ab` | `duo_before_after`
- `source` : `page_a` | `page_b` | `before` | `after`

**Rule:** in DUO, detectors MUST run **per source**. Diffs (gaps, before/after, A/B) are computed by scoring.

### 2.2 Viewports (required)
- `mobile` : 390×844
- `desktop` : 1440×900

### 2.3 Standard artefacts (best effort)
- DOM snapshot : `dom`
- Screenshots :
  - `above_fold_mobile`, `above_fold_desktop`, `cta_area_mobile`
  - `media_section`, `trust_section`, `details_section`
  - `full_page_mobile`, `full_page_desktop`
- `network_log` (optional)
- `lighthouse` (optional)

---

## 3) Shared envelopes (inputs/outputs)

### 3.1 DetectorRunRequest (conceptual)
```json
{
  "mode": "solo",
  "sources": ["page_a"],
  "strictness": "strict",
  "timeout_ms": 8000,
  "locale_hint": "fr",
  "inputs": {
    "page_a": {
      "url": "https://example.com/products/abc",
      "timestamp_iso": "2026-01-15T21:00:00+01:00",
      "artefacts": {
        "dom_available": true,
        "screenshots_available": ["above_fold_mobile","cta_area_mobile"],
        "network_log_available": false,
        "lighthouse_available": false
      }
    }
  }
}
```

**Rules**
- `timeout_ms`: max budget *per source* for the detector. If timeout ⇒ `DET_TIMEOUT` + `missing_evidence_reason="timeout"`.
- `strictness=strict`: avoid fragile heuristics (prefer `unavailable` rather than false positives).

### 3.2 DetectorRunResult (shared envelope)
```json
{
  "detector_id": "buybox_detector",
  "detector_version": "1.3.0",
  "mode": "solo",
  "results": {
    "page_a": {
      "available": true,
      "method": "dom_strict",
      "data_sources_used": ["dom","screenshots"],
      "facts": {},
      "evidence_hints": {},
      "errors": []
    }
  }
}
```

#### `method` (enum)
- `dom_strict` : DOM-first, strict rules
- `dom_fallback` : DOM, bounded heuristics
- `network_measurement` : measurement via `network_log` (bytes, types, status)
- `lighthouse_provided` : Lighthouse already available (cache)
- `lighthouse_run` : Lighthouse executed best-effort
- `screenshot_b` : visual support (Set B) — **very conservative facts**
- `unavailable`

#### `data_sources_used` (enum list)
- `dom` | `screenshots` | `network_log` | `lighthouse`

### 3.3 Error object (codified)
```json
{
  "code": "DET_TIMEOUT",
  "stage": "dom_query",
  "message": "Timeout while querying CTA button",
  "missing_evidence_reason": "timeout"
}
```

- `stage` : `dom_query` | `screenshot` | `network` | `lighthouse` | `dependency` | `unknown`
- `missing_evidence_reason` : `null` or **one** of the 6 SSOT enums:
  - `blocked_by_cookie_consent`
  - `blocked_by_popup`
  - `infinite_scroll_or_lazyload`
  - `navigation_intercepted`
  - `timeout`
  - `unknown_render_issue`

### 3.4 Reusable types (facts)

#### Rect
```json
{"x":12,"y":650,"w":366,"h":52}
```
- int px, viewport coordinates.

#### NodeRef (deterministic)
```json
{
  "dom_path": "html>body>main>form[0]>button[1]",
  "css_like": "main form[action*='/cart/add'] button[type=submit]",
  "text_snippet": "Ajouter au panier",
  "node_id": "sha1:..."
}
```
- `dom_path` is the primary reference.
- `node_id` = deterministic hash of `dom_path` (e.g., sha1).
- `css_like` is debug-only.

#### Money (conservative facts)
```json
{"currency":"EUR","amount":49.9,"raw_text":"49,90 €"}
```
- If ambiguous (range/multiple), `amount=null` and keep `raw_text`.

#### Match (keyword)
```json
{"kw":"livraison","scope":"near_cta","node_ref":{...},"dom_order":214,"text_snippet":"Livraison 48h"}
```

### 3.5 EvidenceHints (internal, non-export)
Detectors MAY suggest evidences to attach via the EvidenceBuilder (without changing the Evidence schema):
```json
{
  "recommended_screenshots": ["cta_area_mobile"],
  "focus_rect_by_viewport": {
    "mobile": {"x":12,"y":600,"w":366,"h":200},
    "desktop": null
  },
  "focus_node_refs": [{"dom_path":"...","node_id":"sha1:..."}]
}
```
**Forbidden:** generate `evidence_refs` or new export fields.

---

## 4) Determinism (hard rules)

1) Any returned list MUST be **stable-sorted** (sort keys defined per detector).
2) Any truncation MUST be **deterministic**: sort then take the first N.
3) No randomness, no sampling, no `now()`.
4) Rectangles rounded to integer.
5) Deterministic hashes: `sha1(dom_path)` (or equivalent stable).

---

# 5) MVP detectors (required)

> Each detector specifies: **inputs**, **dependencies**, **facts**, **strict→fallback method**, **errors**, **determinism**, **evidence_hints**.

---

## 5.1 buybox_detector

**ID :** `buybox_detector`

### Inputs
- DOM: required
- Viewports: mobile + desktop required
- Screenshots: `cta_area_mobile` best effort (Set B)

### Dependencies
- None (foundation)

### Facts (example)
```json
{
  "buybox_detected": true,
  "buybox_detection_level": "A",
  "buybox": {
    "node_ref": {"dom_path":"html>body>main>form[0]","css_like":"form[action*='/cart/add']","text_snippet":"","node_id":"sha1:..."},
    "rect_by_viewport": {
      "mobile": {"x":12,"y":420,"w":366,"h":310},
      "desktop": {"x":820,"y":210,"w":520,"h":420}
    }
  },
  "primary_cta": {
    "node_ref": {"dom_path":"html>body>main>form[0]>button[1]","css_like":"form button[type=submit]","text_snippet":"Ajouter au panier","node_id":"sha1:..."},
    "aria_label": "Ajouter au panier",
    "rect_by_viewport": {
      "mobile": {"x":12,"y":650,"w":366,"h":52},
      "desktop": {"x":820,"y":520,"w":520,"h":56}
    },
    "visible_by_viewport": {"mobile": true, "desktop": true}
  },
  "near_cta_rule": {
    "definition": "in_buybox_or_within_2_parent_levels",
    "max_parent_levels": 2,
    "requires_buybox": true
  }
}
```

### Method (strict→fallback)
- `dom_strict` (level A): detect a `form` containing a CTA button (Shopify-usual text/aria/classes). BUYBOX = bounding box of the form.
- `dom_fallback` (level B): find the first visible CTA button (DOM order) and climb to a parent (max 3) containing button + (price OR variant inputs).
- Else: `buybox_detected=false`, `buybox_detection_level="none"`.

### EvidenceHints (recommended)
- `recommended_screenshots=["cta_area_mobile"]`
- `focus_rect_by_viewport.mobile` centered on BUYBOX/CTA (if rect available)

### Errors
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`
- `DET_OK_BUT_INCONCLUSIVE` → `missing_evidence_reason=null`

### Determinism
- Multiple candidates: sort `dom_order asc`, then `rect_area desc`, pick first.

---

## 5.2 price_detector

**ID :** `price_detector`

### Inputs
- DOM: required
- buybox facts: required

### Dependencies
- `buybox_detector`

### Facts (example)
```json
{
  "buybox_detected": true,
  "price_found": true,
  "location": "in_buybox",
  "price": {
    "currency":"EUR",
    "amount":49.9,
    "raw_text":"49,90 €",
    "node_ref":{"dom_path":"...","css_like":"...","text_snippet":"49,90 €","node_id":"sha1:..."}
  },
  "compare_at": {"found": false, "amount": null, "raw_text": null, "node_ref": null},
  "candidates": [
    {"raw_text":"49,90 €","amount":49.9,"currency":"EUR","dom_order":120,"node_ref":{"dom_path":"...","node_id":"sha1:..."}}
  ]
}
```

**Rules**
- If `buybox_detected=false` ⇒ `method="unavailable"`, `price_found=false`, `location="unknown"` (**MUST NOT** conclude “near CTA”).
- If parsing is ambiguous: `amount=null` and keep `raw_text`.

### Method
- `dom_strict`: scan **inside BUYBOX** (Shopify patterns `.price`, `[data-product-price]`, `money`, microdata offers).
- `dom_fallback`: scan scope **near-CTA** (BUYBOX or ≤2 parents of the CTA) if BUYBOX exists.

### EvidenceHints
- if `price_found=false` and BUYBOX OK: `recommended_screenshots=["cta_area_mobile"]` + focus rect BUYBOX

### Errors
- `DET_DEPENDENCY_MISSING` → `unknown_render_issue`
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- `candidates` sort `dom_distance_to_cta asc`, then `dom_order asc`, N=10.

---

## 5.3 variants_detector

**ID :** `variants_detector`

### Inputs
- DOM: required
- buybox facts: recommended

### Dependencies
- `buybox_detector` (soft)

### Facts (example)
```json
{
  "has_variants": true,
  "variant_id_input_found": true,
  "selectors_found_in_buybox": true,
  "selector_types": ["select","radio","swatch","buttons"],
  "option_names": ["Taille","Couleur"],
  "variants_count_estimate": 6,
  "selector_nodes_sample": [
    {"dom_path":"...","css_like":"...","text_snippet":"Taille","node_id":"sha1:...","dom_order":210}
  ]
}
```

### Method
- `dom_strict`: in BUYBOX, detect `select[name*="options"]`, radios/swatches, Shopify input `name="id"`.
- `dom_fallback`: near-CTA then page-level.

### EvidenceHints
- `recommended_screenshots=["cta_area_mobile"]` if `has_variants=true` but `selectors_found_in_buybox=false`

### Errors
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- `option_names` = DOM appearance order; sample sort `dom_order asc`, N=10.

---

## 5.4 shipping_returns_detector

**ID :** `shipping_returns_detector`

### Inputs
- DOM: required
- buybox facts: required
- `locale_hint`: recommended
- Screenshot `cta_area_mobile`: best effort

### Dependencies
- `buybox_detector`

### Facts (example)
```json
{
  "buybox_detected": true,
  "near_cta": {
    "shipping_matches": [{"kw":"livraison","scope":"near_cta","dom_order":214,"text_snippet":"Livraison 48h","node_ref":{"dom_path":"...","node_id":"sha1:..."}}],
    "returns_matches": [{"kw":"retours","scope":"near_cta","dom_order":260,"text_snippet":"Retours sous 30 jours","node_ref":{"dom_path":"...","node_id":"sha1:..."}}],
    "distance_rule": "in_buybox_or_within_2_parent_levels"
  },
  "page_level": {
    "shipping_keywords_count": 4,
    "returns_keywords_count": 2
  }
}
```

### Method
- `dom_strict`: match SSOT keywords **only** in near-CTA scope (SSOT rule).
- `dom_fallback`: if near-CTA is empty, count page-level (facts only).
- `screenshot_b`: if DOM unavailable but screenshot available ⇒ conservative facts (empty matches + hint screenshot available).

### EvidenceHints
- `recommended_screenshots=["cta_area_mobile"]` as priority

### Errors
- `DET_DEPENDENCY_MISSING` → `unknown_render_issue`
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- matches sort `dom_order asc`, then `kw asc`, N=20.

---

## 5.5 reviews_detector

**ID :** `reviews_detector`

### Inputs
- DOM: recommended
- Screenshot `above_fold_mobile`: best effort

### Dependencies
- none

### Facts (example)
```json
{
  "widget_found": true,
  "provider_hint": "judge_me",
  "aggregate_rating": {"rating_value": 4.7, "rating_scale": 5, "reviews_count": 312},
  "widget_node_ref": {"dom_path":"...","node_id":"sha1:..."},
  "widget_rect_mobile": {"x":12,"y":260,"w":240,"h":42},
  "widget_in_above_fold_mobile": true
}
```

**Conservative rule:** if rating/count are not explicitly parsable ⇒ values `null` (do not “guess”).

### Method
- `dom_strict`: schema.org `aggregateRating` + known providers + aria-label patterns.
- `dom_fallback`: keyword + structure heuristics, but if uncertain ⇒ `null`.
- `screenshot_b`: if DOM fails but screenshot available ⇒ provide `widget_in_above_fold_mobile` only if rect from DOM is available; otherwise only hint screenshot available.

### EvidenceHints
- `recommended_screenshots=["above_fold_mobile"]`

### Errors
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- `provider_hint` via fixed regex mapping.

---

## 5.6 media_gallery_detector

**ID :** `media_gallery_detector`

### Inputs
- DOM: required

### Dependencies
- none

### Facts (example)
```json
{
  "product_image_count": 7,
  "unique_image_urls": [
    "https://cdn.../img1.jpg",
    "https://cdn.../img2.jpg"
  ],
  "video_present": true,
  "video_providers": ["youtube","native_video"]
}
```

### Method
- `dom_strict`: identify gallery containers and count relevant `<img>` (exclude SVG/icons) + dedupe normalized URL.
- `dom_fallback`: top-page visible images with guardrails.

### EvidenceHints
- `recommended_screenshots=["media_section"]`

### Errors
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- URLs normalized, sort `url asc`, N=40.

---

## 5.7 images_weight_detector

**ID :** `images_weight_detector`

### Inputs
- `network_log`: recommended
- DOM: optional (URLs-to-“product” mapping)

### Dependencies
- none

### Facts (example)
```json
{
  "measurement_available": true,
  "total_images_count": 24,
  "measured_images_count": 18,
  "measured_images": [
    {"url":"https://cdn.../hero.jpg","bytes":812345,"content_type":"image/jpeg","status":200}
  ],
  "unmeasured_images_sample": [
    {"url":"https://cdn.../x.jpg","reason":"missing_content_length"}
  ]
}
```

### Method
- `network_measurement`: if `network_log` provides reliable bytes.
- `dom_fallback`: if no bytes, return URLs (sample) + `measurement_available=false`.
- Else `unavailable`.

**Forbidden:** classify heavy/very heavy here (thresholds live in scoring).

### EvidenceHints
- `recommended_screenshots=["full_page_mobile"]` (if visual is needed)

### Errors
- `DET_NETWORK_LOG_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- samples sort `url asc`, N=20.

---

## 5.8 lighthouse_lab_detector

**ID :** `lighthouse_lab_detector`

### Inputs
- `lighthouse` artefact: provided or runnable best effort

### Dependencies
- none

### Facts (example)
```json
{
  "available": true,
  "config": {"preset":"mobile","throttling":"default"},
  "metrics": {"perf_score": 38, "lcp_s": 4.8, "cls": 0.29, "tbt_ms": 720},
  "lighthouse_version": "unknown"
}
```

### Method
- `lighthouse_provided`: artefact already present / cache
- `lighthouse_run`: run LH best effort
- Else `unavailable`

**Forbidden:** define thresholds in this doc (SSOT scoring).

### EvidenceHints
- `recommended_screenshots=["above_fold_mobile"]` (visual correlation with LCP)

### Errors
- `DET_LIGHTHOUSE_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

---

## 5.9 h1_meta_detector

**ID :** `h1_meta_detector`

### Inputs
- DOM: required

### Dependencies
- none

### Facts (example)
```json
{
  "h1": {"count": 1, "texts": ["T-shirt oversize"]},
  "meta": {
    "title_present": true,
    "title_text": "T-shirt oversize | Marque",
    "meta_description_present": true,
    "meta_description_text": "Découvrez..."
  }
}
```

### Method
- `dom_strict`

### EvidenceHints
- none

### Errors
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- texts trim + collapse whitespace, truncate 120 chars.

---

## 5.10 alt_detector

**ID :** `alt_detector`

### Inputs
- DOM: required
- `media_gallery_detector`: optional (restrict to product images)

### Dependencies
- `media_gallery_detector` (soft)

### Facts (example)
```json
{
  "checked_count": 12,
  "missing_alt_count": 3,
  "empty_alt_count": 2,
  "missing_alt_sample": [
    {"url":"https://cdn.../img3.jpg","dom_order":330,"node_ref":{"dom_path":"...","css_like":"...","text_snippet":"","node_id":"sha1:..."}}
  ]
}
```

### Method
- `dom_strict`: if gallery available, check alt on `unique_image_urls`.
- `dom_fallback`: otherwise check top-page visible `<img>` (exclude icons/SVG).

### EvidenceHints
- `recommended_screenshots=["media_section"]`

### Errors
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Determinism
- sample sort `url asc`, then `dom_order asc`, N=20.

---

## 6) DoD (Definition of Done) — detectors layer

- Each MVP detector has: inputs, dependencies, facts (example JSON), strict→fallback, codified errors, sorting/truncation.
- `missing_evidence_reason` uses **only** the 6 SSOT enums (or null).
- BUYBOX contract respected: **no near-CTA conclusion** if `buybox_detected=false`.
- No duplication of business thresholds/keywords/enums: those remain in `SCORING_AND_DETECTION`.
- DUO: run per source, no diffs.
- `evidence_hints` present when useful (screenshots to attach, focus rect), without touching export schemas.
