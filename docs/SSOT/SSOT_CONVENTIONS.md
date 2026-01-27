## SSOT Language Policy (MUST)

### SSOT documents language
All SSOT specification documents are **English-only**:
- Specs, registries, schemas, error codebooks, runbooks, acceptance criteria, detectors specs, scoring specs, fixtures spec.

**No mixed language** is allowed inside a SSOT document (EN/FR mixing is forbidden), except:
- Standard metric acronyms (LCP, CLS, TTFB)
- IDs, enums, keys, code identifiers
- Proper nouns / brand names

### Client-facing report language
Audit outputs (HTML/PDF) are controlled by:
- `report_language`: `fr|en`

SSOT language and report language are independent by design:
- SSOT remains English-only.
- Report content is localized (FR/EN) via template catalogs and i18n.

### Enforcement (MUST)
The repo must include an automated check that fails CI if:
- A SSOT doc contains non-allowed French language blocks (heuristic/regex allowlist-based),
- Or if a SSOT doc mixes languages beyond the explicit exceptions.
