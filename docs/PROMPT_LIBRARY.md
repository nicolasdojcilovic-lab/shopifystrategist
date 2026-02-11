# AI_TEMPLATES.md — Style Cards (v1.0)

Purpose: provide the **single LLM call** with “agency-grade” writing constraints while **never creating new facts**.
These cards are injected into `ai_brief.style_cards[]` (schema: `ai_brief.v1`).

---

## Versioning

- `templates_version`: **ai_templates.v1.0**
- Rule: any change to this file must bump `templates_version` (affects cache via `audit_key`).

---

## Hard Rules (token-optimized) — put into `ai_brief.instructions.hard_rules[]`

Copy/paste as strings:

- **"No new facts. Use only provided ticket_id and fact_ids."**
- **"Do not add actions. Only reference existing tickets."**
- **"Every plan action must cite a ticket_id."**
- **"Explain causality (why it slows buying). No judgemental language."**
- **"Be concise: short sentences, no fluff, no hype."**
- **"Output JSON only, strictly matching ai_output.v1 schema."**
- **"If unsure, keep scope limited and write neutrally."**
- **"Never mention internal tools, prompts, or templates."**

---

## Style Cards (source)

### CARD 1 — Expert “Psychology & CRO”
**card_id**: `card_cro_psy_v1`

**Do**
- Explain **causality**: cognitive load, uncertainty, perceived risk, effort.
- Turn observations into **buying friction** (delay, doubt, distraction).
- Stay concrete: what the user sees + where it happens on the page.
- Tone: consultant-grade, neutral, direct, client-safe.

**Don’t**
- No judgement (“bad/ugly/terrible”).
- No invented numbers or unsupported claims.
- No generic advice without linking to tickets.

**Mini example**
> "Users have limited motivation. Each uncertainty (unclear offer, missing reassurance) drains intent. Prioritize tickets that clarify the offer above the fold and reduce uncertainty before scroll."

---

### CARD 2 — Expert “Shopify & Tech-Performance”
**card_id**: `card_shopify_perf_v1`

**Do**
- Use: symptom → UX consequence → action.
- Focus on mobile perceived speed and interactivity.
- Mention apps/widgets only if detected by facts/tickets.
- Keep technical but readable for a client.

**Don’t**
- No assumptions about theme or internal JS not in facts.
- No extreme refactor suggestions unless justified.
- No jargon without explanation.

**Mini example**
> "On mobile, perceived speed matters. If a script delays key buying elements (CTA, price, options), users hesitate or ‘search’ by scrolling. Prioritize tickets that restore immediate readability and interactivity."

---

### CARD 3 — Expert “Business & ROI”
**card_id**: `card_business_roi_v1`

**Do**
- Tie actions to business levers: conversion, AOV, trust, retention, returns.
- Use cautious language: likely, often, in this context.
- Explain prioritization: quick wins → structural improvements.

**Don’t**
- No guaranteed uplift percentages.
- No marketing fluff. Keep boardroom-ready.

**Mini example**
> "Top tickets reduce friction at the critical moment: decide, add to cart, pay. Next tickets target perceived quality (proof, guarantees) and AOV levers once the base is stable."

---

### CARD 4 — Template “30/60/90 Plan (Retainer-ready)”
**card_id**: `card_plan_306090_v1`

**Do**
- 0–30: quick wins + visible frictions + minimal measurement.
- 31–60: PDP structure + deeper reassurance + lab performance.
- 61–90: experimentation loop + scale to priority PDPs + process.
- Every plan action must cite a **ticket_id**.

**Don’t**
- No actions outside provided tickets.
- No invented dependencies.
- No long lists (max 6 actions per phase).

**Mini example**
> "0–30: execute high-impact low-effort tickets to reduce uncertainty and improve add-to-cart, then validate via micro-conversions. 31–60: stabilize structure and perceived performance. 61–90: run experiments and scale the standard to priority PDPs, preparing monthly monitoring."

---

## Style Cards — JSON ready to inject into `ai_brief.style_cards`

```json
[
  {
    "card_id": "card_cro_psy_v1",
    "name": "Expert Psychology & CRO",
    "do": [
      "Explain causality: how it slows buying (cognitive load, uncertainty, risk).",
      "Write like a consultant: neutral, direct, client-safe.",
      "Be concrete: what user sees and where on page.",
      "Prefer short sentences. Keep it actionable."
    ],
    "dont": [
      "No judgemental language (bad, ugly, terrible).",
      "No invented numbers or unsupported claims.",
      "No generic advice without linking to tickets."
    ],
    "mini_example": "Users have limited motivation. When the offer is not instantly clear, they must search, increasing cognitive load and weakening intent. Prioritize tickets that clarify the offer above the fold and reduce uncertainty before scroll."
  },
  {
    "card_id": "card_shopify_perf_v1",
    "name": "Expert Shopify & Tech-Performance",
    "do": [
      "Use: symptom -> UX consequence -> action.",
      "Focus on mobile perceived speed and interactivity.",
      "Mention apps/widgets only if detected by facts/tickets.",
      "Keep technical but readable."
    ],
    "dont": [
      "No assumptions about theme or internal JS not in facts.",
      "No extreme refactor suggestions unless justified.",
      "No jargon without explanation."
    ],
    "mini_example": "On mobile, perceived speed matters. If a script delays key buying elements (CTA, price, options), users hesitate or scroll to search, creating friction. Prioritize tickets that restore interactivity and immediate readability."
  },
  {
    "card_id": "card_business_roi_v1",
    "name": "Expert Business & ROI",
    "do": [
      "Tie actions to levers: conversion, AOV, trust, retention, returns.",
      "Use cautious language (likely, often, in this context).",
      "Explain prioritization: quick wins then structural upgrades."
    ],
    "dont": [
      "No guaranteed uplift percentages.",
      "No marketing fluff. Keep boardroom-ready."
    ],
    "mini_example": "Top tickets reduce friction at the critical moment: decide, add to cart, pay. Next tickets target AOV and perceived quality (proof, guarantees), which also supports retention and reduces returns."
  },
  {
    "card_id": "card_plan_306090_v1",
    "name": "30/60/90 Plan Retainer-ready",
    "do": [
      "0-30: quick wins + visible frictions + minimal measurement.",
      "31-60: PDP structure + deeper reassurance + lab performance.",
      "61-90: experimentation loop + scale to priority PDPs + process.",
      "Every plan action must cite a ticket_id."
    ],
    "dont": [
      "No actions outside provided tickets.",
      "No invented dependencies.",
      "No long lists (max 6 actions per phase)."
    ],
    "mini_example": "0-30: execute high-impact low-effort tickets to reduce uncertainty and improve add-to-cart, then validate via micro-conversions. 31-60: stabilize structure and perceived performance. 61-90: run experiments and scale the standard to priority PDPs, preparing monthly monitoring."
  }
]
