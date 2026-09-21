# Backend test suite

The automated test suite is intentionally curated around the highest-value product and integration behaviour.

Run from `backend/`:

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Current scope

The backend suite contains **91 test cases**. The ML service contains **9 test cases**, giving **100 automated test cases across the project**.

| Test file | Cases | Main coverage |
|---|---:|---|
| `auth.test.ts` | 17 | registration, login, tokens, authentication failures |
| `catalogue.test.ts` | 5 | product listing, filters, public product endpoints, visibility, categories/collections |
| `cartWishlist.test.ts` | 11 | cart and wishlist user flows |
| `orders.test.ts` | 11 | checkout, order creation, stock and order behaviour |
| `adminProducts.test.ts` | 7 | admin product creation and product validation |
| `sizeRecommendation.test.ts` | 8 | backend-to-ML size recommendation flow and validation |
| `virtualTryOn.test.ts` | 23 | VTO validation, quota, privacy, job lifecycle and cleanup |
| `virtualTryOnChain.test.ts` | 1 | cumulative multi-product VTO chaining |
| `virtualTryOnProvider.test.ts` | 8 | Pixelcut/Cloudinary provider mappings and safe error handling |

The ML service keeps its 8 API tests plus 1 visualisation test.

## Tooling

| Concern | Choice |
|---|---|
| Runner | Vitest |
| HTTP assertions | Supertest |
| Database | mongodb-memory-server |
| ML runner | pytest |

## Database isolation

`tests/globalSetup.ts` starts one in-memory MongoDB instance for the run. `tests/setup.ts` connects test files to that isolated database and drops it between files. Tests use `createApp()` and do not import `src/server.ts`, so they do not bind a real port or open the production database connection.

## External-provider isolation

Virtual Try-On tests use injected Pixelcut and Cloudinary doubles or mocked transports. The automated suite does not consume live Pixelcut generations or upload test images to the production Cloudinary account.
