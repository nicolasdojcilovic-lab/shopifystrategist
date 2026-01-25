# Facts Collector — Extraction Déterministe de Faits Shopify

**Version:** 1.0  
**Référence SSOT:** `docs/DETECTORS_SPEC.md` (v1.3)

## 📖 Objectif

Le **Facts Collector** est un module **pur et déterministe** qui extrait des faits structurés depuis le HTML capturé d'une page produit Shopify.

**Principe SSOT (Anti-Drift)** :
- ✅ **Facts-Only** : Aucun score, aucune recommandation, aucune décision
- ✅ **Pure Function** : Mêmes entrées → mêmes sorties (déterminisme garanti)
- ✅ **DOM-First** : Priorité aux faits DOM (pas d'inférence visuelle)
- ✅ **No Scoring** : Le mapping `facts → tickets` vit dans le scoring engine

---

## 🎯 Usage

### Import

```typescript
import { collectFacts, FactsHelpers } from '@/core/engine/facts-collector';
```

### Extraction de Faits

```typescript
const html = await captureHtml(url);

const facts = collectFacts(html, {
  strictMode: true,  // Éviter heuristiques fragiles
  locale: 'fr',      // Hint pour textes localisés
});

console.log('Product:', facts.pdp.title);
console.log('Price:', facts.pdp.price);
console.log('Has ATC:', facts.pdp.hasAtcButton);
console.log('Apps:', facts.technical.detectedApps);
```

---

## 📊 Interface ShopifyFacts

### PDPFacts (Product Detail Page)

Informations clés de la page produit :

```typescript
interface PDPFacts {
  // Titre
  title: string | null;

  // Prix
  price: string | null;
  currency: string | null;
  hasSalePrice: boolean;
  regularPrice: string | null;
  salePrice: string | null;

  // Call-to-Action
  hasAtcButton: boolean;
  atcText: string | null;
  atcButtonCount: number;

  // Variants
  hasVariantSelector: boolean;
  variantTypes: string[]; // Ex: ["Size", "Color"]

  // Disponibilité
  inStock: boolean | null;
  stockText: string | null;

  // Description
  hasDescription: boolean;
  descriptionLength: number;
}
```

**Heuristiques Shopify** :
- **Titre** : `.product__title`, `main h1`, `[itemtype*="Product"] h1`
- **Prix** : `.product__price`, `.price`, `[data-product-price]`
- **ATC Button** : `button[name="add"]`, `form[action*="/cart/add"] button`
- **Variants** : `.product-form__input`, `select[name*="option"]`

### StructureFacts (DOM Analysis)

Analyse structurelle de la page :

```typescript
interface StructureFacts {
  // Headings
  h1Count: number;
  mainH1Text: string | null;
  h2Count: number;
  h3Count: number;

  // Images
  imageCount: number;
  imagesWithoutAlt: number;
  imagesWithLazyLoad: number;

  // Sections importantes
  hasReviewsSection: boolean;
  hasShippingInfo: boolean;
  hasReturnPolicy: boolean;
  hasSocialProof: boolean;

  // Formulaires
  formCount: number;
  hasNewsletterForm: boolean;
}
```

**Détection** :
- **Reviews** : `.product-reviews`, `[class*="review"]`
- **Shipping** : Keywords (`free shipping`, `livraison gratuite`)
- **Social Proof** : Patterns (`X people bought`, `trending`, `bestseller`)

### TechnicalFacts (Shopify & Apps)

Informations techniques et apps détectées :

```typescript
interface TechnicalFacts {
  // Shopify
  isShopify: boolean;
  shopifyVersion: string | null;
  themeName: string | null;

  // Apps détectées
  detectedApps: string[];

  // Analytics
  hasGoogleAnalytics: boolean;
  hasFacebookPixel: boolean;
  hasKlaviyo: boolean;

  // Accessibilité
  hasSkipLink: boolean;
  hasAriaLabels: boolean;
  langAttribute: string | null;
}
```

**Apps Détectées** :
- Klaviyo, Loox, Judge.me, Yotpo, Stamped.io
- Gorgias, Tidio, ReCharge, Bold, Privy
- Justuno, Smile.io, LoyaltyLion

---

## 🛠️ Helpers

### extractNumericPrice

Extrait le prix numérique depuis une string :

```typescript
FactsHelpers.extractNumericPrice('$29.99'); // → 29.99
FactsHelpers.extractNumericPrice('€45,50'); // → 4550 (⚠️  bug virgule)
FactsHelpers.extractNumericPrice('£19.00'); // → 19
```

### normalizeCtaText

Normalise le texte d'un CTA :

```typescript
FactsHelpers.normalizeCtaText('  ADD TO  CART  '); // → "add to cart"
FactsHelpers.normalizeCtaText('Ajouter au panier'); // → "ajouter au panier"
```

### hasApp

Vérifie si une app est présente :

```typescript
FactsHelpers.hasApp(facts, 'klaviyo'); // → true
FactsHelpers.hasApp(facts, 'loox');    // → false
```

---

## 🧪 Testing

### Script de test

```bash
npm run test:facts
```

### Test Output

```
📦 PDP Facts:
   • Title: Premium Cotton T-Shirt
   • Price: $29.99
   • Has ATC Button: true
   • ATC Text: Add to Cart
   • In Stock: true

🏗️  Structure Facts:
   • H1 Count: 1
   • Image Count: 0
   • Has Reviews: true
   • Has Shipping Info: true

⚙️  Technical Facts:
   • Is Shopify: true
   • Detected Apps: Klaviyo
   • Has Google Analytics: true

📊 Metadata:
   • Parsing Duration: 14 ms
```

---

## 🎯 Intégration avec AuditService

Le collecteur de faits doit être appelé **après la capture** mais **avant le scoring** :

```typescript
// Dans AuditService.runSoloAudit()

// 1. Capture (Playwright)
const results = await this.playwrightService.captureBothViewports(url);

// 2. Collecte des faits (nouveau)
const facts = collectFacts(results.mobile.html, {
  strictMode: true,
  locale: options.locale || 'en',
});

// 3. Storage (Supabase)
await this.storageService.uploadScreenshot(...);

// 4. Persistence (Prisma)
await prisma.snapshotSource.upsert({
  create: {
    artefacts: {
      screenshot_refs: storageRefs,
      html_refs: htmlRefs,
      facts: facts, // ⚡ Stocker les faits collectés
    },
  },
});

// 5. Scoring (TODO: détecteurs + scoring engine)
const tickets = await this.scoringEngine.generateTickets(facts);
```

---

## 🔒 Déterminisme (SSOT)

### Garanties

1. **Pure Function** : Pas d'effets de bord, pas de `Math.random()`, pas de `Date.now()` dans la logique
2. **Tri Stable** : Arrays triés (ex: `detectedApps.sort()`)
3. **Unique Values** : Déduplication (ex: `[...new Set(apps)]`)
4. **Pas de Dépendances Externes** : Pas d'API calls, pas de FS reads

### Test de Déterminisme

```typescript
const facts1 = collectFacts(html);
const facts2 = collectFacts(html);

// Doit être identique
assert.deepEqual(facts1, facts2);
```

---

## ⚠️  Limitations Connues

### 1. Prix avec Virgule

Le helper `extractNumericPrice` ne gère pas correctement les virgules européennes :

```typescript
extractNumericPrice('€45,50'); // → 4550 (incorrect, devrait être 45.5)
```

**Fix à faire** : Détecter la locale et normaliser correctement.

### 2. Variants sans Label

Si les variants n'ont pas de `<label>` associé, `variantTypes` sera vide :

```typescript
<select name="id">
  <option>Small</option>
  <option>Medium</option>
</select>
```

**Fix à faire** : Parser les `<option>` pour déduire les types.

### 3. Apps Nouvelles

La liste des apps détectées est limitée aux 13 apps populaires. De nouvelles apps ne seront pas détectées.

**Solution** : Maintenir une liste SSOT dans `docs/DETECTORS_SPEC.md`.

---

## 📚 Références SSOT

- `docs/DETECTORS_SPEC.md` — Contrats détecteurs (facts-only)
- `docs/SCORING_AND_DETECTION.md` — Mapping facts → tickets
- `docs/REPORT_OUTLINE.md` — Structure rapport HTML
- `src/core/engine/keys.ts` — Clés déterministes
- `src/adapters/capture/playwright.service.ts` — Capture HTML

---

## 🚀 Prochaines Étapes

1. ✅ **Facts Collector** (Fait !)
2. ⏳ **Intégrer dans AuditService** (stocker facts dans `artefacts`)
3. ⏳ **Créer Détecteurs** basés sur les facts (`src/core/detectors/*`)
4. ⏳ **Scoring Engine** : `facts → tickets` (`src/core/scoring/*`)
5. ⏳ **Evidence Builder** : `facts → evidences` avec refs storage

---

**Validation SSOT** : ✅ 100%

- ✅ Facts-Only (pas de scores)
- ✅ Pure Function (déterministe)
- ✅ DOM-First (heuristiques Shopify)
- ✅ Structured Output (interfaces Zod-ready)
- ✅ No Drift (pas de champs export)
