# ShopifyStrategist — DETECTORS_SPEC.md (SSOT-aligned)

**Rôle :** Spécification SSOT de la *facts layer* (détecteurs) — **MVP**

- **DETECTORS_SPEC_VERSION :** 1.3
- **Principe :** Les détecteurs produisent **uniquement des facts**. Le mapping **facts → evidences → tickets** est défini dans `docs/SCORING_AND_DETECTION.md`.
- **Anti-drift :** ce document ne crée **aucun champ export** (Ticket/Evidence/CSV) et ne duplique pas les seuils/keywords/enums “métier” qui vivent dans `SCORING_AND_DETECTION`.

---

## 0) Invariants (non négociables)

1) **Facts-only** : pas de recommandations, pas de tickets, pas de scores, pas de copy, pas de “confidence”.
2) **Evidence-based** : tout ticket a des `evidence_refs`, mais **les détecteurs n’émettent pas** `evidence_refs` (ils peuvent fournir des `evidence_hints`).
3) **DOM-first** : quand c’est contestable, on priorise DOM (Set A). Le screenshot (Set B) est **support visuel**, pas une inférence.
4) **Mode dégradé** : un détecteur peut être `unavailable` sans bloquer l’audit.
5) **Lab-only** : pas de RUM. Perf / poids = mesures labo si disponibles.
6) **Déterminisme** : mêmes entrées + mêmes versions ⇒ mêmes sorties (tri, troncature, IDs, hashes).

---

## 1) Références SSOT (source de vérité)

- `docs/SCORING_AND_DETECTION.md` :
  - Contrat BUYBOX (strict→fallback, règle near-CTA)
  - Listes de keywords (shipping/returns)
  - Screenshot sets + règles “screenshot B visuellement évident”
  - Enums “Missing evidence reason”
  - Seuils/constantes (IMG_*, LH_*, etc.)
- `docs/REPORT_OUTLINE.md` : structure rapport + attentes de preuves (A/B, Appendix-only, etc.)

> **Règle anti-drift :** les thresholds/keywords/enums “métier” restent dans `SCORING_AND_DETECTION`. Ici : contrats d’inputs/outputs et méthodes de détection *facts-only*.

---

## 2) Concepts communs

### 2.1 Mode & sources
- `mode` : `solo` | `duo_ab` | `duo_before_after`
- `source` : `page_a` | `page_b` | `before` | `after`

**Règle :** en DUO, les détecteurs s’exécutent **par source**. Les diffs (gaps, before/after, A/B) sont calculés par le scoring.

### 2.2 Viewports (obligatoires)
- `mobile` : 390×844
- `desktop` : 1440×900

### 2.3 Artefacts standard (best effort)
- DOM snapshot : `dom`
- Screenshots :
  - `above_fold_mobile`, `above_fold_desktop`, `cta_area_mobile`
  - `media_section`, `trust_section`, `details_section`
  - `full_page_mobile`, `full_page_desktop`
- `network_log` (optionnel)
- `lighthouse` (optionnel)

---

## 3) Enveloppes communes (inputs/outputs)

### 3.1 DetectorRunRequest (conceptuel)
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

**Règles**
- `timeout_ms` : budget max *par source* pour le détecteur. Si timeout ⇒ `DET_TIMEOUT` + `missing_evidence_reason="timeout"`.
- `strictness=strict` : éviter les heuristiques fragiles (préférer `unavailable` plutôt que faux positifs).

### 3.2 DetectorRunResult (enveloppe commune)
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
- `dom_strict` : DOM-first, règles strictes
- `dom_fallback` : DOM, heuristique encadrée
- `network_measurement` : mesure via `network_log` (bytes, types, status)
- `lighthouse_provided` : Lighthouse déjà disponible (cache)
- `lighthouse_run` : Lighthouse exécuté best-effort
- `screenshot_b` : support visuel (Set B) — **facts très conservateurs**
- `unavailable`

#### `data_sources_used` (enum list)
- `dom` | `screenshots` | `network_log` | `lighthouse`

### 3.3 Error object (codifié)
```json
{
  "code": "DET_TIMEOUT",
  "stage": "dom_query",
  "message": "Timeout while querying CTA button",
  "missing_evidence_reason": "timeout"
}
```

- `stage` : `dom_query` | `screenshot` | `network` | `lighthouse` | `dependency` | `unknown`
- `missing_evidence_reason` : `null` ou **un** des 6 enums SSOT :
  - `blocked_by_cookie_consent`
  - `blocked_by_popup`
  - `infinite_scroll_or_lazyload`
  - `navigation_intercepted`
  - `timeout`
  - `unknown_render_issue`

### 3.4 Types réutilisables (facts)

#### Rect
```json
{"x":12,"y":650,"w":366,"h":52}
```
- int px, coordonnées viewport.

#### NodeRef (déterministe)
```json
{
  "dom_path": "html>body>main>form[0]>button[1]",
  "css_like": "main form[action*='/cart/add'] button[type=submit]",
  "text_snippet": "Ajouter au panier",
  "node_id": "sha1:..."
}
```
- `dom_path` est la référence principale.
- `node_id` = hash déterministe de `dom_path` (ex: sha1).
- `css_like` est debug-only.

#### Money (facts conservateurs)
```json
{"currency":"EUR","amount":49.9,"raw_text":"49,90 €"}
```
- Si ambigu (range/multiples), `amount=null` et garder `raw_text`.

#### Match (keyword)
```json
{"kw":"livraison","scope":"near_cta","node_ref":{...},"dom_order":214,"text_snippet":"Livraison 48h"}
```

### 3.5 EvidenceHints (interne, non export)
Les détecteurs peuvent suggérer des preuves à attacher par l’EvidenceBuilder (sans changer le schéma Evidence) :
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
**Interdit :** générer des `evidence_refs` ou de nouveaux champs export.

---

## 4) Déterminisme (règles dures)

1) Toute liste renvoyée doit être **stable-sorted** (clés de tri définies par détecteur).
2) Toute troncature doit être **déterministe** : trier puis prendre les N premiers.
3) Zéro aléatoire, zéro sampling, pas de `now()`.
4) Rectangles arrondis à l’entier.
5) Hashes déterministes : `sha1(dom_path)` (ou équivalent stable).

---

# 5) Détecteurs MVP (obligatoires)

> Chaque détecteur précise : **entrées**, **dépendances**, **facts**, **méthode strict→fallback**, **erreurs**, **déterminisme**, **evidence_hints**.

---

## 5.1 buybox_detector

**ID :** `buybox_detector`

### Entrées
- DOM : requis
- Viewports : mobile + desktop requis
- Screenshots : `cta_area_mobile` best effort (Set B)

### Dépendances
- Aucune (fondation)

### Facts (exemple)
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

### Méthode (strict→fallback)
- `dom_strict` (niveau A) : détecter un `form` contenant un bouton CTA (text/aria/classes Shopify usuels). BUYBOX = bounding box du form.
- `dom_fallback` (niveau B) : trouver le premier bouton CTA visible (ordre DOM) et remonter un parent (max 3) contenant bouton + (prix OU inputs variants).
- Sinon : `buybox_detected=false`, `buybox_detection_level="none"`.

### EvidenceHints (recommandé)
- `recommended_screenshots=["cta_area_mobile"]`
- `focus_rect_by_viewport.mobile` centré sur BUYBOX/CTA (si rect disponible)

### Erreurs
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`
- `DET_OK_BUT_INCONCLUSIVE` → `missing_evidence_reason=null`

### Déterminisme
- Multiples candidats : tri `dom_order asc`, puis `rect_area desc`, pick first.

---

## 5.2 price_detector

**ID :** `price_detector`

### Entrées
- DOM : requis
- buybox facts : requis

### Dépendances
- `buybox_detector`

### Facts (exemple)
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

**Règles**
- Si `buybox_detected=false` ⇒ `method="unavailable"`, `price_found=false`, `location="unknown"` (interdit de conclure “near CTA”).
- Si parsing ambigu : `amount=null` et garder `raw_text`.

### Méthode
- `dom_strict` : scanner **dans BUYBOX** (patterns Shopify `.price`, `[data-product-price]`, `money`, microdata offers).
- `dom_fallback` : scanner scope **near-CTA** (BUYBOX ou ≤2 parents du CTA) si BUYBOX existe.

### EvidenceHints
- si `price_found=false` et BUYBOX OK : `recommended_screenshots=["cta_area_mobile"]` + focus rect BUYBOX

### Erreurs
- `DET_DEPENDENCY_MISSING` → `unknown_render_issue`
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- `candidates` tri `dom_distance_to_cta asc`, puis `dom_order asc`, N=10.

---

## 5.3 variants_detector

**ID :** `variants_detector`

### Entrées
- DOM : requis
- buybox facts : recommandé

### Dépendances
- `buybox_detector` (soft)

### Facts (exemple)
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

### Méthode
- `dom_strict` : dans BUYBOX, détecter `select[name*="options"]`, radios/swatches, input Shopify `name="id"`.
- `dom_fallback` : near-CTA puis page-level.

### EvidenceHints
- `recommended_screenshots=["cta_area_mobile"]` si `has_variants=true` mais `selectors_found_in_buybox=false`

### Erreurs
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- `option_names` = ordre DOM d’apparition ; sample tri `dom_order asc`, N=10.

---

## 5.4 shipping_returns_detector

**ID :** `shipping_returns_detector`

### Entrées
- DOM : requis
- buybox facts : requis
- `locale_hint` : recommandé
- Screenshot `cta_area_mobile` : best effort

### Dépendances
- `buybox_detector`

### Facts (exemple)
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

### Méthode
- `dom_strict` : matcher keywords SSOT **uniquement** dans scope near-CTA (règle SSOT).
- `dom_fallback` : si near-CTA vide, compter page-level (facts only).
- `screenshot_b` : si DOM indispo mais screenshot dispo ⇒ facts conservateurs (matches vides + hint screenshot dispo).

### EvidenceHints
- `recommended_screenshots=["cta_area_mobile"]` en priorité

### Erreurs
- `DET_DEPENDENCY_MISSING` → `unknown_render_issue`
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- matches tri `dom_order asc`, puis `kw asc`, N=20.

---

## 5.5 reviews_detector

**ID :** `reviews_detector`

### Entrées
- DOM : recommandé
- Screenshot `above_fold_mobile` : best effort

### Dépendances
- aucune

### Facts (exemple)
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

**Règle conservatrice :** si rating/count pas explicitement parsable ⇒ valeurs `null` (ne pas “deviner”).

### Méthode
- `dom_strict` : schema.org `aggregateRating` + providers connus + aria-label patterns.
- `dom_fallback` : heuristiques keyword + structure, mais si incertain ⇒ `null`.
- `screenshot_b` : si DOM fail mais screenshot dispo ⇒ fournir `widget_in_above_fold_mobile` seulement si rect issue DOM est disponible ; sinon seulement hint screenshot dispo.

### EvidenceHints
- `recommended_screenshots=["above_fold_mobile"]`

### Erreurs
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- `provider_hint` via mapping regex fixe.

---

## 5.6 media_gallery_detector

**ID :** `media_gallery_detector`

### Entrées
- DOM : requis

### Dépendances
- aucune

### Facts (exemple)
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

### Méthode
- `dom_strict` : identifier conteneurs galerie et compter `<img>` pertinentes (exclure SVG/icons) + dédup URL normalisée.
- `dom_fallback` : top-page visible images avec garde-fous.

### EvidenceHints
- `recommended_screenshots=["media_section"]`

### Erreurs
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- URLs normalisées, tri `url asc`, N=40.

---

## 5.7 images_weight_detector

**ID :** `images_weight_detector`

### Entrées
- `network_log` : recommandé
- DOM : optionnel (mapping URLs “produit”)

### Dépendances
- aucune

### Facts (exemple)
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

### Méthode
- `network_measurement` : si `network_log` permet bytes fiables.
- `dom_fallback` : si pas de bytes, retourner URLs (sample) + `measurement_available=false`.
- Sinon `unavailable`.

**Interdit :** classifier heavy/very heavy ici (seuils en scoring).

### EvidenceHints
- `recommended_screenshots=["full_page_mobile"]` (si besoin visuel)

### Erreurs
- `DET_NETWORK_LOG_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- samples tri `url asc`, N=20.

---

## 5.8 lighthouse_lab_detector

**ID :** `lighthouse_lab_detector`

### Entrées
- `lighthouse` artefact : fourni ou runnable best effort

### Dépendances
- aucune

### Facts (exemple)
```json
{
  "available": true,
  "config": {"preset":"mobile","throttling":"default"},
  "metrics": {"perf_score": 38, "lcp_s": 4.8, "cls": 0.29, "tbt_ms": 720},
  "lighthouse_version": "unknown"
}
```

### Méthode
- `lighthouse_provided` : artefact déjà présent / cache
- `lighthouse_run` : exécution LH best effort
- Sinon `unavailable`

**Interdit :** thresholds dans ce doc (SSOT scoring).

### EvidenceHints
- `recommended_screenshots=["above_fold_mobile"]` (corrélation visuelle LCP)

### Erreurs
- `DET_LIGHTHOUSE_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

---

## 5.9 h1_meta_detector

**ID :** `h1_meta_detector`

### Entrées
- DOM : requis

### Dépendances
- aucune

### Facts (exemple)
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

### Méthode
- `dom_strict`

### EvidenceHints
- none

### Erreurs
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- texts trim + collapse whitespace, truncate 120 chars.

---

## 5.10 alt_detector

**ID :** `alt_detector`

### Entrées
- DOM : requis
- `media_gallery_detector` : optionnel (restreindre aux images produit)

### Dépendances
- `media_gallery_detector` (soft)

### Facts (exemple)
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

### Méthode
- `dom_strict` : si galerie dispo, checker alt sur `unique_image_urls`.
- `dom_fallback` : sinon checker `<img>` visibles top-page (exclure icons/SVG).

### EvidenceHints
- `recommended_screenshots=["media_section"]`

### Erreurs
- `DET_DOM_UNAVAILABLE` → `unknown_render_issue`
- `DET_TIMEOUT` → `timeout`

### Déterminisme
- sample tri `url asc`, puis `dom_order asc`, N=20.

---

## 6) DoD (Definition of Done) — detectors layer

- Chaque détecteur MVP a : entrées, dépendances, facts (exemple JSON), strict→fallback, erreurs codifiées, tri/troncature.
- `missing_evidence_reason` utilise **uniquement** les 6 enums SSOT (ou null).
- BUYBOX contract respecté : **aucune conclusion near-CTA** si `buybox_detected=false`.
- Aucune duplication thresholds/keywords/enums métier : reste dans `SCORING_AND_DETECTION`.
- DUO : run per source, no diffs.
- `evidence_hints` présents quand utiles (screenshots à attacher, focus rect), sans toucher aux schémas export.

