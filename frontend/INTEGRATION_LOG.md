# Phase 8 integration log

## Runtime switch

- `VITE_USE_MOCK_API=false` selects the Express API at `VITE_API_BASE_URL` (default `http://localhost:5000/api`).
- `VITE_USE_MOCK_API=true`, or omitting the variable, selects the existing offline demo repositories.
- Real access and refresh tokens use `vestra-auth-token` and `vestra-refresh-token`. Guest carts use a lazily generated `vestra-guest-cart-id`, sent only on guest-capable cart/order requests and consumed after a successful merge.

## Switched domains

| Domain | Real-mode authority | Mock-mode fallback | Integration notes |
|---|---|---|---|
| Catalogue, categories, collections, search | Products/category/collection services | Existing catalogue repositories | Home collections, category/collection headings, filter options, and search overlay no longer display mock catalogue records in real mode. |
| Authentication | `/auth/login`, `/auth/register`, `/auth/me`, `/auth/refresh`, `/auth/logout` | Existing demo users | Concurrent 401s share one rotating refresh request and each request retries at most once. Login/register/logout failures never trigger refresh. Logout always removes browser credentials. Real-mode demo buttons only fill the public demo email; passwords are never bundled. Temporary hydration outages preserve the session. |
| Profile, addresses, measurements | `/profile` routes | Existing local demo user | Successful server responses replace the session user; pages no longer invent persisted IDs in real mode. |
| Cart | `/cart` routes | Existing persisted demo cart | The server response replaces cart state after every real mutation. A successful guest merge directly installs the returned cart and removes its guest ID; merge conflicts remain visible. Prices, stock, promotions and totals remain server-authoritative. Promo discounts have one monetary-amount contract in both modes. |
| Wishlist | `/wishlist` routes | Existing persisted demo wishlist | Real-mode wishlist is authenticated-only and comes exclusively from `/wishlist`; guest heart clicks request sign-in and never create a pretend database-backed local wishlist. |
| Orders | `/orders` routes | Existing mock orders/order creation | Account history queries the service. Checkout submits cart selections but treats returned price, delivery and order metadata as authoritative. Confirmation receives the created order and never fabricates an order number/date in real mode. |
| Admin | `/admin` routes | Existing admin mock data | Catalogue, category, inventory, users, orders, reviews, promotions and metrics use real endpoints. Dashboard sales, top products, recent orders and stock panels are derived from real orders/inventory; only the unavailable system feed says so. Real CSV files bypass the legacy preview parser and display the authoritative bulk-import result and row errors. |

## Static-data audit

- Recommendations remain available in mock mode because Phase 9 has not shipped; real mode returns an empty/unavailable result and makes no recommendation API request.
- Virtual Try-On remains explicitly demo-only because provider integration is Phase 10; real mode makes no VTO API request and generated results remain marked `isDemo`.
- Size recommendation remains available in mock mode because its ML service is Phase 13; real mode reports it unavailable and makes no size-recommendation API request.
- Public product reviews are shown only in mock mode; Phase 7 exposes review moderation to administrators but no public product-review endpoint.
- Hero copy/images, delivery-option presentation and other editorial constants remain presentation data. The backend still determines checkout pricing and delivery output.
- Mock imports remain deliberately isolated behind runtime mode or explicit future-phase demo gates; they are never selected as real-mode authority for a Phase 3–7 domain.

## Frontend test tooling

The frontend manifest has no test runner or test script. Phase 8 does not introduce a new dependency solely for these orchestration tests; verification therefore uses strict type-checking, both mode-specific production builds, backend regression tests, and documented integration checks.

## Verification record

Automated verification for this change is recorded in the pull request and commit report. The mock-mode Vite server was started with the backend offline and served successfully. A browser automation runtime and a configured real MongoDB/API deployment were not available in this workspace, so authenticated end-to-end browser scenarios remain an explicit deployment verification item: catalogue reads, cart/wishlist mutations, checkout confirmation, profile persistence, admin reads, and 401/404/500 UI paths. Functional loading/empty/error states reuse existing components and classes.

## Design regression statement

Phase 8 intentionally changes data orchestration only. It does not alter the visual theme, page layout, navigation presentation, product-page hierarchy, storefront/admin separation, typography, colours, or responsive design.
