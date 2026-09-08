# Phase 2 schema mapping

## Phase 10 Virtual Try-On persistence

`VirtualTryOnJob` is privacy-minimal orchestration state, not a customer gallery. It stores the
opaque VESTRA job id, authenticated owner reference or hashed guest capability, idempotency and
request fingerprints, selected catalogue product/colour, Pixelcut job id, lifecycle state,
consent version/time, quota reservation, expiry, feedback, and the private Cloudinary asset
identifiers required for deletion. Customer image bytes/base64, the time-limited Cloudinary
download URL, raw provider payloads, credentials, body measurements, and provider error bodies
are never persisted. Result URLs are temporary provider references and carry an explicit expiry.

`VirtualTryOnQuota` atomically tracks UTC-day starts, active reservations and successful
completions per opaque owner. Per-job active/released IDs make quota release idempotent across
crashes. `VirtualTryOnAssetCleanup` is a separate durable, lease-based ledger for each temporary
Cloudinary public ID; it records only deletion state, retry timing and the quota-release marker.
`VirtualTryOnRateLimit` is a TTL-backed fixed-window counter.
Guest job access requires both the browser's session UUID and a per-job random capability whose
HMAC is stored; authenticated job access is scoped to `ownerUserId`.

Product images retain the existing DTO fields and may add backward-compatible `colour`,
`isTryOnReady`, and Cloudinary asset metadata. Only a published, stocked, VTO-enabled product
with an explicitly ready non-lifestyle garment image is eligible. Existing external catalogue
URLs remain valid catalogue data but are not implicitly declared suitable for try-on.

## Phase 9 derived recommendation responses

Recommendation groups are calculated from the existing Product, Order, and WishlistItem
collections and are never persisted as a separate recommendation database. Responses contain
only Product DTOs plus deterministic 0–1 scores and truthful explanations. Personal signals are
restricted to the authenticated user's wishlist, successful purchases, and purchased-size
snapshots; order popularity and co-occurrence are aggregate. There is no browsing-history
persistence, measurement-to-size inference, ML model, or external recommendation provider.
Wishlist and purchase affinity are calculated separately so wishlist-labelled results never use
purchase history as a substitute when the user's wishlist is empty.

## Phase 7 persistence notes

Admin catalogue and inventory endpoints mutate the existing `Product` and `Category` models;
there is no parallel admin catalogue. Category slug changes transactionally cascade to
`Product.category`, while deletions reject categories referenced by products or children.
Orders retain immutable item snapshots when products are deleted. `AdminAuditLog` is an
internal persistence-only model (`actorUserId`, action, entity type/id, safe metadata and
creation time) and deliberately has no frontend DTO or listing route.

All document schemas use the shared JSON transform: MongoDB `_id` becomes a string `id`, `__v` is removed, every `Date` becomes an ISO string, and every ObjectId reference (including array entries) becomes a string. The recursive rule also covers embedded identifiers.

| Model / schema | Frontend type | Persistence and response mapping |
|---|---|---|
| `User` | `User` | Persists identity, role, avatar, preferences, active state, embedded addresses, and timestamps. `passwordHash` is persistence-only and excluded from normal queries. Frontend `measurementProfile` is populated from `MeasurementProfile`; `wishlistIds` is derived from `WishlistItem` records in later service/auth phases. |
| `Address` (embedded) | `Address` | Embedded in users and snapshotted in orders; owns an embedded id. |
| `MeasurementProfile` | `MeasurementProfile` | Standalone, independently readable/updatable document with a unique User reference. Contains only the currently declared measurements, fit, units, and update date; no future ML inputs are assumed. |
| `Product` | `Product` | Product/category/collection strings are catalogue slugs, deliberately denormalised for frontend filtering and stable DTOs. Images and variants are embedded. Related products are ObjectId references. All other Product fields are persisted directly. |
| `Category`, `Collection` | same names | Persist directly; category `parentId` references another category. |
| `Review` | `Review` | Product/user are references; `userName` is a historical display-name snapshot. |
| `Cart` / `CartItem` | `Cart` / `CartItem` | Items embed product/variant references plus selection, quantity, and captured price. `product` and `deliveryOption` DTO objects are populated from references later. Cart ownership (`userId` or persistence-only `guestId`) is exclusive. |
| `WishlistItem` | `WishlistItem` | The single persisted wishlist source of truth: one unique user/product reference pair. DTO `product` is populated later, and `User.wishlistIds` is derived from these records. |
| `Order` / `OrderItem` | `Order` / `OrderItem` | Items, address, and delivery option are historical snapshots so later catalogue changes cannot alter an order. User is referenced; a guest instead supplies email. Totals/statuses/timestamps persist directly. |
| `DeliveryOption` | `DeliveryOption` | Active master delivery choices. `isActive` and `displayOrder` are persistence-only; orders embed a snapshot. |
| `AuthSession` | None (persistence-only) | Stores only a SHA-256 refresh-token hash, user reference, expiry and revocation time. Raw refresh tokens and session fields never enter a User DTO. An expiry TTL index removes old sessions. |

## Relationships and intentionally derived fields

Product `category`, optional `subcategory`, and optional `collection` match taxonomy slugs rather than ObjectIds. This makes the existing catalogue query contract direct while Category parentage remains referential. Cart/Wishlist product objects, Cart delivery option objects, User measurement profile, and User wishlist IDs are assembled in later service phases. Product aggregates (`rating`, `reviewCount`, `stockStatus`, colours, and available sizes) are denormalised read-optimised fields maintained by later catalogue/review services. Recommendation DTOs, VTO DTOs, size-form/results, dashboard metrics, and pagination/error wrappers are Phase 3+ service outputs, not Phase 2 documents.

## Phase 5 Cart and wishlist response assembly

Cart persistence retains exactly one owner (`userId` or the UUID-style `guestId` received in
`X-Guest-Cart-Id`). Services resolve every embedded product/variant reference on reads and
mutations, refresh `salePrice ?? price`, validate variant stock, and calculate all totals before
constructing the frontend `Cart` DTO. Ownership and persistence-only fields are omitted.

`POST /api/cart/merge` validates the complete guest/user result before saving the combined user
cart and removing the guest cart. Wishlist records remain the unique persistence source, while
`GET /api/wishlist` returns populated published `Product[]` to match `wishlistService.ts`.

## Phase 6 order response assembly

Checkout resolves a persisted user/guest cart inside a MongoDB transaction and creates immutable
product, variant, address, and canonical delivery snapshots. The service explicitly assembles the
frontend `Order`/`OrderItem` DTO, converts references to string ids, and omits persistence and cart
ownership internals. Prices, promo eligibility, delivery cost, totals, statuses, order number, and
working-day estimate are server-derived. Inventory, affected-product `stockStatus`, order creation,
and consumed-cart deletion commit or roll back together.

## Phase 4 User response assembly

The User DTO service starts with shared `frontendJson` output (which omits `passwordHash`),
loads `MeasurementProfile`, and derives `wishlistIds` from `WishlistItem.productId`. Tokens are
top-level additions only to register/login responses; session data never becomes a User field.
Address lists return `Address[]`; address mutations return the full updated User DTO.
