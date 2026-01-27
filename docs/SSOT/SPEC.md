# ShopifyStrategist — SPEC.md (SSOT)
**Status:** SSOT (Single Source Of Truth = single source of truth)  
**Owner:** Nicolas  
**Objective:** “Funnel” document (market → product → deliverable → components) aligning **product ↔ implementation ↔ tests**.

---

## 0) Acronyms & terms (definitions)
- **SSOT (Single Source Of Truth)**: single source of truth (here: the **HTML report**).
- **HTML (HyperText Markup Language)**: web page format.
- **PDF (Portable Document Format)**: export document format.
- **PDP (Product Detail Page)**: product page.
- **CRO (Conversion Rate Optimization)**: conversion rate optimization.
- **ICP (Ideal Customer Profile)**: ideal customer profile.
- **AB (A vs B)**: comparison of two pages (often “you vs competitor”).
- **Before/After**: comparison of the same page between two versions/dates.
- **P90**: 90th percentile (90% of audits finish below this time).
- **COGS (Cost Of Goods Sold)**: variable cost per audit (capture, PDF rendering, optional AI, etc.).
- **GA4 (Google Analytics 4)**: analytics tool (out of MVP).
- **RLS (Row-Level Security)**: “row-level” database security.
- **DoD (Definition of Done)**: acceptance criteria (“it’s done when…”).
- **Pre-sales**: usage to close a mission/sprint.
- **Delivery**: execution/production of actions (by the agency / the freelancer).

---

## 1) SSOT rules (non-negotiable)
1) The **HTML report** is the **source of truth** (SSOT).  
2) The **PDF** is **strictly derived** from the HTML (Playwright rendering).  
3) **Reproducibility**: same inputs + same versions = same outputs.  
4) **Mandatory evidence** (“evidence-based”): each recommendation contains **at least 1 evidence** (capture / measurement / detected element).  
5) **Sellable quality**: the report must be **sendable without edits** in the vast majority of cases.  
6) **Degraded mode**: if a module (capture/measurement) fails, we still deliver a usable report + a clear explanation.

---

## 2) Executive summary (1 page)

### 2.1 Vision
Become the fastest tool to produce an “agency-grade” **Shopify PDP teardown**:
- **ready to send** (HTML + PDF),
- **evidence → action** (no fluff),
- **standardized** (agency industrialization),
- **comparable** (AB / Before-After),
- **reproducible** (determinism + caching + versioning).

### 2.2 Positioning (one-liner)
**Evidence-based PDP teardown + comparison + executable backlog.**  
=> **A pre-sales weapon + a delivery OS** for agencies/freelancers.

### 2.3 ICP (priority order, cashflow-first)
1) **Shopify / CRO agencies**: volume + recurrence + need to standardize (pre-sales + delivery).  
2) **CRO / e-commerce ops freelancers**: need to deliver fast, consistent quality, without “reinventing the audit”.  
3) **Shopify DTC brands (≈ €1–20M)**: via partners (avoid support/integrations at first).

### 2.4 Promise (measurable result)
In **< X minutes**, generate a **sendable** report that contains:
- a clear **executive summary**,
- **prioritized actions** (impact / effort / risk),
- **evidence**,
- an **exportable backlog** (tickets),
- optional: a **comparison** (competitor / before-after),
- optional: **copy-ready** (paste-ready text) in FR/EN.

### 2.5 Offers (SKU = sellable products)
- **SOLO — Instant Teardown** (deterministic, fast, evidence-based)  
- **DUO — AB Battlecard** (you vs competitor: “gap list” + action plan)  
- **DUO — Before/After Diff** (same PDP at 2 versions/dates: changes + backlog)  
- **Add-ons**: White-label, copy-ready (AI), Notion/Jira exports.

### 2.6 KPI (success indicators)
Product:
- **P90** (Instant / DUO), **cache hit rate** (hit rate), error rate
- % of reports “sendable without edits”
Business:
- audits/month/agency, retention, gross margin (COGS controlled via cache)

---

## 3) Market

### 3.1 High-ROI problems (pain = €)
- PDP that doesn’t convert → CAC/ROAS deteriorates
- Human audit = slow/expensive/not reproducible
- Checklists = no prioritization, no evidence, not “client-ready”
- AB tests = require traffic/time/implementation → not an instant sales weapon

### 3.2 Alternatives & why it’s insufficient
- **Checklists/templates**: useful to learn, rarely a sellable deliverable.
- **Human audits**: variable quality, expensive, not industrializable.
- **“AI audit” apps**: often generic, low credibility without evidence.
- **Technical tools**: useful (performance/SEO/accessibility), not oriented to “conversion + actions”.

### 3.3 Blind spots (opportunities)
1) Agency-grade deliverable ready to send  
2) Systematic evidence (anti “generic”)  
3) Standard comparability (AB / before-after)  
4) Reproducibility / traceability (comparable reruns)  
5) Sellable prioritization (“what to do Monday”)  
6) Executable backlog (turn a report into delivery)

---

## 4) Positioning (to lock)

### 4.1 What we sell (really)
We don’t sell “an audit”. We sell:
- **a decision** (where to act first),
- **evidence** (to convince),
- **a backlog** (to execute),
- **a comparison** (to justify and demonstrate).

### 4.2 “Agency” message
- **Pre-sales**: “evidence + action plan in 10 minutes → you close.”
- **Delivery**: “structured tickets → you ship fast.”
- **Proof of value**: “before/after → you show improvement.”

### 4.3 Non-goals (anti-drift)
- Do not become an analytics platform
- Do not depend on Shopify Admin access for MVP
- Do not be a “text generator”: evidence > prose

---

## 5) Product (value proposition)

### 5.1 JTBD (concrete need)
- **Agency**: produce a credible teardown immediately to close a sprint / mission.  
- **Freelancer**: standardize diagnosis, deliver fast, consistent quality.  
- **Brand** (later): quick wins without big commitment.

### 5.2 Outputs (deliverables)
- **HTML SSOT** (complete report + anchors + evidence)
- **PDF** (Playwright, strict derivative)
- **Exportable backlog** (CSV minimum; Notion/Jira later)
- **Artifacts & traces** (timings, cache headers, logs)

### 5.3 Evidence-based (anti-hallucination)
Hard rule: each recommendation must contain **at least 1 evidence**:
- capture (with an anchor link to the section)  
- measurement (e.g., performance, image weight, blocking elements)  
- explicitly detected element (e.g., absence of X, presence of Y)

---

## 6) Deliverable UX (what the client sees)

### 6.1 SOLO — Instant Teardown (see REPORT_OUTLINE V3.1)
The sendable report structure is defined only in docs/SSOT/REPORT_OUTLINE.md
**A) Cover**
- audited URL + timestamp
- versions (normalize/scoring/engine/report/render)
- mode (SOLO/DUO) + “scope: PDP”
- language (FR/EN)

**B) Executive summary (6 lines max)**
- 1 sentence: main blocker
- 1 sentence: main opportunity
- Top 3 actions (high impact)
- “48h quick wins” (1–3 actions)
- estimated global effort (S/M/L = small/medium/large)
- next step (sprint proposal)

**C) Top actions (ticket format)**
Each action = 1 ticket:
- title (verb + object)
- impact (H/M/L = high/medium/low) + why (1 sentence)
- effort (S/M/L)
- risk (low/medium/high)
- evidence (capture/measurement/detection)
- how-to (3–7 steps)
- validation (how to verify it’s fixed)

**D) Evidence pack**
- captures + excerpts + measurements grouped
- anchor links to sections

**E) Appendix (optional)**
- scorecard (if useful) — **never the main argument**
- technical notes (perf/seo/accessibility)
- limitations & assumptions

### 6.2 DUO — AB Battlecard (sellable diff)
DUO AB output = battlecard:
- “What the competitor does better” (3–10 gaps max, evidenced)
- “What we can copy in 72h” (quick wins)
- “What we must not copy” (brand/offer consistency)
- “copy-paths” backlog (tickets)

### 6.3 DUO — Before/After Diff (before/after)
- list of detected changes (structure, modules, sections, media)
- “expected impact” (hypothesis) + how to measure (if available)
- backlog of fixes / improvements

---

## 7) MVP scope (Minimum Viable Product = minimum sellable product)

### 7.1 MVP in-scope
1) **SOLO — Instant Teardown**: HTML SSOT + PDF  
2) **DUO — AB Battlecard**: HTML SSOT + PDF  
3) **Backlog export**: CSV (tickets) + stable mapping (for Notion later)  
4) **Cache + determinism + versioning**  
5) **Observability**: timings + cache headers + smoke artifacts

### 7.2 MVP out-of-scope (on purpose)
- Shopify Admin / GA4 / pixels integration
- Heatmaps / session recordings
- AB testing integrated into theme
- Multi-users/teams/advanced RLS
- Advanced white-label (only “light” if standardizable)

### 7.3 DoD (Definition of Done)
- reproducible: same inputs + versions → same outputs
- PDF rendered identically from the HTML SSOT
- measurable cache hits + fast reruns
- report “sendable” most of the time
- smoke tests + exported artifacts

---

## 8) Engineering principles (invariants)
These principles describe “what must be true” on the implementation side, independent of coding style.

- **HTML is SSOT**: the HTML report is the truth; the PDF is only a rendering of the HTML.
- **Contract-first**: each API request/response has an explicit schema and is validated at runtime.
- **Deterministic outputs**: same inputs + same versions ⇒ same outputs (stable keys, stable rendering).
- **Versioned pipeline**: normalization / detection / scoring / report / rendering have explicit versions, injected into outputs.
- **Cache by keys**: multi-layer cache based on deterministic keys (fast and low-cost reruns).
- **Evidence-based recommendations**: no recommendation without evidence (capture / measurement / detection).
- **Graceful degradation**: partial failure ⇒ deliverable report + explanation + workaround.
- **Observability**: per-step timings + run ids + cache headers emitted systematically.
- **No hidden state**: no implicit state; everything that impacts the result must be in inputs/options/versions.
- **Safety-by-default**: timeouts, limits, abuse prevention, readable error messages (support reduction).

---

## 9) Architecture principles (invariants)

### 9.1 SSOT
- HTML = truth
- PDF = Playwright derivative
- any report change = change the HTML SSOT (not the PDF)

### 9.2 Determinism & multi-layer caching
Deterministic keys:
- `product_key`, `snapshot_key`, `run_key`, `audit_key`, `render_key`

Layers:
- Product (normalized URL)
- Snapshot (captured/normalized HTML)
- Run (scoring + evidence)
- Audit (HTML report)
- Render (PDF)

Goal: **never pay again** (capture/render/AI) if identical.

### 9.3 Versioning (anti-drift)
- `NORMALIZE_VERSION`
- `SCORING_VERSION`
- `ENGINE_VERSION`
- (optional) `REPORT_VERSION`, `RENDER_VERSION`
Each output includes versions for auditability.

### 9.4 Contract-first
- strict schemas (Zod) for all requests/responses
- idempotence: same request = same result (or cache hit)

### 9.5 Observability
- detailed timings (capture/normalization/scoring/rendering)
- cache headers (X-Cache*, X-Audit-Timing)
- request logs + smoke artifacts (HTML/JSON/errors)

---

## 10) Business model (simple and readable)

### 10.1 Unit of value
- 1 **SOLO** = 1 credit
- 1 **DUO** = 2 credits (assumption)

### 10.2 Plans (recommended)
- **Agency plan**: monthly bundle (X audits included) + clear overage
- **White-label add-on**: surcharge (high perceived value)
- **AI copy-ready add-on**: surcharge (variable COGS)

### 10.3 Guardrails
- COGS controlled via cache
- rate limits / abuse prevention
- usage logs (ledger)

---

## 11) Go-to-market (cashflow-first)

### 11.1 Main sales angle (agencies)
- “Pre-sales teardown”: audit in 10 min → close a 72h sprint
- “Delivery accelerator”: ready backlog → faster production
- “Proof pack”: before/after → retention + upsell

### 11.2 Service packaging (to boost cash)
- Typical offer: “72h PDP Sprint” (audit + quick wins)
- ShopifyStrategist = internal tool + deliverable sent to the client

### 11.3 Distribution
- Shopify / CRO agency partnerships
- targeted outreach “teardown + battlecard”
- live demo + 1 free (or heavily discounted) audit in exchange for a call

---

## 12) Operating model — time-decoupling (side business)
> Decoupling doesn’t come “from code”, but from the combo: **standardized product + partner distribution + self-serve + bounded support**.

### 12.1 Priority channel
**Beachhead = Shopify / CRO agencies + freelancers** (they sell and deliver without you).  
**Not a priority at first: direct DTC brands** (support and specific requests).

### 12.2 Packaged offer (repeatable, no custom)
- **We sell packs**, not custom work.
- **No per-client template customization** at the beginning (otherwise your time reconnects to revenue).

### 12.3 Self-serve (support reduction)
- 1 “How it works” page
- 1 “Limitations” page (supported scope)
- 1 “FAQ / Troubleshooting” page
- 3 sample reports (SOLO + DUO)

### 12.4 Support policy
Included:
- reproducible bugs, rendering errors, invalid URLs
Excluded:
- implementing recommendations
- custom CRO coaching
- one-off customizations

Recommended SLA:
- best effort, 48–72 business hours

### 12.5 Business DoD (real decoupling)
- 80%+ of audits generated without intervention
- <10% of audits trigger a support ticket
- an agency can produce and send audits without you
- monthly revenue continues even if your time decreases (maintenance only)

---

## 13) Risks & mitigations

1) **Perception “generic / AI”**
- mitigation: mandatory evidence + “what we detected” + no unverifiable claims

2) **Debatable scores**
- mitigation: score is secondary; selling point = actions + evidence + backlog

3) **Agencies: “this is our value, we don’t want a tool”**
- mitigation: white-label + ticket export + promise “close + delivery”, not “replace the agency”

4) **Product drift (scope creep)**
- mitigation: anything that increases support is postponed or becomes a paid, standardizable add-on

---

## 14) Appendices
- `docs/SSOT/API_DOC.md` (endpoint contracts + validated payloads)
- `docs/SSOT/DB_SCHEMA.md` (tables/relations + cache keys)
- `docs/SSOT/RUNBOOK_SMOKE.md` (commands + evidence + expected headers)
- `docs/SSOT/ADR/*.md` (decision log: 1 decision = 10 lines, dated)

---

## 15) Glossary (mini)
- **Teardown**: structured, action-oriented analysis with evidence.
- **Battlecard**: competitor comparison centered on actionable gaps.
- **Degraded mode**: we deliver despite partial failure (with explanation).
- **Deterministic keys**: stable identifiers for cache and comparable reruns.
