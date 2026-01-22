# Smoke fixtures pack

This pack provides deterministic smoke fixtures for the ShopifyStrategist API.
Only the files under `fixtures/smoke/` are part of Step 1.

## Placeholder URLs
Owned test shop URLs are not provided yet. The URLs below are public Shopify
storefront placeholders and must be replaced with owned test shop URLs when
available. Each placeholder fixture is marked with `PLACEHOLDER` in its notes.

Baseline fixtures (pr_gate):
- solo_ok_instant: https://placeholder-shop-a.myshopify.com/products/placeholder-product-a (PLACEHOLDER)
- solo_ok_copyready: https://placeholder-shop-a.myshopify.com/products/placeholder-product-a (PLACEHOLDER)
- duo_ab_ok:
  - page_a: https://placeholder-shop-a.myshopify.com/products/placeholder-product-a (PLACEHOLDER)
  - page_b: https://placeholder-shop-b.myshopify.com/products/placeholder-product-b (PLACEHOLDER)
- duo_before_after_ok:
  - before: https://placeholder-shop-c.myshopify.com/products/placeholder-product-c?variant=111 (PLACEHOLDER)
  - after: https://placeholder-shop-c.myshopify.com/products/placeholder-product-c?variant=222 (PLACEHOLDER)

Degraded fixtures (nightly):
- degraded_cookie: https://placeholder-shop-d.myshopify.com/products/placeholder-product-d (PLACEHOLDER)
- degraded_popup: https://placeholder-shop-d.myshopify.com/products/placeholder-product-d (PLACEHOLDER)
- degraded_timeout: https://placeholder-shop-d.myshopify.com/products/placeholder-product-d (PLACEHOLDER)
- degraded_navigation_intercepted: https://placeholder-shop-d.myshopify.com/products/placeholder-product-d (PLACEHOLDER)
- degraded_infinite_scroll_or_lazyload: https://placeholder-shop-d.myshopify.com/products/placeholder-product-d (PLACEHOLDER)
- degraded_unknown_render_issue: https://placeholder-shop-d.myshopify.com/products/placeholder-product-d (PLACEHOLDER)

## Notes
- The four pr_gate baselines should target owned test shops per SSOT guidance.
- Degraded fixtures are placeholders for reproducible capture failures.
