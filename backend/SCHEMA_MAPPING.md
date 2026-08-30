# Phase 2 schema mapping

All document schemas use the shared JSON transform: MongoDB `_id` becomes a string `id`, `__v` is removed, and every `Date` becomes an ISO string. The same recursive rule covers embedded identifiers.

| Model / schema | Frontend type | Persistence and response mapping |
|---|---|---|
| `User` | `User` | Persists identity, role, avatar, preferences, active state, embedded addresses/profile, timestamps and product references in `wishlistIds`. `passwordHash` is persistence-only and excluded from normal queries. |
| `Address` (embedded) | `Address` | Embedded in users and snapshotted in orders; owns an embedded id. |
| `MeasurementProfile` (embedded) | `MeasurementProfile` | Contains only the currently declared measurements, fit, units and update date. `userId` references its owner. No future ML inputs are assumed. |
| `Product` | `Product` | Product/category/collection strings are catalogue slugs, deliberately denormalised for frontend filtering and stable DTOs. Images and variants are embedded. Related products are ObjectId references. All other Product fields are persisted directly. |
| `Category`, `Collection` | same names | Persist directly; category `parentId` references another category. |
| `Review` | `Review` | Product/user are references; `userName` is a historical display-name snapshot. |
| `Cart` / `CartItem` | `Cart` / `CartItem` | Items embed product/variant references plus selection, quantity and captured price. `product` and `deliveryOption` DTO objects are populated from references later. Cart ownership (`userId` or persistence-only `guestId`) is exclusive. |
| `WishlistItem` | `WishlistItem` | One user/product reference pair. DTO `product` is populated later. `User.wishlistIds` is a derived compatibility projection and is not a second writable source of truth. |
| `Order` / `OrderItem` | `Order` / `OrderItem` | Items, address and delivery option are historical snapshots so later catalogue changes cannot alter an order. User is referenced; a guest instead supplies email. Totals/statuses/timestamps persist directly. |
| `DeliveryOption` | `DeliveryOption` | Active master delivery choices. `isActive` and `displayOrder` are persistence-only; orders embed a snapshot. |

## Relationships and intentionally derived fields

Product `category`, optional `subcategory`, and optional `collection` match taxonomy slugs rather than ObjectIds. This makes the existing catalogue query contract direct while Category parentage remains referential. Cart/Wishlist product objects and Cart delivery option objects are populated by later service phases. Product aggregates (`rating`, `reviewCount`, `stockStatus`, colours and available sizes) are denormalised read-optimised fields maintained by later catalogue/review services. Recommendation DTOs, VTO DTOs, size-form/results, dashboard metrics and pagination/error wrappers are Phase 3+ service outputs, not Phase 2 documents.
