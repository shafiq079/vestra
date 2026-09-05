# Phase 2 schema mapping

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

## Phase 4 User response assembly

The User DTO service starts with shared `frontendJson` output (which omits `passwordHash`),
loads `MeasurementProfile`, and derives `wishlistIds` from `WishlistItem.productId`. Tokens are
top-level additions only to register/login responses; session data never becomes a User field.
Address lists return `Address[]`; address mutations return the full updated User DTO.
