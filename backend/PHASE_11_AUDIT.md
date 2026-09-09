# Phase 11 regression and security audit

**State:** implemented on the Phase 11 branch; under owner review.
**Baseline:** Phase 10 merge `51c6aa4` — 294 tests in 18 files passed before Phase 11 changes.

## Route and coverage inventory

This inventory comes from `src/routes`. “Existing” names the Phase 1–10 suites which already exercised the group.

| Group | Actual routes | Coverage and Phase 11 additions |
|---|---|---|
| Health | `GET /api/health` | `health`, `databaseIsolation`; global hardening applies |
| Products | `GET /api/products`, `/featured`, `/new`, `/sale`, `/search`, `/:id/related`, `/:slug` | `catalogue`; added unknown/duplicate query and operator-injection rejection |
| Categories | `GET /api/categories`, `/:slug` | `catalogue` |
| Collections | `GET /api/collections`, `/:slug` | `catalogue` |
| Authentication | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`; `GET /me`, `/me/:userId` | `auth`; added limiter and null/oversize/type/mass-assignment/Unicode cases |
| Profile | `GET/PATCH /api/profile`; `GET/POST /addresses`; `PATCH /addresses/:addressId/default`, `PATCH/DELETE /addresses/:addressId`; `GET/PATCH /measurement-profile` | `auth`; added guest matrix and admin/current-identity isolation |
| Cart | `GET/DELETE /api/cart`; `POST /items`, `PATCH/DELETE /items/:itemId`; `POST /merge`, `POST/DELETE /promo` | `cartWishlist`, `cartTotals`; operator rejection applies |
| Wishlist | `GET /api/wishlist`, `POST /toggle` | `cartWishlist`; added guest matrix |
| Orders | `POST /api/orders`, `GET /api/orders`, `GET /:orderId` | `orders`; added guest matrix; existing cross-account, concurrency, rollback, totals and stock tests retained |
| Admin | dashboard; image upload; product list/read/create/update/delete/duplicate/publish/bulk/reset/import; category list/create/update/delete; inventory list/update; user list/active; order list/status; review list/moderation; promotion list | `admin`, `adminProducts`, `adminManagement`, `adminOperations`, `virtualTryOn`; existing table-driven guest/customer/admin matrix covers all except image upload, covered separately by VTO tests |
| Recommendations | `GET /api/recommendations`, `/:type` | `recommendations` covers all nine groups and malformed queries |
| Virtual Try-On | `GET /eligible`, `/product/:productId`, `/jobs/:jobId`; `POST /`; `POST /jobs/:jobId/cancel`; `PUT /jobs/:jobId/feedback` | `virtualTryOn`, `virtualTryOnProvider`; capability/owner isolation, invalid bearer, quotas and persistent limiter retained |
| Diagnostics (test only) | `GET /api/__diagnostics/boom`, `/boom-async` | `errorHandling`; confirmed absent outside test configuration |

Every deployed route group has HTTP-level coverage. No deployed route is deliberately untested. Live Pixelcut, Cloudinary, Atlas and paid-provider calls are deliberately excluded: injected provider/storage doubles and `mongodb-memory-server` verify behaviour without changing external data or incurring cost.

## Authorisation result

The combined matrix verifies guest, customer and admin handling. Admin endpoints reject guests with 401 and customers with 403; admins reach normal handling. Customer-owned routes reject guests and derive identity from the verified JWT or guest capability header, never a body user ID. Existing cross-owner tests cover profiles/addresses, cart, wishlist, orders and VTO jobs. Admins do not gain implicit access to another customer's profile: the role-neutral profile endpoint returns only their own record. No unexpected allow was found.

## Confirmed gaps closed

- Added a 15-minute global ceiling (300 requests/client in production) and a tighter 10-attempt ceiling for failed register/login/password-recovery traffic. Responses retain the API error contract and modern rate-limit headers. VTO's durable limiter is unchanged.
- Rejects MongoDB operator, dotted/prototype-pollution keys and pathologically deep data before controllers. Catalogue queries reject unknown and duplicated scalar keys and cap search strings at 200 characters.
- Retains the 1 MiB JSON/form ceiling and constrained 10 MiB upload path; adds 413 evidence. Refresh tokens are capped at 2,048 characters.
- Strict Zod DTOs remain the mass-assignment boundary. Tests cover null, empty, wrong-shaped, unexpected, oversized, nested malicious and legitimate Unicode input.
- Helmet, production origin allowlisting, hidden Express identity, HS256-only expiring access JWTs, rotating hashed refresh tokens, configured bcrypt cost, generic 500s and secret-safe logs were already implemented and remain covered. Morgan was updated to its Unicode-safe release; bodies, tokens, credentials and photographs are never logged.

## High-risk business rules

Existing deterministic suites were substantive: `cartTotals` covers decimal rounding, discounts, minimum spends and a non-negative floor; `orders` covers server-authoritative totals, current promotions, delivery, transaction rollback, final-unit concurrency and stock status; admin suites cover order-status validation and inventory mutation. No parallel pricing implementation was introduced.

## Dependency audit

Both independent applications were audited without `npm audit fix`.

- Backend direct production findings in Morgan and Multer were fixed by safe updates; vulnerable transitive `qs` was updated. Three moderate findings remain in development-only Vitest (`vitest`, `@vitest/mocker`, coverage plugin). npm offers only breaking Vitest 5, whose runtime requirement conflicts with Node 18 support. Deferred because test tooling is not shipped to production or exposed to remote mock definitions.
- Frontend reported seven build-chain findings (two low, one moderate, four high) in Vite/Babel/Browserslist/esbuild/nanoid/PostCSS. The frontend is read-only in Phase 11 and fixing these changes its locked toolchain, so they are recorded for separately authorised frontend dependency maintenance.

## Coverage evidence

Run `npm run test:coverage`; generated `coverage/` output is removed after capture and not committed.

<!-- PHASE11_COVERAGE_RESULTS -->
Final clean run: **305 tests in 19 files passed**. V8 coverage: **93.09% statements, 86.42% branches, 95.90% functions and 93.09% lines**. All route files reached 100% statement/line/function coverage; lower totals are concentrated in process bootstrap, environment branches, provider-network adapters and logging paths which are deliberately isolated from HTTP regression tests.
<!-- /PHASE11_COVERAGE_RESULTS -->

## Remaining limitations

- Rate limiting uses process memory, proportionate for the planned single Render service. Multiple instances would require a shared store.
- Coverage is guidance, not proof. External provider and production-system verification is intentionally absent; Phase 12 owns deployment and Phase 14 final end-to-end validation.
