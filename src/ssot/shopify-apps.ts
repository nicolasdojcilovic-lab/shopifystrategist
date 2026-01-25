/**
 * ⚠️ LISTE SSOT — Shopify Apps Signatures
 * 
 * Liste exhaustive des apps Shopify détectables via scripts/meta/classes.
 * 
 * Principe SSOT (Anti-Drift):
 * - Cette liste est la source de vérité unique
 * - Toute nouvelle app doit être ajoutée ici
 * - Les patterns doivent être testés et validés
 * 
 * Référence:
 * - docs/DETECTORS_SPEC.md (v1.3)
 * 
 * @version SHOPIFY_APPS_VERSION = 1.0
 */

/**
 * Signature d'une app Shopify
 */
export interface ShopifyAppSignature {
  name: string;
  category: 'reviews' | 'marketing' | 'support' | 'subscriptions' | 'loyalty' | 'analytics' | 'other';
  patterns: RegExp[];
  description?: string;
}

/**
 * Liste SSOT des apps Shopify détectables
 * 
 * ⚠️ RÈGLES:
 * - Patterns en ordre de spécificité (du plus spécifique au plus général)
 * - Utiliser case-insensitive (flag `i`)
 * - Tester les patterns avant d'ajouter
 * - Documenter les sources (ex: script URL, class name)
 */
export const SHOPIFY_APPS: readonly ShopifyAppSignature[] = [
  // ============================================================================
  // REVIEWS & UGC (User Generated Content)
  // ============================================================================
  {
    name: 'Loox',
    category: 'reviews',
    patterns: [
      /loox\.io/i,
      /loox-reviews/i,
      /looxapp/i,
    ],
    description: 'Photo reviews & referrals',
  },
  {
    name: 'Judge.me',
    category: 'reviews',
    patterns: [
      /judge\.me/i,
      /judgeme/i,
    ],
    description: 'Product reviews',
  },
  {
    name: 'Yotpo',
    category: 'reviews',
    patterns: [
      /yotpo\.com/i,
      /yotpo-widget/i,
    ],
    description: 'Reviews & loyalty',
  },
  {
    name: 'Stamped.io',
    category: 'reviews',
    patterns: [
      /stamped\.io/i,
      /stampedapp/i,
    ],
    description: 'Product reviews & ratings',
  },
  {
    name: 'Okendo',
    category: 'reviews',
    patterns: [
      /okendo\.io/i,
      /okendoreviews/i,
    ],
    description: 'Customer reviews & Q&A',
  },
  {
    name: 'Rivyo',
    category: 'reviews',
    patterns: [
      /rivyo/i,
    ],
    description: 'Product reviews',
  },

  // ============================================================================
  // MARKETING & EMAIL
  // ============================================================================
  {
    name: 'Klaviyo',
    category: 'marketing',
    patterns: [
      /klaviyo\.com/i,
      /klaviyo-onsite/i,
    ],
    description: 'Email marketing & automation',
  },
  {
    name: 'Privy',
    category: 'marketing',
    patterns: [
      /privy\.com/i,
      /widget\.privy/i,
    ],
    description: 'Popups & email capture',
  },
  {
    name: 'Justuno',
    category: 'marketing',
    patterns: [
      /justuno\.com/i,
      /jst-widget/i,
    ],
    description: 'Popups & promotions',
  },
  {
    name: 'Omnisend',
    category: 'marketing',
    patterns: [
      /omnisend\.com/i,
    ],
    description: 'Email & SMS marketing',
  },
  {
    name: 'Attentive',
    category: 'marketing',
    patterns: [
      /attentive\.com/i,
      /attentivemobile/i,
    ],
    description: 'SMS marketing',
  },
  {
    name: 'Postscript',
    category: 'marketing',
    patterns: [
      /postscript\.io/i,
    ],
    description: 'SMS marketing',
  },

  // ============================================================================
  // LIVE CHAT & SUPPORT
  // ============================================================================
  {
    name: 'Gorgias',
    category: 'support',
    patterns: [
      /gorgias\.com/i,
      /gorgias-chat/i,
    ],
    description: 'Customer support & helpdesk',
  },
  {
    name: 'Tidio',
    category: 'support',
    patterns: [
      /tidio\.com/i,
      /tidiochat/i,
    ],
    description: 'Live chat',
  },
  {
    name: 'Zendesk',
    category: 'support',
    patterns: [
      /zendesk\.com/i,
      /zopim/i,
    ],
    description: 'Customer support',
  },
  {
    name: 'Re:amaze',
    category: 'support',
    patterns: [
      /reamaze\.com/i,
    ],
    description: 'Customer messaging',
  },
  {
    name: 'Intercom',
    category: 'support',
    patterns: [
      /intercom\.io/i,
      /intercom-widget/i,
    ],
    description: 'Customer messaging',
  },

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  {
    name: 'ReCharge',
    category: 'subscriptions',
    patterns: [
      /rechargepayments\.com/i,
      /recharge\.com/i,
      /rechargeassets/i,
    ],
    description: 'Subscriptions',
  },
  {
    name: 'Bold Subscriptions',
    category: 'subscriptions',
    patterns: [
      /bold.*subscription/i,
      /boldapps.*subscription/i,
    ],
    description: 'Recurring orders',
  },
  {
    name: 'Appstle',
    category: 'subscriptions',
    patterns: [
      /appstle/i,
    ],
    description: 'Subscriptions',
  },

  // ============================================================================
  // LOYALTY & REFERRALS
  // ============================================================================
  {
    name: 'Smile.io',
    category: 'loyalty',
    patterns: [
      /smile\.io/i,
      /smile-ui/i,
    ],
    description: 'Loyalty & rewards',
  },
  {
    name: 'LoyaltyLion',
    category: 'loyalty',
    patterns: [
      /loyaltylion\.com/i,
    ],
    description: 'Loyalty program',
  },
  {
    name: 'Growave',
    category: 'loyalty',
    patterns: [
      /growave/i,
    ],
    description: 'Loyalty & reviews',
  },
  {
    name: 'ReferralCandy',
    category: 'loyalty',
    patterns: [
      /referralcandy\.com/i,
    ],
    description: 'Referral marketing',
  },

  // ============================================================================
  // ANALYTICS & TRACKING
  // ============================================================================
  {
    name: 'Hotjar',
    category: 'analytics',
    patterns: [
      /hotjar\.com/i,
    ],
    description: 'Heatmaps & recordings',
  },
  {
    name: 'Lucky Orange',
    category: 'analytics',
    patterns: [
      /luckyorange\.com/i,
    ],
    description: 'Heatmaps & analytics',
  },
  {
    name: 'Triple Whale',
    category: 'analytics',
    patterns: [
      /triplewhale/i,
    ],
    description: 'Analytics & attribution',
  },

  // ============================================================================
  // OTHER POPULAR APPS
  // ============================================================================
  {
    name: 'Bold',
    category: 'other',
    patterns: [
      /boldapps\.net/i,
      /bold-.*\.js/i,
    ],
    description: 'Various Bold apps',
  },
  {
    name: 'Shogun',
    category: 'other',
    patterns: [
      /getshogun\.com/i,
    ],
    description: 'Page builder',
  },
  {
    name: 'PageFly',
    category: 'other',
    patterns: [
      /pagefly\.io/i,
    ],
    description: 'Page builder',
  },
  {
    name: 'Searchanise',
    category: 'other',
    patterns: [
      /searchanise\.com/i,
    ],
    description: 'Search & filters',
  },
  {
    name: 'Algolia',
    category: 'other',
    patterns: [
      /algolia\.net/i,
      /algoliainsights/i,
    ],
    description: 'Search',
  },
] as const;

/**
 * Catégories d'apps (pour groupement)
 */
export const APP_CATEGORIES = [
  'reviews',
  'marketing',
  'support',
  'subscriptions',
  'loyalty',
  'analytics',
  'other',
] as const;

export type AppCategory = typeof APP_CATEGORIES[number];

/**
 * Helper pour rechercher une app par nom
 */
export function findAppByName(name: string): ShopifyAppSignature | undefined {
  return SHOPIFY_APPS.find(
    (app) => app.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Helper pour filtrer les apps par catégorie
 */
export function getAppsByCategory(category: AppCategory): readonly ShopifyAppSignature[] {
  return SHOPIFY_APPS.filter((app) => app.category === category);
}

/**
 * Statistiques
 */
export const SHOPIFY_APPS_STATS = {
  total: SHOPIFY_APPS.length,
  byCategory: {
    reviews: getAppsByCategory('reviews').length,
    marketing: getAppsByCategory('marketing').length,
    support: getAppsByCategory('support').length,
    subscriptions: getAppsByCategory('subscriptions').length,
    loyalty: getAppsByCategory('loyalty').length,
    analytics: getAppsByCategory('analytics').length,
    other: getAppsByCategory('other').length,
  },
} as const;
