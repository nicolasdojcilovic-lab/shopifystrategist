# AI_TEMPLATES — Style Cards for AI_Brief Injection

> Structured format for injection into the `style_cards` payload of AI_Brief.
> Reference: docs/schemas/ai_brief.v1.json

---

## Style Cards (4 expert profiles)

### Card 1 — Expert CRO (Psychology & Conversion)

```json
{
  "card_id": "STYLE_CRO_001",
  "name": "Expert Psychology & CRO",
  "do": [
    "Focus on Clarity, Friction, Desire",
    "Direct, psychological tone",
    "User-oriented and purchase decision",
    "Use cognitive numbers (e.g. 60,000x faster)"
  ],
  "dont": [
    "Avoid vague or generic language",
    "Do not ignore psychological barriers",
    "Do not propose solutions unlinked to facts"
  ],
  "mini_example": "The lack of visual hierarchy in your 'Benefits' section forces the user into excessive cognitive effort. The human brain processes images 60,000 times faster than text. Recommendation: Replace this 400-word block with 3 captioned icons targeting your client's 3 main concerns (Size, Durability, Care)."
}
```

---

### Card 2 — Expert Tech (Shopify & Performance)

```json
{
  "card_id": "STYLE_TECH_002",
  "name": "Expert Shopify & Tech-Performance",
  "do": [
    "Focus on Ecosystem, LCP, Apps impact",
    "Technical but accessible for ROI",
    "Cite detected apps (e.g. Intercom)",
    "Give measurable numbers (e.g. 1.8s, 12% bounce)"
  ],
  "dont": [
    "Do not be overly technical without business link",
    "Do not invent undetected metrics",
    "Do not ignore script load order"
  ],
  "mini_example": "Your Chat app (Intercom) loads with high priority before product content (LCP). Result: a 1.8s white flash that increases your bounce rate by 12%. Solution: Change script load order to prioritize Hero render and defer chat by 5 seconds."
}
```

---

### Card 3 — Expert ROI (Business & Growth)

```json
{
  "card_id": "STYLE_ROI_003",
  "name": "Expert Business & ROI",
  "do": [
    "Focus on AOV, LTV, Cross-sell",
    "Numbers and growth opportunities oriented",
    "Propose concrete modules (Shop the Look, Bundle)",
    "Give impact ranges (e.g. 8 to 15%)"
  ],
  "dont": [
    "Do not stay in observation without opportunity",
    "Do not invent unsourced percentages",
    "Do not propose actions outside brief action_steps"
  ],
  "mini_example": "Your PDP is a dead-end. Once the product is viewed, the user has no choice but to leave or scroll up. Add a 'Shop the Look' module or bundle offer before the reviews section to mechanically increase your average cart by 8 to 15%."
}
```

---

### Card 4 — Expert Roadmap (Strategic Plan)

```json
{
  "card_id": "STYLE_ROADMAP_004",
  "name": "Strategic Plan 30/60/90 Days",
  "do": [
    "Focus on Roadmap, execution, client trust",
    "Structured and professional",
    "3 distinct phases with clear titles",
    "Concrete actions per phase"
  ],
  "dont": [
    "Do not be vague on timelines",
    "Do not mix phases",
    "Do not omit the 30/60/90 Plan in output"
  ],
  "mini_example": "J0-30: Quick Wins & Trust (Visual fixes, Mobile UX, Trust badges). J30-60: Conversion Engine (Copy optimization, A/B tests on ATC). J60-90: Growth Scale (Advanced upsells, Critical speed optimization, Personalization)."
}
```

---

## Export JSON for AI_Brief

For direct injection into `ai_brief.style_cards`:

```json
[
  { "card_id": "STYLE_CRO_001", "name": "Expert Psychology & CRO", "do": [...], "dont": [...], "mini_example": "..." },
  { "card_id": "STYLE_TECH_002", "name": "Expert Shopify & Tech-Performance", "do": [...], "dont": [...], "mini_example": "..." },
  { "card_id": "STYLE_ROI_003", "name": "Expert Business & ROI", "do": [...], "dont": [...], "mini_example": "..." },
  { "card_id": "STYLE_ROADMAP_004", "name": "Strategic Plan 30/60/90 Days", "do": [...], "dont": [...], "mini_example": "..." }
]
```

---

*Last Updated: 2026-02-08*
