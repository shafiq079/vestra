# Phase 8 integration log

## Runtime switch

- `VITE_USE_MOCK_API=false` selects the Express API at `VITE_API_BASE_URL` (default `http://localhost:5000/api`).
- `VITE_USE_MOCK_API=true`, or omitting the variable, selects the existing offline demo repositories.
- Real access and refresh tokens use `vestra-auth-token` and `vestra-refresh-token`. Guest carts use a generated `vestra-guest-cart-id` sent as `X-Guest-Cart-Id`.

## Switched domains

| Domain | Real-mode authority | Mock-mode fallback | Integration notes |
|---|---|---|---|
| Catalogue, categories, collections, search | Products/category/collection services | Existing catalogue repositories | Home collections, category/collection headings, filter options, and search overlay no longer display mock catalogue records in real mode. |
| Authentication | `/auth/login`, `/auth/register`, `/auth/me`, `/auth/refresh`, `/auth/logout` | Existing demo users | Tokens are installed before authenticated hydration; expired access tokens rotate once; logout clears user-scoped client state. Optional public demo-account passwords support one-click seeded-user login. |
| Profile, addresses, measurements | `/profile` routes | Existing local demo user | Successful server responses replace the session user; pages no longer invent persisted IDs in real mode. |
| Cart | `/cart` routes | Existing persisted demo cart | The server response replaces cart state after every real mutation. Guest carts are identified consistently and merged after authentication. Prices, stock, promotions and totals remain server-authoritative. |
| Wishlist | `/wishlist` routes | Existing persisted demo wishlist | Authenticated real responses replace local state instead of maintaining a second wishlist. |
| Orders | `/orders` routes | Existing mock orders/order creation | Account history queries the service. Checkout submits cart selections but treats returned price, delivery and order metadata as authoritative. Confirmation receives the created order and never fabricates an order number/date in real mode. |
| Admin | `/admin` routes | Existing admin mock data | Catalogue, category, inventory, users, orders, reviews, promotions and metrics use real endpoints. Dashboard secondary panels are derived from real orders/inventory; unsupported historical/system feeds show honest unavailable states. CSV files use the bulk import endpoint in real mode. |

## Static-data audit

- Recommendation data remains mocked because recommendations are Phase 9.
- Virtual Try-On demo data remains mocked because provider integration is Phase 10.
- Public product reviews are shown only in mock mode; Phase 7 exposes review moderation to administrators but no public product-review endpoint.
- Hero copy/images, delivery-option presentation and other editorial constants remain presentation data. The backend still determines checkout pricing and delivery output.
- Mock imports inside service modules remain deliberately isolated behind `USE_MOCK_API`; they are never selected as real-mode business authority.

## Verification record

Automated verification for this change is recorded in the pull request and commit report. The mock-mode Vite server was started with the backend offline and served successfully. A browser automation runtime and a configured real MongoDB/API deployment were not available in this workspace, so authenticated end-to-end browser scenarios remain an explicit deployment verification item: catalogue reads, cart/wishlist mutations, checkout confirmation, profile persistence, admin reads, and 401/404/500 UI paths. Functional loading/empty/error states reuse existing components and classes.

## Design regression statement

Phase 8 intentionally changes data orchestration only. It does not alter the visual theme, page layout, navigation presentation, product-page hierarchy, storefront/admin separation, typography, colours, or responsive design.
