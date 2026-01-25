# contracts/export/ — Schémas d'Export Stables (API Publique)

Ce dossier contient les schémas Zod pour les formats d'export **stables** (anti-drift).

## Fichiers

### `ticket.v2.ts`
Schéma Ticket (TICKET_SCHEMA_VERSION = 2).

**Champs (format stable)** :
- `ticket_id` : `T_<mode>_<category>_<signal_id>_<scope>_<idx>`
- `mode` : `solo | duo_ab | duo_before_after`
- `title`
- `impact` : `high | medium | low`
- `effort` : `small | medium | large`
- `risk` : `low | medium | high`
- `confidence` : `high | medium | low`
- `category` : `offer_clarity | trust | media | ux | performance | seo_basics | accessibility | comparison`
- `why`
- `evidence_refs` : `string[]` (≥ 1)
- `how_to` : `string[]` (3–7 steps)
- `validation` : `string[]`
- `quick_win` : `boolean`
- `owner_hint` : `design | dev | content | ops`
- `notes` : `string` (optionnel)

**Référence SSOT** : `docs/REPORT_OUTLINE.md` section 8.

### `evidence.v2.ts`
Schéma Evidence (EVIDENCE_SCHEMA_VERSION = 2).

**Champs (format stable)** :
- `evidence_id` : `E_<source>_<viewport>_<type>_<label>_<idx>`
- `level` : `A | B | C`
- `type` : `screenshot | measurement | detection`
- `label`
- `source` : `page_a | page_b | before | after`
- `viewport` : `mobile | desktop | na`
- `timestamp` : ISO 8601
- `ref` : **ancre HTML** `#evidence-<evidence_id>` (règle dure)
- `details` : objet libre (metric, value, method, threshold)

**Référence SSOT** : `docs/REPORT_OUTLINE.md` section 9.

**RÈGLE DURE** : `Evidence.ref` DOIT pointer vers ancre `#evidence-<evidence_id>`.  
Tout storage/path/JSON pointer va dans `details`.

### `csv.v1.ts`
Schéma CSV Export (CSV_EXPORT_VERSION = 1).

**Colonnes (format stable)** :
- `ticket_id`, `mode`, `title`, `impact`, `effort`, `risk`, `confidence`, `category`
- `why`, `evidence_refs` (séparateur `|`)
- `how_to` (séparateur `|`), `validation` (séparateur `|`)
- `quick_win`, `owner_hint`, `url_context`

**Référence SSOT** : `docs/REPORT_OUTLINE.md` section 12.

---

## Règles Anti-Drift (Non Négociables)

1. **Aucun nouveau champ export** sans :
   - Bump de version correspondante (major si breaking)
   - Mise à jour des docs SSOT
   - Validation contract-first

2. **HTML report = SSOT** : PDF/CSV sont dérivés du HTML.

3. **Evidence-based** : Chaque ticket DOIT avoir `evidence_refs.length >= 1`.

4. **Wrappers HTML obligatoires** :
   - Ticket : `id="ticket-<ticket_id>"`
   - Evidence : `id="evidence-<evidence_id>"`

5. **Déterminisme** : Mêmes entrées + mêmes versions → mêmes IDs + même tri.

Toute modification de ce dossier DOIT être précédée d'une validation SSOT.
