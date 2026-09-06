# Phase 10 readiness audit — Pixelcut VTO and production mock cleanup

**Status:** implementation blocked before provider or runtime changes (2026-09-06)

## Owner authorisation and scope

The owner explicitly authorised Phase 10 to remove the frontend's production mock API mode and disposable demo data, superseding the older working-agreement requirement to preserve `VITE_USE_MOCK_API`. This authorisation does not permit a redesign: existing visual structure and components remain locked. Test-only fixtures and injected provider doubles remain permitted.

## Baseline and repository state

The checkout started at `a1a5443138d437cd923647f23e3576d9750caf4d`, the owner-provided last Phase 9 merge. The checkout contained no Git remote, so the current remote `backend-development` head could not be fetched or independently confirmed.

## Production mock inventory (before removal)

Runtime mock branches remain in:

- `frontend/src/services/apiClient.ts`: `VITE_USE_MOCK_API` defaults to enabled and gates token refresh.
- `authService.ts` and `store/authStore.ts`: mock users, demo login, local profile mutation, and mock-aware session/cart behaviour.
- `productService.ts`, `categoryService.ts`, `adminService.ts`, `orderService.ts`, `cartService.ts`, `wishlistService.ts`, `profileService.ts`, `reviewService.ts`, and `recommendationService.ts`: selectable fabricated responses or mock repositories.
- `sizeRecommendationService.ts`: a Phase 13 demo branch; it must become an explicit unavailable state rather than a substitute model.
- `virtualTryOnService.ts`: a hard-coded demo provider that returns the catalogue image as a successful result.

Disposable data and repositories live in `frontend/src/mocks/`: products, categories/collections, users, orders, reviews, recommendations, dashboard/business metrics, promotions, request latency, and mutable product/category repositories. Production service imports currently prevent safe deletion.

Truthfulness issues linked to this scaffolding remain in the demo login prompts, demo checkout copy, and VTO's “instant demo preview” copy. Legitimate browser-local identifiers/state (the opaque guest-cart identifier and an unsaved guest wishlist) are distinct from fabricated server data and should remain where required by the real backend contract.

## Catalogue image audit

The database seed remains legitimate development/test infrastructure and must not be deleted. Its records are sample catalogue records, not verified commercial inventory. Before enabling paid VTO, each eligible colour needs an HTTPS image that depicts the corresponding garment and is suitable for Pixelcut. A variant-level image is preferable when present. Existing generic/lifestyle catalogue images cannot be assumed to be clean single-garment inputs; eligibility alone is insufficient evidence of provider suitability.

## Blocking verification failures

No production Pixelcut request mapping was implemented because the official documentation could not be reached from this environment (the documentation requests were rejected by the network proxy). In particular, direct byte/base64 support versus URL-only inputs, exact field names, authentication, job states, cancellation semantics, idempotency, request limits, retention, and current pricing could not be verified. Guessing those fields would violate the owner's explicit requirement and could create chargeable or privacy-unsafe behaviour.

The required Multer dependency could not be installed inside `backend/`: the configured npm registry request returned HTTP 403. No manifest or lockfile was changed by the failed install. Implementing an ad-hoc multipart parser instead would violate the explicit `memoryStorage` requirement.

The GitHub repository was also unreachable through the proxy and the checkout has no `origin`, preventing remote-head confirmation, push, and pull-request creation.

## Safe resumption checklist

1. Restore read access to the five official Pixelcut documentation pages and npm registry access.
2. Add/fetch `origin`, verify `origin/backend-development`, and recreate the Phase 10 branch from that exact head if it differs from the recorded baseline.
3. Capture the verified Pixelcut request/response and retention facts in backend documentation before implementation.
4. Install Multer only within `backend/`, then implement provider injection, photo validation, persisted opaque jobs/reservations, ownership, quotas, lifecycle routes, metrics, and mocked-HTTP tests.
5. Replace every production mock service branch with the existing Express endpoints, delete `frontend/src/mocks/` only after static reference checks pass, and integrate the asynchronous VTO UI without visual redesign.
6. Run both clean installs, backend tests/build/typecheck, frontend build/typecheck, secret/mock/root-lockfile checks, and a browser screenshot. Do not make a live Pixelcut request without separate owner approval.
