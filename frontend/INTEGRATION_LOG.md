# Phase 10 frontend integration log

## Production API authority

The owner retired `VITE_USE_MOCK_API` in Phase 10. Every implemented domain now uses the Express
API at `VITE_API_BASE_URL` (default `http://localhost:5000/api`): authentication/profile,
catalogue/taxonomy, cart, authenticated wishlist, checkout/orders, admin, reviews, Phase 9
recommendations, and Virtual Try-On. `frontend/src/mocks/` and all production mock branches were
removed. Failures are shown as failures; services do not fabricate success responses.

Legitimate browser-local state remains local: the guest cart identifier, unauthenticated guest
wishlist, and the VTO guest session UUID. No customer photograph, result image, provider URL,
credential or body measurement is persisted in localStorage/sessionStorage.

## Virtual Try-On

The existing fitting-room layout, product picker, colour selection, upload presentation and result
card now drive the real Express lifecycle. Submission sends multipart image data, explicit consent,
the MongoDB product id and selected colour. Express—not the browser—selects the garment image.
The page polls the existing job, supports cancellation and persisted helpful/not-helpful feedback,
expires temporary results, and invalidates stale results whenever the product, colour or photo
changes. Add to Bag requires a valid selected in-stock variant and an explicit size.

Consent/privacy copy identifies VESTRA, Cloudinary and Pixelcut; explains temporary storage and
best-effort lifecycle cleanup; avoids promising immediate provider deletion; and states that an AI
preview is visual guidance rather than a guarantee of fit, colour, size or exact garment detail.

## Truthful unavailable states

- Phase 13 ML size recommendation remains unavailable and does not return a fake result.
- The backend has no detailed public review-list route, so the production service returns an empty
  detailed list while catalogue rating/review-count summaries remain authoritative.
- Demo-account buttons prefill only public email addresses; passwords are never shipped in the
  frontend bundle.

## Verification boundary

Phase 10 verification uses frontend TypeScript/build checks and backend Express integration tests
with mocked Pixelcut/Cloudinary transports. No live chargeable Pixelcut generation, real Cloudinary
upload, deployed Atlas connection or deployed browser end-to-end flow is claimed. Those require
private environment configuration and a separately approved smoke test.

## Design regression statement

Phase 10 changes production data orchestration and truthful copy, not VESTRA's visual identity.
Typography, colours, page layouts, navigation, spacing, responsive behaviour, storefront/admin
separation and the product-page commerce hierarchy remain intact.
