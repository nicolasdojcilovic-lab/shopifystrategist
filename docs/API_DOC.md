# ShopifyStrategist — API_DOC.md (SSOT)
**API_DOC_VERSION :** 1.2  
**Statut :** SSOT (contrats API publics)  
**But :** verrouiller les contrats des endpoints d’audit (SOLO + DUO), sans drift, compatibles avec la documentation SSOT.

---

## 0) Références SSOT (source de vérité)
Ce document **ne redéfinit pas** : thresholds, keyword lists, enums métier, diversity rules, mapping signal → ticket. Il référence :
- `docs/SPEC.md`
- `docs/REPORT_OUTLINE.md` (V3.1)
- `docs/SCORING_AND_DETECTION.md` (v2.2)
- `docs/AUDIT_PIPELINE_SPEC.md` (spec v1.0)
- `docs/DETECTORS_SPEC.md` (v1.3)
- `docs/EVIDENCE_PACK_SPEC.md` (v1.2)

---

## 1) Invariants (non négociables)
1) **HTML report = SSOT** ; **PDF** strictement dérivé du HTML (Playwright).
2) **Evidence-based** : aucun ticket sans `evidence_refs[]` (>= 1).
3) **No RUM** : métriques perf/poids = lab best-effort ; jamais de “real user metrics”.
4) **Anti-drift export** : **aucun nouveau champ export** (Ticket v2 / Evidence v2 / CSV v1).
   - Toute info additionnelle doit rester **interne** ou dans `Evidence.details` (sans changer le schéma export).
5) **Reasons SSOT (6)** : `missing_evidence_reason` est `null` ou :
   - `blocked_by_cookie_consent`
   - `blocked_by_popup`
   - `infinite_scroll_or_lazyload`
   - `navigation_intercepted`
   - `timeout`
   - `unknown_render_issue`
6) **Stages macro SSOT** : `errors[].stage` ∈ `normalize|capture|detectors|scoring|report|render_pdf|storage|unknown`.
7) **Déterminisme** : mêmes entrées effectives + mêmes versions ⇒ mêmes IDs, même tri, mêmes troncatures, mêmes exports.
8) **DUO** :
   - `evidence_completeness` est calculé **par source** (`page_a/page_b/before/after`).
   - la valeur exposée (`report_meta.evidence_completeness`) est le **pire des sources** (`insufficient > partial > complete`).
   - le détail par source (Missing evidence) reste **HTML-only**.

---

## 2) Versions & anti-drift

### 2.1 Versions de format (SSOT)
Ces versions doivent apparaître dans la réponse API (`versions`) et dans la cover du HTML :
- `REPORT_OUTLINE_VERSION = 3.1`
- `TICKET_SCHEMA_VERSION = 2`
- `EVIDENCE_SCHEMA_VERSION = 2`
- `CSV_EXPORT_VERSION = 1`
- `DETECTORS_SPEC_VERSION = 1.3`

### 2.2 Versions runtime
- `NORMALIZE_VERSION`
- `SCORING_VERSION`
- `ENGINE_VERSION`
- `RENDER_VERSION`

### 2.3 Règles
- Tout changement de signaux/seuils/mapping/merge/dedup/IDs/tri ⇒ bump `SCORING_VERSION` (voir `SCORING_AND_DETECTION`).
- Tout changement de structure report ⇒ bump `REPORT_OUTLINE_VERSION`.

---

## 3) Endpoints (MVP)
- `POST /api/audit-solo`
- `POST /api/audit-duo`

Contrat de principe :
- HTTP 200 si un **HTML SSOT** a été produit (`status="ok"`).
- HTTP 4xx pour les erreurs de requête.
- HTTP 500 uniquement si aucun HTML SSOT ne peut être produit.

---

## 4) Contrats communs

### 4.1 `mode` (response)
- `solo`
- `duo_ab`
- `duo_before_after`

### 4.2 `source`
- Pour `Evidence.source` : `page_a|page_b|before|after` (SSOT)
- Pour `errors[].source` : `page_a|page_b|before|after|na` (pipeline)

> SOLO : la page auditée est portée sous `source="page_a"`.

### 4.3 Viewports (SSOT)
- Mobile : 390×844
- Desktop : 1440×900

### 4.4 `report_meta.evidence_completeness`
- `complete|partial|insufficient` (gating Set A/B, voir `SCORING_AND_DETECTION` v2.2)

### 4.5 `report_meta.alignment_level`
- DUO : `high|medium|low` (voir `REPORT_OUTLINE` V3.1)
- SOLO : `null`

### 4.6 `errors[].stage` (macro enum)
`normalize|capture|detectors|scoring|report|render_pdf|storage|unknown`

### 4.7 `missing_evidence_reason` (enum fermée)
`null` ou l’un des 6 enums SSOT (§1.5).

### 4.8 Headers d’observabilité (best-effort, non contractuels)
Le serveur **peut** ajouter des headers d’aide au debug/perf (ils ne font pas partie du contrat SSOT et peuvent être absents) :
- `X-Cache`
- `X-Cache-Run`
- `X-Cache-Render`
- `X-Audit-Timing`

Règle QA : les smoke tests ne doivent **jamais** échouer si ces headers sont manquants.
+
---

## 5) Response — enveloppes (contrat)

### 5.1 Succès : `status="ok"` (HTTP 200)
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
    "evidence_completeness": "complete",
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

Contraintes normatives :
- `exports.tickets[]` est **Ticket v2** strict (voir `SCORING_AND_DETECTION` v2.2 §3.1).
- `exports.evidences[]` est **Evidence v2** strict (voir `SCORING_AND_DETECTION` v2.2 §3.2 et `EVIDENCE_PACK_SPEC` v1.2).
- `artifacts.html_ref` DOIT être présent si `status="ok"` (HTML = SSOT).
- `artifacts.pdf_ref` et `artifacts.csv_ref` sont **best-effort** et peuvent être `null` si rendu/storage échoue ; dans ce cas, ajouter une entrée correspondante dans `errors[]` (`stage=render_pdf` ou `stage=storage`) **sans empêcher** `status="ok"` tant que `html_ref` existe.
- Si `artifacts.csv_ref` est non-null, il pointe vers un CSV **CSV_EXPORT_VERSION=1** strict (aucune colonne ajoutée).
- Si `artifacts.pdf_ref` est non-null, il pointe vers un PDF rendu via Playwright à partir du HTML SSOT (même `audit_key`).

### 5.2 Erreur request-level : `status="error"` (HTTP 4xx)
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: url"
  }
}
```

### 5.3 Erreur fatale run-level : `status="error"` (HTTP 500)
Uniquement si aucun HTML SSOT ne peut être produit.
```json
{
  "status": "error",
  "error": {
    "code": "AUDIT_FAILED",
    "message": "Audit failed before SSOT HTML could be produced."
  }
}
```

---

## 6) POST `/api/audit-solo`

### 6.1 Request (URL)
```json
{
  "locale": "fr",
  "url": "https://example.com/products/abc",
  "options": {
    "copy_ready": false
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

### 6.2 Request (Replay via `snapshot_key`)
```json
{
  "locale": "en",
  "snapshot_key": "snap_...",
  "options": {
    "copy_ready": false
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

Règles :
- `locale` (MVP) : `fr|en`, sinon `400 UNSUPPORTED_LOCALE`.
- Exactement un des champs : `url` **ou** `snapshot_key`.
- Si `snapshot_key` est fourni, `locale` doit correspondre au snapshot (sinon `400 INVALID_REQUEST`).
- `options.copy_ready` est optionnel (défaut `false`).
- `timeouts_ms` est optionnel (défaut : valeurs serveur) ; si présent, toutes les valeurs sont des entiers (ms) ≥ 0.
- `options.copy_ready=true` :
  - s’applique uniquement aux **Top 5 tickets** dans le HTML (voir `AUDIT_PIPELINE_SPEC` §11),
  - **ne change pas** tickets/evidences/tri/IDs/CSV.
  - peut changer `audit_key` / `render_key` (car le HTML/PDF changent),
  - ne change pas `run_key`.

### 6.3 Response (succès “complete”)
Exemple minimal (1 ticket + 1 evidence).

```json
{
  "status": "ok",
  "mode": "solo",
  "keys": {
    "product_key": "prod_1f...",
    "snapshot_key": "snap_aa...",
    "run_key": "run_31...",
    "audit_key": "audit_9c...",
    "render_key": "render_72..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "complete",
    "alignment_level": null
  },
  "artifacts": {
    "html_ref": "storage://runs/run_31/report.html",
    "pdf_ref": "storage://runs/run_31/report.pdf",
    "csv_ref": "storage://runs/run_31/tickets.csv"
  },
  "exports": {
    "tickets": [
      {
        "ticket_id": "T_solo_offer_clarity_SIG_OFFER_02_pdp_01",
        "mode": "solo",
        "title": "Afficher le prix dans le bloc d’achat",
        "impact": "high",
        "effort": "small",
        "risk": "low",
        "confidence": "high",
        "category": "offer_clarity",
        "why": "Le prix n’est pas détectable dans la zone d’achat, ce qui augmente la friction au moment de décider.",
        "evidence_refs": ["E_page_a_mobile_detection_buybox_detect_01"],
        "how_to": [
          "Localiser le composant de prix dans le template PDP.",
          "Afficher le prix dans la buybox (proche du CTA) sur mobile et desktop.",
          "Vérifier l’affichage pour variantes et promos (compare_at)."
        ],
        "validation": [
          "Sur mobile, le prix est visible dans la buybox sans scroll.",
          "Le prix est cohérent avec la variante sélectionnée."
        ],
        "quick_win": true,
        "owner_hint": "design",
        "notes": null
      }
    ],
    "evidences": [
      {
        "evidence_id": "E_page_a_mobile_detection_buybox_detect_01",
        "level": "A",
        "type": "detection",
        "label": "buybox_detect",
        "source": "page_a",
        "viewport": "mobile",
        "timestamp": "2026-01-17T21:00:00+01:00",
        "ref": "#evidence-E_page_a_mobile_detection_buybox_detect_01",
        "details": {
          "detector_id": "buybox_detector",
          "method": "dom_strict",
          "data_sources_used": ["dom", "screenshots"],
          "facts_summary": {
            "buybox_detected": true,
            "primary_cta_text": "Ajouter au panier"
          }
        }
      }
    ]
  },
  "errors": [],
  "timings_ms": {
    "capture_total": 12000,
    "detectors_total": 4000,
    "scoring_total": 2500,
    "report_total": 1800,
    "render_pdf_total": 9000,
    "end_to_end": 29300
  }
}
```

### 6.4 Response (succès “degraded”)
Règle : si `artifacts.html_ref` existe ⇒ `status="ok"` même si preuves/artefacts partiels (mode dégradé).

```json
{
  "status": "ok",
  "mode": "solo",
  "keys": {
    "product_key": "prod_1f...",
    "snapshot_key": "snap_aa...",
    "run_key": "run_32...",
    "audit_key": "audit_9d...",
    "render_key": "render_73..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "partial",
    "alignment_level": null
  },
  "artifacts": {
    "html_ref": "storage://runs/run_32/report.html",
    "pdf_ref": "storage://runs/run_32/report.pdf",
    "csv_ref": "storage://runs/run_32/tickets.csv"
  },
  "exports": { "tickets": [], "evidences": [] },
  "errors": [
    {
      "code": "CAPTURE_BLOCKED_BY_COOKIE_CONSENT",
      "stage": "capture",
      "message": "Cookie consent overlay blocked screenshot capture on mobile viewport.",
      "missing_evidence_reason": "blocked_by_cookie_consent",
      "source": "page_a"
    }
  ],
  "timings_ms": {
    "capture_total": 45000,
    "detectors_total": 3000,
    "scoring_total": 2000,
    "report_total": 1500,
    "render_pdf_total": 10000,
    "end_to_end": 61500
  }
}
```

---

## 7) POST `/api/audit-duo`

### 7.1 Request (AB)
```json
{
  "compare_type": "ab",
  "locale": "en",
  "urls": {
    "page_a": "https://brand-a.com/products/x",
    "page_b": "https://brand-b.com/products/y"
  },
  "options": {
    "copy_ready": true
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

### 7.2 Request (Before/After)
```json
{
  "compare_type": "before_after",
  "locale": "fr",
  "urls": {
    "before": "https://example.com/products/abc?v=2025-12-01",
    "after": "https://example.com/products/abc?v=2026-01-10"
  },
  "options": {
    "copy_ready": false
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

### 7.3 Request (Replay via `snapshot_key`)
```json
{
  "compare_type": "ab",
  "locale": "en",
  "snapshot_key": "snap_...",
  "options": { "copy_ready": false },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

Règles :
- `compare_type` ∈ `ab|before_after`, sinon `400 UNSUPPORTED_COMPARE_TYPE`.
- Si `snapshot_key` est présent, `urls` doit être absent.
- Si `snapshot_key` est présent, `compare_type` doit être cohérent avec ce snapshot (sinon `400 INVALID_REQUEST`).
- AB : `urls.page_a` et `urls.page_b` requis.
- Before/After : `urls.before` et `urls.after` requis.
- `options.copy_ready` et `timeouts_ms` suivent les mêmes règles que SOLO (§6.2).

### 7.4 Response (succès DUO)
```json
{
  "status": "ok",
  "mode": "duo_ab",
  "keys": {
    "product_key": "prod_2a...",
    "snapshot_key": "snap_bb...",
    "run_key": "run_90...",
    "audit_key": "audit_11...",
    "render_key": "render_aa..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "complete",
    "alignment_level": "medium"
  },
  "artifacts": {
    "html_ref": "storage://runs/run_90/report.html",
    "pdf_ref": "storage://runs/run_90/report.pdf",
    "csv_ref": "storage://runs/run_90/tickets.csv"
  },
  "exports": { "tickets": [], "evidences": [] },
  "errors": [],
  "timings_ms": {
    "capture_total": 22000,
    "detectors_total": 7000,
    "scoring_total": 9000,
    "report_total": 4000,
    "render_pdf_total": 10000,
    "end_to_end": 52000
  }
}
```

### 7.5 Response (DUO dégradé — evidence insuffisante + alignment low)
```json
{
  "status": "ok",
  "mode": "duo_before_after",
  "keys": {
    "product_key": "prod_2b...",
    "snapshot_key": "snap_cc...",
    "run_key": "run_91...",
    "audit_key": "audit_12...",
    "render_key": "render_ab..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "insufficient",
    "alignment_level": "low"
  },
  "artifacts": {
    "html_ref": "storage://runs/run_91/report.html",
    "pdf_ref": "storage://runs/run_91/report.pdf",
    "csv_ref": "storage://runs/run_91/tickets.csv"
  },
  "exports": { "tickets": [], "evidences": [] },
  "errors": [
    {
      "code": "CAPTURE_TIMEOUT",
      "stage": "capture",
      "message": "Navigation timed out on desktop viewport.",
      "missing_evidence_reason": "timeout",
      "source": "after"
    },
    {
      "code": "CAPTURE_NAVIGATION_INTERCEPTED",
      "stage": "capture",
      "message": "Navigation was intercepted (redirect/anti-bot).",
      "missing_evidence_reason": "navigation_intercepted",
      "source": "before"
    }
  ],
  "timings_ms": {
    "capture_total": 90000,
    "detectors_total": 6000,
    "scoring_total": 9000,
    "report_total": 5000,
    "render_pdf_total": 12000,
    "end_to_end": 122000
  }
}
```

---

## 8) Erreurs (contrat)

### 8.1 HTTP status
- **200** : `status="ok"` (y compris dégradé) si HTML SSOT produit.
- **400** : payload invalide / enum invalide.
- **401** : `UNAUTHORIZED` (si auth activée).
- **403** : `FORBIDDEN_URL` (SSRF / host/protocole interdits).
- **429** : `RATE_LIMITED`.
- **500** : `AUDIT_FAILED` (aucun HTML SSOT possible).

### 8.2 Codes request-level (minimum)
- `INVALID_REQUEST` (400)
- `UNSUPPORTED_LOCALE` (400)
- `UNSUPPORTED_COMPARE_TYPE` (400)
- `FORBIDDEN_URL` (403)
- `RATE_LIMITED` (429)
- `UNAUTHORIZED` (401)

### 8.3 `errors[]` (run-level)
Format minimal (stable) :
- `code` (string codifiée)
- `stage` (macro enum)
- `message` (string)
- `missing_evidence_reason` (6 enums ou `null`)
- `source` (`page_a|page_b|before|after|na`)

Note : `missing_evidence_reason` est renseigné uniquement pour les erreurs liées à la preuve/capture ; sinon il DOIT rester `null`.

### 8.4 Mapping minimal codes → reasons (SSOT)
| code | missing_evidence_reason |
|---|---|
| `CAPTURE_BLOCKED_BY_COOKIE_CONSENT` | `blocked_by_cookie_consent` |
| `CAPTURE_BLOCKED_BY_POPUP` | `blocked_by_popup` |
| `CAPTURE_INFINITE_SCROLL_OR_LAZYLOAD` | `infinite_scroll_or_lazyload` |
| `CAPTURE_NAVIGATION_INTERCEPTED` | `navigation_intercepted` |
| `CAPTURE_TIMEOUT` | `timeout` |
| `CAPTURE_UNKNOWN_RENDER_ISSUE` | `unknown_render_issue` |

---

## 9) Déterminisme (contrat)

### 9.1 IDs (rappel)
Les formats d’IDs sont SSOT et doivent correspondre à `SCORING_AND_DETECTION` v2.2 :
- `ticket_id = T_<mode>_<category>_<signal_id>_<scope>_<idx>`
- `evidence_id = E_<source>_<viewport>_<type>_<label>_<idx>`

### 9.2 Tri stable (tickets) (normatif)
Conforme `SCORING_AND_DETECTION` v2.2 §5.2 :
1) `PriorityScore` décroissant  
2) `impact` décroissant  
3) `confidence` décroissant  
4) `effort` croissant  
5) `risk` croissant  
6) `ticket_id` asc

### 9.2bis Tri stable (evidences) (normatif)
Conforme `EVIDENCE_PACK_SPEC` v1.2 §14 :
1) `source` (page_a, page_b, before, after)
2) `type` (screenshot, measurement, detection)
3) `viewport` (mobile, desktop, na)
4) `label`
5) `evidence_id`

### 9.3 Troncature (règle dure)
- Toujours **trier** puis tronquer (N). Jamais de sampling.
- Si une troncature est appliquée à des listes internes, l’annotation doit rester interne (ex `Evidence.details.truncated=true`).

### 9.4 Timestamps (règle dure)
Conforme `EVIDENCE_PACK_SPEC` v1.2 §8 :
- `exports.evidences[].timestamp` doit provenir du **snapshot/capture timestamp** de la source (ou de l’artefact si plus précis).
- Interdit : `now()` au moment du rendu.

---

## 10) Compatibilité livrable (HTML = SSOT)

### 10.1 Evidence pack : ancrage (règle dure)
Conforme `EVIDENCE_PACK_SPEC` v1.2 §6 :
- `Evidence.ref = "#evidence-<evidence_id>"`
- wrapper HTML evidence : `id="evidence-<evidence_id>"`
- wrapper HTML ticket : `id="ticket-<ticket_id>"`

Tout storage/path/json pointer est autorisé uniquement dans `Evidence.details`.

### 10.2 Missing evidence (HTML-only)
- Le tableau “Missing evidence” détaillé est dans le HTML (SSOT).
- L’API expose uniquement :
  - `report_meta.evidence_completeness` (pire des sources en DUO)
  - `errors[]` avec `source` + `missing_evidence_reason`

### 10.3 Copy-ready
Conforme `AUDIT_PIPELINE_SPEC` §11 :
- `options.copy_ready=true` s’applique uniquement aux **Top 5 tickets** (HTML).
- Les exports `tickets/evidences/csv` restent identiques (IDs/ordre/contenu export).

---

## 11) DoD (Definition of Done) — API (release gate)
- [ ] Endpoints : `POST /api/audit-solo` + `POST /api/audit-duo` (AB + Before/After).
- [ ] Validation stricte des payloads : 400 sur payload invalide / enum invalide.
- [ ] `versions` exposées et cohérentes : 3.1 / 2 / 2 / 1 / 1.3 + versions runtime.
- [ ] `report_meta.evidence_completeness` conforme gating Set A/B ; DUO = pire des sources.
- [ ] `report_meta.alignment_level=null` en SOLO ; `high|medium|low` en DUO.
- [ ] Exports stricts : Ticket v2 / Evidence v2 / CSV v1 ; **aucun champ/colonne ajoutée**.
- [ ] `Evidence.ref` et wrappers HTML conformes (`evidence-*`, `ticket-*`).
- [ ] Tri stable tickets conforme `SCORING_AND_DETECTION` §5.2.
- [ ] Tri stable evidences conforme `EVIDENCE_PACK_SPEC` §14.
- [ ] `exports.evidences[].timestamp` issu du snapshot/capture (jamais `now()` au rendu).
- [ ] `missing_evidence_reason` ∈ 6 enums SSOT (ou `null`), jamais autre chose.
- [ ] Mode dégradé : si HTML SSOT produit ⇒ `status="ok"` + `errors[]` (limitations explicites).
- [ ] Smoke : SOLO + DUO AB + DUO BA ; cas cookie/popup/timeout/navigation_intercept ; rerun via `snapshot_key` ⇒ mêmes IDs/ordre.
