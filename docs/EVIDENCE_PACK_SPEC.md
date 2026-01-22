# ShopifyStrategist — EVIDENCE_PACK_SPEC.md (SSOT-aligned)

**EVIDENCE_PACK_SPEC_VERSION:** 1.2  
**Statut :** SSOT (EvidenceBuilder + rendu HTML "Evidence pack")  
**Owner :** Nicolas  

## 0) But
Verrouiller **sans drift** :
- la production des objets **Evidence v2** (`EVIDENCE_SCHEMA_VERSION=2`) utilisés par les tickets,
- les règles de navigation (`Evidence.ref` → ancre HTML),
- le rendu HTML **Evidence pack** + **Missing evidence**,
- le déterminisme (IDs, tri, troncatures),

…tout en respectant :
- **HTML report = SSOT**, PDF strictement dérivé (Playwright),
- **Evidence-based** (aucun ticket sans `evidence_refs[]`),
- **Aucun nouveau champ export** (tickets/evidence/csv).

---

## 1) Références SSOT (source de vérité)
- `docs/SCORING_AND_DETECTION.md` (v2.2) : schémas Ticket v2 / Evidence v2 / CSV v1, formats d’IDs, gating screenshots, reasons, confidence rules, règles “contestable → DOM-first”, diversity rules.
- `docs/REPORT_OUTLINE.md` (V3.1) : structure report, définition A/B/C, règles Top actions vs Appendix, Evidence pack, Missing evidence.
- `docs/DETECTORS_SPEC.md` (v1.3) : enveloppes de détecteurs (`method`, `data_sources_used`, `errors`, `facts`, `evidence_hints`) + règles de déterminisme.
- `docs/AUDIT_PIPELINE_SPEC.md` (latest) : étapes pipeline (scoring → EvidenceBuilder → HTML builder → PDF), erreurs, mapping vers les 6 reasons.

> Anti-drift : ce document **ne redéfinit pas** thresholds/keyword lists/signal catalog/enums métier/diversity rules. S’il faut “une règle métier”, on référence `SCORING_AND_DETECTION`.

---

## 2) Objectifs / Non-objectifs

### 2.1 Objectifs
1) Définir des règles **normatives** pour produire `exports.evidences[]` conformes **Evidence v2**.
2) Garantir la **navigabilité** : `Evidence.ref` pointe vers une ancre HTML stable.
3) Garantir le **déterminisme** : mêmes entrées + mêmes versions ⇒ mêmes IDs / même tri / mêmes troncatures.
4) Décrire le **mode dégradé** côté preuves (pas de métriques inventées, limitations explicites, tickets déplacés ou confidence ajustée selon SSOT).
5) Supporter **SOLO + DUO (AB & Before/After)** : les evidences sont **par source** (`page_a/page_b/before/after`).

### 2.2 Non-objectifs
- Définir quels signaux produisent quels tickets : `SCORING_AND_DETECTION`.
- Définir les détecteurs (leurs règles/thresholds) : `DETECTORS_SPEC`.
- Définir la structure complète du report : `REPORT_OUTLINE`.
- Ajouter/renommer des champs export : interdit.

---

## 3) Invariants (non négociables)
1) **Aucun nouveau champ export** : Evidence v2 / Ticket v2 / CSV v1 stricts.
2) **Evidence-based** : chaque ticket exporté a `evidence_refs[]` avec **≥ 1** `evidence_id` existant.
3) **Lab-only** : perf/poids = labo best-effort, jamais de RUM ; si indispo ⇒ aucune valeur inventée.
4) **Reasons codifiées** : tout `missing_evidence_reason` ∈ {6 enums SSOT} ou `null`.
5) **Déterminisme** : pas de `now()`, pas de sampling ; tri stable ; troncatures déterministes.
6) **DUO** : `Evidence.source` n’est **jamais** `gap/diff` (interdit car non SSOT). Les tickets “gap/diff” référencent des evidences **page_a + page_b** (ou before+after).

---

## 4) Rappel schéma — Evidence v2
Evidence (EVIDENCE_SCHEMA_VERSION=2) :
- `evidence_id` (déterministe)
- `level`: `A|B|C`
- `type`: `screenshot|measurement|detection`
- `label` (slug stable)
- `source`: `page_a|page_b|before|after`
- `viewport`: `mobile|desktop|na`
- `timestamp` (ISO)
- `ref` : **ancre HTML stable** `#evidence-<evidence_id>` (règle dure)
- `details` (libre)

> Toute information additionnelle (storage refs, méthode, métriques, rects, facts, troncatures…) doit rester dans `Evidence.details`.

---

## 5) Positionnement pipeline (anti-drift)
Conforme `AUDIT_PIPELINE_SPEC` :
- Les détecteurs produisent des **facts** (et `evidence_hints`) via `DETECTORS_SPEC`.
- Le scoring (SSOT : `SCORING_AND_DETECTION`) décide **quels tickets** et **quelles evidences** sont nécessaires.
- **EvidenceBuilder** (pipeline) normalise et sécurise les evidences : `evidence_id`, `ref`, `timestamp`, `details`, tri/troncatures.
- Le report HTML rend l’**Evidence pack** (groupé) et “Missing evidence”.

---

## 6) Règle dure : `Evidence.ref` + wrappers HTML
Pour garantir une navigation fiable dans le HTML SSOT :
- **Règle dure** : `Evidence.ref = "#evidence-<evidence_id>"`.
- Le HTML contient :
  - wrapper evidence : `id="evidence-<evidence_id>"`
  - wrapper ticket : `id="ticket-<ticket_id>"`

Tout lien de stockage (screenshot key, path, storage url, json pointer…) est autorisé **uniquement** dans `Evidence.details`.

---

## 7) `evidence_id` (déterminisme) + indexation
Format SSOT :
`E_<source>_<viewport>_<type>_<label>_<idx>`

- `<source>` : `page_a|page_b|before|after`
- `<viewport>` : `mobile|desktop|na`
- `<type>` : `screenshot|measurement|detection`
- `<label>` : slug stable
- `<idx>` : `01..99`

### 7.1 Indexation (normative)
Si plusieurs evidences partagent `(source, viewport, type, label)` :
1) trier par clé stable (ex : `dom_order` puis `url` asc puis `node_ref.dom_path` asc),
2) assigner `01`, `02`, …
3) si possible, **préférer bundling** (liste stable dans `details`) plutôt que multiplier les evidences.

---

## 8) `timestamp` (règle dure anti-nondéterminisme)
- `Evidence.timestamp` doit provenir du **snapshot/capture timestamp** de la source (ou de l’artefact si plus précis).
- Interdit : `now()` au moment du rendu.

---

## 9) Evidence `level` (A/B/C) — aligné SSOT
Définition de base = `REPORT_OUTLINE` :
- **A** : preuve claire et directement pertinente (screenshot net / détection non ambiguë / mesure chiffrée avec méthode).
- **B** : preuve pertinente mais incomplète (lazy-load, popup, section partielle).
- **C** : inférence plausible sans preuve suffisante ⇒ **Appendix-only**.

### 9.1 EXTRACT VERBATIM — “screenshot B visuellement évident” (SCORING v2.2 Patch 3)
> DO NOT EDIT HERE — Source : `docs/SCORING_AND_DETECTION.md` v2.2 §12.1
- l’élément est lisible sans zoom,
- l’absence/présence est incontestable (ex : pas un pixel-crop, pas un overlay),
- le viewport et timestamp sont présents dans l’evidence pack.

### 9.2 Règles minimales (MVP) par `type`
#### a) `type="screenshot"`
- **A** si le screenshot est net et directement probant (au sens REPORT_OUTLINE).
- **B** si le screenshot est “visuellement évident” (extract ci-dessus) mais avec contexte moins complet (crop/section partielle acceptable tant que l’élément probant est incontestable).
- **C** autorisé si la lecture est ambiguë (flou, overlay résiduel, élément non concluant) — **Appendix-only**.

#### b) `type="measurement"`
- **A** si : méthode + contexte + valeurs présents (et limitation “lab” explicitée).
- **B** si : mesure partielle mais encore exploitable avec limites explicites.
- **C** seulement si l’info est une estimation (Appendix-only) — sinon omettre.

#### c) `type="detection"`
- **A** si méthode non ambiguë (ex : `dom_strict`) et facts clairs.
- **B** si fallback encadré (ex : `dom_fallback` ou `screenshot_b` avec faits ultra conservateurs).
- **C** si heuristique fragile / contexte insuffisant ⇒ Appendix-only.

---

## 10) `label` (stabilité, anti-drift)
- `label` est un **slug stable** : un changement de nomenclature peut changer `evidence_id` ⇒ implique bump `SCORING_VERSION`.
- Ce doc **ne maintient pas** une “liste officielle” de labels (risque de drift).

Règle pratique (normative) :
- screenshots : `label` dérivé de `screenshot_name` SSOT (ex : `above_fold_mobile` → `above_fold`).
- detections : `label` dérivé de `detector_id` (ou d’un mapping stable défini dans `SCORING_AND_DETECTION`).
- measurements : `label` dérivé de `measurement_id` (ou mapping stable `SCORING_AND_DETECTION`).

---

## 11) `viewport` (règles)
- screenshots : `viewport` ∈ {`mobile`,`desktop`} (jamais `na`).
- measurement/detection : `viewport="na"` si non dépendant d’un viewport.
- Si une detection/measurement est explicitement viewport-dépendante, utiliser `mobile/desktop` (mais rester cohérent et déterministe).

---

## 12) `Evidence.details` (recommandations, sans contrainte de schéma)
> `details` est libre, mais doit rester **déterministe** (tri, troncatures, pas de champs instables).

### 12.1 Screenshot details (recommandé)
```json
{
  "screenshot_name": "cta_area_mobile",
  "storage_ref": "storage://.../snap_.../page_a/mobile/cta_area.png",
  "focus_rect": {"x": 12, "y": 600, "w": 366, "h": 200},
  "notes": "best_effort"
}
```

### 12.2 Detection details (aligné `DETECTORS_SPEC`)
```json
{
  "detector_id": "buybox_detector",
  "detector_version": "1.3.0",
  "method": "dom_strict",
  "data_sources_used": ["dom", "screenshots"],
  "facts_summary": {
    "buybox_detected": true,
    "primary_cta_text": "Ajouter au panier"
  }
}
```

### 12.3 Measurement details (recommandé)
```json
{
  "measurement_id": "lighthouse_lab",
  "method": "lighthouse_run",
  "context": {"preset": "mobile", "throttling": "default"},
  "metrics": {"perf_score": 38, "lcp_s": 4.8, "cls": 0.29, "tbt_ms": 720},
  "limitations": "Lab metrics (not real user data)."
}
```

### 12.4 Troncatures déterministes (si listes longues)
Si `details` contient des listes longues :
- trier de façon stable,
- tronquer de façon déterministe,
- annoter :
```json
{"truncated": true, "kept": 20, "total": 124}
```

---

## 13) Gating screenshots → `evidence_completeness` + “Missing evidence”
### 13.1 Règles SSOT (référence)
Les sets A/B, le gating, et les conséquences (badge cover + Appendix) sont définis dans :
- `SCORING_AND_DETECTION` v2.2 §2.3
- `AUDIT_PIPELINE_SPEC` §4.1 (extract verbatim)

Ce document impose uniquement :
- calcul conforme SSOT (`complete|partial|insufficient`),
- table “Missing evidence” visible si `!= complete`,
- reasons strictement dans les 6 enums SSOT.

### 13.2 DUO : agrégation multi-sources (règle conservatrice)
- Calculer un statut **par source** (interne).
- Le `report_meta.evidence_completeness` affiché en cover (unique) = **pire des sources** : `insufficient > partial > complete`.
- En HTML : détailler par source dans la table “Missing evidence”.

### 13.3 “Missing evidence” (HTML-only)
La table doit contenir, par item :
- `source` (page_a/page_b/before/after)
- `missing_evidence_reason` (1 des 6 enums SSOT)
- `impact` (phrase courte **déterministe**)

**Règle de déterminisme (impact)** :
- utiliser un template stable (pas de génération libre) :
  - `"Some evidence could not be captured (<artifact>). Related tickets may be moved to the Appendix."`
- où `<artifact>` est un identifiant stable (ex : un `screenshot_name` SSOT, ou `network_log`, ou `lighthouse`).

> Aucun champ export n’est affecté : cette table est HTML-only.

---

## 14) Tri stable des evidences (normatif)
Tri stable recommandé pour `exports.evidences[]` :
1) `source` (page_a, page_b, before, after)
2) `type` (screenshot, measurement, detection)
3) `viewport` (mobile, desktop, na)
4) `label`
5) `evidence_id`

---

## 15) Attachement `ticket.evidence_refs[]` (déterminisme)
### 15.1 Règles dures
- Chaque ticket exporté référence **≥1** `evidence_id` existant.
- Top actions : tickets avec preuves A/B uniquement et `confidence != low` (SSOT).
- Appendix : autorise preuves C (Appendix-only).

### 15.2 Sélection déterministe (recommandée)
Pour un ticket :
1) construire la liste candidates (selon SSOT scoring),
2) filtrer selon “min evidence level for Top actions” (SSOT interne),
3) trier par `evidence_id` asc,
4) garder le plus petit ensemble suffisant (souvent 1–2, max 3).

---

## 16) Mode dégradé (graceful degradation)
- Si Lighthouse indispo : **aucune** métrique inventée ; omettre la measurement ou dégrader vers detection (Appendix-only si contestable).
- Si network_log indispo : pas de bytes fiables ; omettre measurement ; fallback conservateur uniquement.
- Si DOM indispo : privilégier `screenshot_b` (facts ultra conservateurs) ; sinon Appendix.
- Si screenshots insuffisants : `evidence_completeness` degrade + table Missing evidence + tickets dépendants déplacés/abaissement confidence selon SSOT.

---

## 17) Erreurs internes + mapping vers les 6 reasons (sans enums inventés)
Les erreurs pipeline/détecteurs sont définies dans `AUDIT_PIPELINE_SPEC` / `DETECTORS_SPEC`.

Règle : quand une erreur explique un manque de preuve, elle doit porter `missing_evidence_reason` ∈ {6 enums SSOT}.

Exemple (interne pipeline) :
```json
{
  "code": "CAPTURE_TIMEOUT",
  "stage": "capture",
  "message": "Navigation timed out on mobile viewport",
  "source": "page_a",
  "missing_evidence_reason": "timeout"
}
```

---

## 18) DoD — Evidence pack
- `exports.evidences[]` conformes Evidence v2 strict.
- `Evidence.ref` navigable dans HTML (`#evidence-...`) + wrappers `evidence-*` et `ticket-*`.
- IDs déterministes + tri stable + troncatures déterministes.
- `report_meta.evidence_completeness` conforme SSOT + table “Missing evidence” si != complete (reasons ∈ 6 enums SSOT).
- DUO : evidences par source ; cover = pire des sources ; pas de `source=gap/diff`.
- Mode dégradé validé : rapport livré, limitations explicites, pas de métriques inventées.


