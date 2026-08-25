# VESTRA — Backend Implementation Plan

**Status:** Phase 0A complete · Phase 0B complete · **Phase 1 complete and merged** · **Phase 2 is next (not started)**
**Integration branch:** `backend-development` — every phase is developed on its own scoped branch and merged in by pull request
**Scope owner:** project owner (dissertation author)

This document records the agreed, ordered sequence for building the VESTRA backend. It is the single source of truth for *what happens when*. The working agreement — scope boundaries, contracts, secret handling and Git workflow — lives in [AGENTS.md](../AGENTS.md), which is authoritative for *how* work is done.

Phases are executed **one at a time, in order**. A phase is not started until its dependencies are met and the owner has requested it.

---

## Target architecture

Core request path:

```
React frontend  →  Express REST API  →  MongoDB Atlas
   (Vite/TS)         (Node + TS)          (Mongoose)
```

Added later, both strictly server-mediated:

```
Express  →  external Virtual Try-On provider        (Phase 10)
Express  →  Python ML size-recommendation service   (Phase 13)
```

The browser talks only to Express. It never holds a provider or model credential, and it never calls an external AI service directly. Every outbound integration is proxied so secrets stay server-side and can be rate-limited, logged, and swapped.

### Contract direction

The frontend already exists and defines the contract. **The backend conforms to the frontend.**

| Concern | Fixed by |
|---|---|
| DTO shapes | `frontend/src/types/index.ts` |
| Base path | `/api` (`apiClient.ts` defaults to `http://localhost:5000/api`) |
| Auth transport | `Authorization: Bearer <token>` |
| Error body | `{ code, message, details? }` |
| Route names | the 11 modules in `frontend/src/services/` |
| Mock toggle | `VITE_USE_MOCK_API` must keep working |

### Repository and deployment layout — two independent applications

One Git repository, **two independent npm applications**. This is fixed. **npm workspaces are not used and must not be reintroduced.**

| Application | Own manifest + lockfile | Deploys to | Deployment root |
|---|---|---|---|
| `frontend/` | `frontend/package.json` + `frontend/package-lock.json` | Vercel | `frontend/` |
| `backend/` | `backend/package.json` + `backend/package-lock.json` | Render | `backend/` |

Consequences that bind every phase:

- **No root `package-lock.json`.** Dependency locking lives inside each application only.
- **No `workspaces` field in the root `package.json`.**
- Each application installs from **its own** manifest and lockfile. `cd frontend && npm ci` and `cd backend && npm ci` must each succeed on their own, with no root `node_modules` present.
- **Backend dependencies are installed inside `backend/`** and update `backend/package-lock.json` only. Never install a backend dependency from the repository root.
- Root `package.json` scripts are **developer convenience wrappers only**, delegating with `npm --prefix <dir> run <script>` — never `--workspace`.
- Committed lockfiles must stay **portable** for Vercel/Render Linux builds. Never repair a local install by hand-placing packages into `node_modules`, and never report a build as passing when it only passes because of out-of-lockfile binaries.

---

## Testing policy — tests start at Phase 1, not Phase 11

Testing is **incremental and continuous from Phase 1 onward**. It is not deferred to a single phase at the end.

- **Phase 1** introduces the backend test tooling and the first tests (health endpoint, 404 handler, error-shape contract).
- **Phases 2–10** each add tests covering the functionality that phase introduces. A phase is not complete until its own tests exist and pass.
- **Phase 11** is the *comprehensive* regression, security, authorisation, validation and hardening phase. It deepens, audits, and closes gaps in an already-tested codebase — it is explicitly **not** the first introduction of testing.

Consequence: by the time Phase 11 begins, every route group already has working tests. Phase 11's job is cross-cutting assurance, not catch-up.

---

## Phase index

| Phase | Title | Depends on | Status |
|---|---|---|---|
| 0A | Development setup — governance and architecture documents | — | **Complete** |
| 0B | Development setup — independent `backend/package.json` + `backend/package-lock.json`, root `workspaces` removed (no scripts) | 0A | **Complete** |
| 1 | Express/TypeScript foundation + MongoDB connection + health endpoint + test tooling + root backend scripts | 0A **and** 0B | **Complete and merged** |
| 2 | Database/schema design | 1 | **Next — not started** |
| 3 | Product catalogue, categories and collections API | 2 | Not started |
| 4 | Authentication, users, profiles and addresses | 2 | Not started |
| 5 | Cart and wishlist | 3, 4 | Not started |
| 6 | Checkout, orders and inventory updates | 3, 4, 5 | Not started |
| 7 | Admin APIs | 3, 4, 6 | Not started |
| 8 | Gradual frontend/backend integration | 3–7 | Not started |
| 9 | Product recommendations | 3, 6 | Not started |
| 10 | Virtual Try-On backend/provider abstraction | 1, 3, 4 | Not started |
| 11 | Comprehensive regression, security, authorisation, validation and hardening | 1–10 (all already carry their own tests) | Not started |
| 12 | Backend deployment and production configuration | 11 | Not started |
| 13 | ML Size Recommendation integration (**LAST**) | 12 + client-supplied model | Blocked — awaiting client model |
| 14 | Final end-to-end/dissertation validation | 13 | Not started |

---

## Phase 0 — Development setup and architecture

Phase 0 is split into two explicit steps. **0A is documentation only and is complete. 0B is the first step permitted to touch build configuration, and only on explicit request.**

### Phase 0A — Governance and architecture documents

**Objective**
Establish the governance, scope boundaries, and agreed roadmap for backend development before any code or configuration is written, so that later work is controlled and reviewable rather than exploratory.

**Main deliverables**
- A root working-agreement document: backend development authorised, `backend/` as primary write scope, frontend read-only, stack fixed, secret-handling rules, one-task-at-a-time workflow, Git restrictions. Delivered at the time as `CLAUDE.md`; **since consolidated into [AGENTS.md](../AGENTS.md)**, which is now the authoritative working agreement. `CLAUDE.md` is retained only as a pointer.
- `backend/IMPLEMENTATION_PLAN.md` (this document): the full Phase 0A–14 sequence with objectives, deliverables, dependencies, and completion criteria.
- Confirmation of the existing `backend/` scaffold: `src/{config,controllers,middleware,models,routes,services,utils,validators}`, `tests/`, `uploads/`.
- Confirmation that `.gitignore` already excludes `.env` and `.env.*` while permitting `.env.example`.
- Recorded finding: at the time of Phase 0A the root `package.json` carried a `workspaces` array and `backend/` contained no `package.json`. Both were addressed in Phase 0B — which, after the owner's later decision, **removed the root `workspaces` field entirely** and gave `backend/` its own independent manifest and lockfile instead.

**Dependencies**
None. This is the entry step.

**Completion criteria**
- Both documents exist and are internally consistent with `AGENTS.md`.
- No source code, dependency, or `package.json` change has been made.
- No `.env` contents have been read or displayed.
- `git status` shows only the new documentation files, and `git diff --check` is clean.

### Phase 0B — Independent backend package (no workspaces)

**Objective**
Give `backend/` its own self-contained npm package — its own `package.json` and its own `package-lock.json` — so that Phase 1 can install backend dependencies entirely inside `backend/`, without npm workspaces and without any shared dependency tree. **Package independence only: no scripts, no dependencies, no code.**

> **Superseded approach — do not restore.** An earlier iteration of this phase registered `backend` in a root `workspaces` array and let both applications share one root `package-lock.json`. That was **reversed** by owner decision in favour of two fully independent applications (see *Repository and deployment layout* above). The root `package.json` now has **no `workspaces` field**, there is **no root `package-lock.json`**, and neither may be reintroduced.

> **Phase 0B and Phase 1 are the only steps before Phase 8 that may modify the root `package.json`, and each may do so *only* when the project owner explicitly requests that phase's implementation.** Phase 0B removes the `workspaces` field and converts the frontend convenience scripts to `npm --prefix`; Phase 1 may add the backend-delegating scripts. Recording the intent here is not authorisation to act on it.

**Why no scripts in this phase:** a root `dev:backend` or `test:backend` script would delegate to a `backend` script that does not exist yet, so it would be broken from the moment it was written. Root convenience scripts are therefore created in **Phase 1**, at the same time as the backend scripts they call.

**Main deliverables — exactly five things**
1. **A minimal `backend/package.json`**, so that `backend/` is an installable package in its own right:
   - metadata only — `name`, `version`, `description`
   - `"private": true`, matching the root and frontend convention
   - **no `dependencies` and no `devDependencies`** — nothing is installed in this phase
   - **no `scripts`** — the real `dev` / `build` / `start` / `test` scripts are Phase 1's job
   - **no backend source code, no `tsconfig.json`, no entry point** — this phase creates a manifest, not an application
2. **A `backend/package-lock.json` belonging only to `backend`**, generated by running `npm install` **inside `backend/`**. With no dependencies declared it is a minimal lockfile recording just the root package — that is correct and expected.
3. **Remove the `workspaces` field from the root `package.json` entirely**, and convert the existing frontend convenience scripts from workspace syntax to independent prefix syntax — `npm --prefix frontend run dev` / `build` / `preview`. **No new root scripts**; the root manifest declares no dependencies and exists purely as developer convenience.
4. **Delete the root `package-lock.json`.** Dependency locking lives only in `frontend/package-lock.json` and `backend/package-lock.json`.
5. **Ensure `frontend/package-lock.json` is valid and in sync with `frontend/package.json`.** If it is stale, synchronise it with `npm install --package-lock-only` (which preserves existing pins). `frontend/package.json` itself must not change, dependencies must not be intentionally upgraded, and `npm audit fix` must not be run.

**Supporting notes (not code changes)**
- The recorded layout decision: **two independent applications, one lockfile each, no workspaces** — chosen so `frontend/` deploys to Vercel and `backend/` deploys to Render from their own subdirectory roots, each installing only what it needs.
- Any `.gitignore` addition the backend build genuinely needs (e.g. compiled `backend/dist`) is *proposed for owner approval*, not applied silently. Note that the existing root `.gitignore` already ignores `dist` at any depth, so this may well be unnecessary.

**Dependencies**
Phase 0A (governance and plan agreed). No dependency on Phase 1 — Phase 0B strictly precedes it, because Phase 1 needs a `backend/package.json` and `backend/package-lock.json` to install into.

**Completion criteria**
- The owner explicitly requested this step before any `package.json` change was made.
- `backend/package.json` exists, is `private: true`, carries metadata only, and declares **no** dependencies, **no** devDependencies, and **no** scripts.
- `backend/package-lock.json` exists and belongs only to `backend`.
- No backend source file, `tsconfig.json`, or entry point was created in this phase.
- The root `package.json` has **no `workspaces` field**, and its `dev` / `build` / `preview` scripts use `npm --prefix frontend`. No `dev:backend`, `build:backend`, `test:backend`, or `start:backend` script was added here.
- **No root `package-lock.json` exists.**
- `cd frontend && npm ci` succeeds, and `cd frontend && npm run build` succeeds — from `frontend/` alone, with no root `node_modules` present.
- `cd backend && npm ci` succeeds.
- Root `npm run build` still builds the frontend, delegating via `npm --prefix frontend`.
- `frontend/package.json` is unmodified; any `frontend/package-lock.json` change is a synchronisation, not an upgrade.
- Committed lockfiles are **portable** — they contain the Linux native platform packages the Vercel/Render builds need, and no install or build was made to pass by hand-placing packages into `node_modules`.
- The layout decision is written down.
- No secret and no `.env` file entered the index.

---

## Phase 1 — Express/TypeScript backend foundation + MongoDB connection + health endpoint + test tooling

**Objective**
Stand up a minimal, type-safe, runnable Express server that connects to MongoDB Atlas and proves the whole path is alive via a health endpoint — no business logic yet — **and establish the test harness that every subsequent phase will extend.**

**Main deliverables**
- **Complete the existing `backend/package.json`** created in Phase 0B — this phase extends that manifest rather than creating it. Add the runtime and dev dependencies, the real scripts, and any engine or entry-point fields needed. Keep `private: true`. **Install from inside `backend/`**, so only `backend/package-lock.json` changes — never install backend dependencies from the repository root, and never add a `workspaces` field.
- `backend/tsconfig.json` (strict mode) — created in this phase.
- Runtime dependencies: `express`, `mongoose`, `dotenv`, `cors`, `helmet`, `morgan`. Dev: `typescript`, `ts-node`/`tsx`, `nodemon`, `@types/*`.
- Application entry split into `app.ts` (middleware + router wiring, exportable for tests) and `server.ts` (listen + lifecycle), so the app can be tested without binding a port.
- `src/config/env.ts` — schema-validated environment loading that fails fast with a clear message on a missing variable and **never logs a secret value**.
- `src/config/database.ts` — Mongoose connection to MongoDB Atlas with connection-event logging and graceful shutdown on `SIGINT`/`SIGTERM`.
- `GET /api/health` returning service status, uptime, and database connection state.
- Centralised error-handling middleware and a 404 handler emitting exactly `{ code, message, details? }`.
- CORS configured for the Vite dev origin.
- `backend/.env.example` documenting every required variable **by name and purpose only** (e.g. `PORT`, `MONGODB_URI`, `NODE_ENV`, `CORS_ORIGIN`).
- `npm run dev` / `npm run build` / `npm start` scripts; server listens on port 5000 to match the frontend default.
- **Root convenience scripts, created here — not in Phase 0B — because they delegate to the backend scripts this phase introduces.** Add `dev:backend`, `build:backend`, `test:backend`, and `start:backend` if useful to the root `package.json`, each delegating via `npm --prefix backend run <script>` to match the existing frontend delegation style. **Never `--workspace`** — there are no workspaces. Every new root script must be runnable the moment it is added — a root script pointing at a non-existent backend script is a defect, not a placeholder. The existing `dev` / `build` / `preview` scripts must keep their current names and behaviour, unchanged.

**Test deliverables (the harness all later phases build on)**
- Test runner configured for TypeScript — Jest or Vitest — with `supertest` for HTTP-level assertions against the exported `app`, plus a `npm test` script added to `backend/package.json`.
- Isolated test database strategy chosen and wired now (in-memory MongoDB or a dedicated Atlas test database) so no test ever touches development or production data.
- Test directory structure established under `backend/tests/`, with the convention documented so later phases drop their tests into a known place.
- Initial tests: `GET /api/health` returns 200 with the expected body; an unknown route returns 404 in the `{ code, message, details? }` shape; a deliberately thrown error returns the same shape and no stack trace.
- Confirmation that the suite runs green from a clean checkout with no manual setup beyond environment variables.

**Dependencies**
**Phase 0A and Phase 0B — both unconditionally.** Phase 0A supplies the agreed governance and plan; Phase 0B supplies the independent `backend/package.json` and `backend/package-lock.json` this phase extends and installs into. Phase 0B cannot be bypassed: installing dependencies into `backend/` before it is a valid standalone package is out of sequence.

**Completion criteria**
- `backend/package.json` has been extended in place — Phase 0B's `private: true` metadata is preserved, not overwritten by a freshly generated manifest.
- `npm run build` compiles with zero TypeScript errors under strict mode.
- `npm run dev` starts cleanly and logs a successful MongoDB Atlas connection.
- **Every root convenience script added in this phase actually runs** — `dev:backend`, `build:backend`, `test:backend`, and `start:backend` if added, each verified against the corresponding backend script rather than assumed to work.
- **The existing root `dev`, `build`, and `preview` scripts still behave exactly as before** for the frontend, and `frontend/package.json` is unmodified.
- `GET /api/health` returns 200 with a healthy database state.
- An unknown route returns 404 in the agreed error shape; a thrown error returns the same shape, not an HTML stack trace.
- **`npm test` runs and passes, with the health, 404, and error-shape tests present and green — real output reported.**
- **Tests run against the isolated test database, demonstrably not the development database.**
- No secret appears in source, logs, test fixtures, or documentation.
- The frontend still builds and still runs unchanged in mock mode.

**Implementation status — complete and merged**

Delivered and merged into `backend-development`. What was actually verified, and what was not:

*Verified*
- The Express 5 / TypeScript foundation is complete: `app.ts` / `server.ts` split, `src/config/env.ts` (Zod, fail-fast, secret-safe), `src/config/database.ts` (Mongoose connection, events, graceful shutdown), `GET /api/health`, the centralised error handler and 404 handler emitting `{ code, message, details? }`, CORS, and `helmet`.
- `npm run build` and `npm run typecheck` both pass with zero TypeScript errors under strict mode.
- **31 backend tests pass** (Vitest + Supertest, 4 files), covering the health endpoint, the 404 shape, the error-shape contract with no stack leakage, the lifecycle/shutdown routine, and the test-database isolation guarantees themselves.
- The health, error and runtime boot flow was exercised end to end — including a real server start returning `200` from `GET /api/health` with `database.status: "connected"` — **against an isolated `mongodb-memory-server` instance**.
- Tests run against that isolated in-memory database, demonstrably not a development or production database. See [tests/README.md](tests/README.md).

*Not verified — environment limitation*
- **A real MongoDB Atlas connection was not established or verified on the development machine.** `mongodb+srv://` resolution fails there: `A` lookups succeed but the `SRV` and `TXT` lookups that the `+srv` scheme is defined in terms of time out or return no data, against the LAN resolver and public resolvers alike.
- This was diagnosed as an **environment/network DNS limitation, not an application-code failure**. It is not a credential problem and not an Atlas IP access-list problem — both were checked and ruled out. The connection code itself is unmodified by this finding and already accepts Atlas's standard (non-`+srv`) connection string, which is the available workaround on such a machine.
- Consequently the Phase 1 completion criterion *"`npm run dev` starts cleanly and logs a successful MongoDB Atlas connection"* is satisfied against the in-memory MongoDB only. **Atlas connectivity remains an open deployment/environment verification item**, to be confirmed on a network that permits `SRV`/`TXT` resolution and closed out as part of **Phase 12** (deployment and production configuration), where the deployed `/api/health` must report a healthy Atlas connection.
- **MongoDB Atlas remains the intended database for the project** — target architecture unchanged.
- **This does not change the Phase 2 implementation scope.** Phase 2 is schema/model design and its tests run against the same isolated in-memory database, so it is not blocked by the Atlas gap.

---

## Phase 2 — Database/schema design

**Objective**
Model the full domain in Mongoose so that persisted documents map cleanly onto the frontend's existing TypeScript types, before any endpoint depends on the shape.

**Main deliverables**
- Mongoose models under `src/models/`: `User`, `Address` (embedded), `MeasurementProfile`, `Product`, `ProductImage`/`ProductVariant` (embedded), `Category`, `Collection`, `Review`, `Cart`/`CartItem`, `WishlistItem`, `Order`/`OrderItem`, `DeliveryOption`.
- Field-level validation, enums matching the frontend union types exactly (`OrderStatus`, `PaymentStatus`, `StockStatus`, `GenderCollection`, `ProductBadge`, `FitFeedback`, `UserRole`), and sensible defaults.
- Indexes for the queries the frontend actually performs: product `slug` (unique), category/collection `slug` (unique), user `email` (unique), a text index for product search, and compound indexes for catalogue filtering and sorting.
- A documented mapping table: Mongoose document → frontend type, including how `_id` is serialised to the `id: string` the frontend expects, and how `Date` fields are serialised to the ISO strings the frontend expects.
- Timestamp strategy (`createdAt`/`updatedAt`) consistent with the frontend types.
- Placeholder-free schema for later phases: no ML input fields are frozen into `MeasurementProfile` beyond what the frontend already declares.
- A seed/import script capable of loading the existing frontend mock catalogue into MongoDB, so Phase 3 has realistic data and the dissertation demo stays consistent.

**Test deliverables (this phase's functionality)**
- Model-level tests: required-field enforcement, enum rejection of out-of-range values, default application, and unique-index violation behaviour.
- Serialisation tests proving `_id` → `id: string` and `Date` → ISO string, so persisted documents satisfy the frontend types.
- A seed-script test or verified run asserting expected document counts and a spot-checked document shape.
- Reusable test fixtures/factories for the core models, so Phases 3–10 do not each reinvent test data.

**Dependencies**
Phase 1 (connection, TypeScript build, and test harness available).

**Completion criteria**
- All models compile and register without warnings.
- Every field in the frontend types is either represented, deliberately derived, or explicitly documented as out of scope.
- The seed script populates MongoDB Atlas and the resulting documents serialise into objects assignable to the frontend types.
- Indexes verified as created; unique constraints demonstrably reject duplicates.
- **Model, serialisation, and seed tests added and passing; the whole suite still green.**
- No endpoint has been added in this phase.

---

## Phase 3 — Product catalogue, categories and collections API

**Objective**
Deliver the read-side catalogue API — the largest surface the storefront consumes — at the exact paths the frontend already calls.

**Main deliverables**
- Product routes: `GET /api/products` (filtering, sorting, pagination), `GET /api/products/:slug`, `/products/featured`, `/products/new`, `/products/sale`, `/products/search?q=`, `GET /api/products/:id/related`, and the `?category=`, `?genderCollection=`, `?collection=`, `?tryOnEligible=true` query forms.
- Category and collection routes: `GET /api/categories`, `GET /api/categories/:slug`, `GET /api/categories?parentId=`, `GET /api/collections`, `GET /api/collections/:slug`.
- Filter support covering `FilterState`: category, size, colour, price range, brand, fit, rating, availability, on-sale, VTO-eligible, size-rec-eligible, gender collection, search term, sort option.
- `PaginatedResult<T>` responses shaped exactly as the frontend type declares (`items`, `total`, `page`, `pageSize`, `totalPages`).
- Controller / service / validator separation: no database queries in route files, no business logic in controllers.
- Unpublished products excluded from all public endpoints.

**Test deliverables (this phase's functionality)**
- Integration tests for every catalogue route named in `productService.ts` and `categoryService.ts`.
- Filter, sort, and pagination tests including boundary cases: page 1, last page, page beyond the end, empty result set, and combined filters.
- Tests asserting responses match the `Product`, `Category`, `Collection`, and `PaginatedResult<T>` shapes.
- Negative tests: malformed query parameters return 400 in the agreed error shape, and an unknown slug returns 404 — never a 500.
- A test proving an unpublished product is unreachable from every public catalogue route.

**Dependencies**
Phase 2 (models, indexes, seed data, fixtures).

**Completion criteria**
- Every catalogue endpoint named in `frontend/src/services/productService.ts` and `categoryService.ts` responds correctly against seeded data.
- Responses validate against the frontend `Product`, `Category`, `Collection`, and `PaginatedResult<T>` types.
- Filter and sort combinations return correct results; pagination maths verified at boundaries.
- Invalid query parameters return 400 in the agreed error shape, not a 500.
- Unpublished products are provably unreachable from public routes.
- **Catalogue route tests added and passing, including the unpublished-exclusion and negative cases; the whole suite still green.**
- No frontend file has been modified.

---

## Phase 4 — Authentication, users, profiles and addresses

**Objective**
Replace mock authentication with real, secure server-side authentication and account management, while keeping the frontend's existing token-based transport working untouched.

**Main deliverables**
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, plus logout/refresh handling as agreed.
- Password hashing with `bcrypt` and a sensible cost factor; passwords never returned, logged, or included in any response.
- JWT issuing and verification with the secret sourced from validated env config; token payload carries user id and role only.
- `authenticate` middleware and `authoriseRole('admin')` middleware mapping onto the frontend's existing customer/admin route-guard distinction.
- Profile endpoints: read/update user details, marketing opt-in.
- Address CRUD with default-address handling matching the `Address` type.
- Measurement-profile read/update, kept **schema-driven and model-agnostic** — no ML input set is frozen here (see Phase 13).
- Validation on every input; generic, non-enumerating responses for failed login and forgotten-password requests.
- Demo customer and demo admin accounts preserved so the dissertation demonstration path still works.

**Test deliverables (this phase's functionality)**
- Integration tests for register, login, `me`, and forgot-password, including the full register → login → authenticated-request flow.
- Token tests: missing, malformed, expired, and tampered tokens each rejected with the correct status and error shape.
- Role tests: a customer token rejected on an admin-only test route; an admin token accepted.
- Tests asserting no response body ever contains a password, hash, or signing secret.
- Address CRUD tests including default-address reassignment.
- Measurement-profile read/update tests that assert **no fixed ML input set is required** — only what the caller supplies within the declared type.
- Authenticated-request test helpers (token minting, `authedRequest`) for reuse by Phases 5–10.

**Dependencies**
Phase 2 (`User`, `Address`, `MeasurementProfile` models, fixtures). Independent of Phase 3.

**Completion criteria**
- Register → login → authenticated request succeeds end to end.
- Stored passwords are hashes; no password or token secret appears in any response or log.
- Protected routes reject missing, malformed, and expired tokens with the correct status and error shape.
- Admin-only routes reject a customer token.
- Demo accounts still authenticate.
- Responses assignable to the frontend `User`, `Address`, and `MeasurementProfile` types.
- **Auth, token, role, and address tests added and passing; the whole suite still green.**

---

## Phase 5 — Cart and wishlist

**Objective**
Persist cart and wishlist state server-side, with server-authoritative pricing and stock validation.

**Main deliverables**
- Cart routes: `POST /api/cart/items`, `PATCH /api/cart/items/:itemId`, `DELETE /api/cart/items/:itemId`, `DELETE /api/cart`, `GET` cart, `POST /api/cart/promo`, promo removal.
- Wishlist routes: `GET /api/wishlist`, `POST /api/wishlist/toggle`.
- Server-side recalculation of `subtotal`, `discount`, and `estimatedTotal` — client-supplied prices are never trusted.
- Variant-level stock validation on add and on quantity change, including rejection of quantities exceeding available stock.
- Promo-code validation and application rules.
- Cart identity strategy for authenticated users, plus the agreed guest-cart approach and merge-on-login behaviour.
- Populated `product` objects on cart and wishlist items, as the frontend `CartItem` and `WishlistItem` types require.

**Test deliverables (this phase's functionality)**
- Integration tests for add, update quantity, remove, clear, and read cart, asserting persistence across requests.
- Unit tests for the totals calculation: `subtotal`, `discount`, `estimatedTotal`, with and without a promo code.
- A test proving a client-supplied price is ignored and the server price is used instead.
- Stock-validation tests: adding beyond available stock and adding an out-of-stock variant are both rejected with the correct error shape.
- Promo-code tests: valid, invalid, and expired/ineligible codes.
- Wishlist toggle tests asserting idempotency in both directions.
- Guest-cart and merge-on-login tests.

**Dependencies**
Phase 3 (products and variants), Phase 4 (user identity and auth test helpers).

**Completion criteria**
- Add, update, remove, and clear all behave correctly and persist across requests.
- Totals are computed on the server and match expected values including promo discounts.
- Out-of-stock and over-quantity requests are rejected with a clear, correctly shaped error.
- Wishlist toggle is idempotent in both directions.
- Responses assignable to the frontend `Cart`, `CartItem`, and `WishlistItem` types.
- Guest→authenticated cart merge behaves as agreed.
- **Cart, totals, stock-validation, promo, wishlist, and merge tests added and passing; the whole suite still green.**

---

## Phase 6 — Checkout, orders and inventory updates

**Objective**
Turn a validated cart into a persisted order, decrementing inventory atomically so stock cannot go negative.

**Main deliverables**
- `POST /api/orders` (checkout), `GET /api/orders`, `GET /api/orders/:orderId`.
- Full checkout validation: shipping address, delivery option, item availability, and server-side recomputation of `subtotal`, `discount`, `deliveryCost`, and `total`.
- Human-readable unique `orderNumber` generation.
- Atomic variant-level stock decrement with a guard against overselling under concurrent checkout, and a documented rollback path if any step fails.
- Derived `stockStatus` recalculation (`in_stock` / `low_stock` / `out_of_stock`) after inventory movement.
- `OrderStatus` and `PaymentStatus` lifecycle handling, with payment modelled as a clearly documented simulated step for the dissertation artefact (no real payment processing).
- Guest checkout via `guestEmail` alongside authenticated checkout, matching the `Order` type.
- Order ownership enforcement: a user can read only their own orders.
- Estimated-delivery calculation from the chosen delivery option.

**Test deliverables (this phase's functionality)**
- Integration test for the full checkout flow: seeded cart → `POST /api/orders` → persisted order with correct totals and a unique order number.
- Inventory tests: stock decrements exactly once per order; `stockStatus` is recalculated correctly across the `in_stock` / `low_stock` / `out_of_stock` boundaries.
- A concurrency test attempting two simultaneous checkouts of the last unit, asserting exactly one succeeds and stock never goes negative.
- A rollback test: a checkout that fails partway leaves no order and no stock change.
- Ownership tests: user A requesting user B's order id receives 403/404 and no order data.
- Guest-checkout tests via `guestEmail`.
- Order-number uniqueness test under repeated creation.

**Dependencies**
Phase 3 (products), Phase 4 (users/addresses), Phase 5 (cart and totals).

**Completion criteria**
- A cart converts to a persisted order with correct totals and a unique order number.
- Inventory decrements exactly once per order; concurrent checkout of the last unit does not oversell.
- Checkout with an unavailable item is rejected before any stock is written.
- Order history and order detail return only the requesting user's orders; another user's order id returns 403/404, never data.
- Guest checkout works.
- Responses assignable to the frontend `Order` and `OrderItem` types.
- The simulated nature of payment is documented, not disguised.
- **Checkout, inventory, concurrency, rollback, and ownership tests added and passing; the whole suite still green.**

---

## Phase 7 — Admin APIs

**Objective**
Provide the admin management surface the existing admin UI already expects, protected by role-based authorisation.

**Main deliverables**
- Dashboard: `GET /api/admin/dashboard` returning the `AdminDashboardMetrics` shape (revenue, orders, average order value, customers, products, VTO usage, size-rec usage — the last two reported honestly as zero/unavailable until Phases 10 and 13 land).
- Product management: list, get by id, create, update, delete, duplicate, `PATCH .../published`, `POST .../bulk/publish`, `POST .../bulk/delete`, catalogue reset.
- CSV import endpoint with row-level validation and a per-row error report.
- Category management: list, create, update, delete, including safe handling of a category still in use.
- Inventory: `GET /api/admin/inventory` and `PATCH /api/admin/inventory/:productId/variants/:variantId`.
- User management, order management (status transitions), review moderation, and promotions endpoints as the admin services expect.
- `authoriseRole('admin')` on every admin route; admin mutations audit-logged without logging secrets or personal data beyond what is necessary.
- Single-source-of-truth guarantee: admin catalogue writes and storefront catalogue reads hit the same collections, so an admin change is visible on the storefront (mirroring the shared-mock rule in `AGENTS.md`).

**Test deliverables (this phase's functionality)**
- Integration tests for every endpoint named in `adminService.ts`, run with an admin token.
- Authorisation tests: each admin route rejected for a guest and for a customer token.
- Product-management tests covering create, update, delete, duplicate, and publish/unpublish state transitions.
- Bulk-operation tests asserting the agreed all-or-nothing semantics and correct per-item outcome reporting.
- CSV import tests: a valid file imports; a file with malformed rows is rejected per-row without corrupting the catalogue; the error report identifies the offending rows.
- A cross-cutting test proving an admin write is immediately visible through the public Phase 3 catalogue endpoints.
- Dashboard-metric tests asserting VTO and size-rec figures report honestly as zero/unavailable before Phases 10 and 13.
- Category-deletion test for a category still in use.

**Dependencies**
Phase 3 (catalogue), Phase 4 (roles and auth test helpers), Phase 6 (orders and inventory).

**Completion criteria**
- Every endpoint named in `frontend/src/services/adminService.ts` responds correctly.
- No admin route is reachable with a customer token or no token.
- A product created or unpublished through the admin API is immediately reflected in the public catalogue endpoints.
- Bulk operations are all-or-nothing per the agreed semantics and report per-item outcomes.
- CSV import rejects malformed rows without partially corrupting the catalogue.
- Responses assignable to the frontend admin types.
- **Admin route, authorisation, bulk, CSV, and admin→storefront visibility tests added and passing; the whole suite still green.**

---

## Phase 8 — Gradual frontend/backend integration

**Objective**
Switch the frontend from mock services to the real API **incrementally and reversibly**, with the minimum possible change to frontend code — the first phase permitted to touch `frontend/`.

**Main deliverables**
- A documented, agreed switch order, lowest risk first: catalogue reads → auth → cart/wishlist → orders → admin.
- Per-domain enabling of the real path inside `frontend/src/services/*` only, leaving page components, stores, hooks, routing, and styling untouched.
- `VITE_USE_MOCK_API` retained as a working rollback switch; mock mode must still run with the backend offline.
- `VITE_API_BASE_URL` verified against the deployed and local backend.
- CORS, cookie/token, and preflight behaviour confirmed against the real Vite origin.
- Real-token wiring into the existing `localStorage['vestra-auth-token']` mechanism — transport unchanged.
- Loading and error states verified against real latency and real failures, using the existing Axios interceptor error shape.
- A written integration log recording, per domain, what was switched and what was verified.

**Test deliverables (this phase's functionality)**
- Backend suite re-run after each domain is switched, confirming no regression was introduced by integration work.
- Frontend verification per domain: `npm run typecheck` and `npm run build` pass with zero errors after every service-module change.
- A mock-mode regression check per domain: with `VITE_USE_MOCK_API=true` and the backend stopped, the app still runs — proving the rollback switch is real, not nominal.
- Manual browser verification per domain, recorded in the integration log with what was checked.
- Error-path checks against real failures (backend down, 401, 404, 500) confirming the existing Axios interceptor still produces the expected UI states.

**Dependencies**
Phases 3–7 (the endpoints being integrated, each already covered by its own tests).

**Completion criteria**
- Each switched domain works end to end against the real backend in the browser.
- `VITE_USE_MOCK_API=true` still fully restores mock behaviour with no backend running.
- `npm run build` and `npm run typecheck` pass with zero errors.
- **The backend suite still passes after every domain switch, with real output reported.**
- No page component, store, layout, route guard, or style file was modified — changes confined to service modules and environment configuration.
- The storefront/admin layout separation and the premium editorial design are visually unchanged.
- Every changed frontend file is listed in the task report with its justification.

---

## Phase 9 — Product recommendations

**Objective**
Serve product recommendations from the backend at the routes the frontend already calls, using catalogue and order data rather than an external model.

**Main deliverables**
- `GET /api/recommendations`, `GET /api/recommendations/:type`, `GET /api/recommendations?placement=`.
- Support for the declared `RecommendationType` values: recommended for you, similar styles, complete the look, frequently bought together, based on recently viewed, inspired by wishlist, trending in your size, new arrivals you may like, trending.
- Recommendation strategies drawing on `recommendationTags`, `relatedProductIds`, category/collection affinity, order co-occurrence, and wishlist signals.
- A human-readable `explanation` and a numeric `score` per item, as `RecommendationItem` requires.
- Placement-aware grouping via `RecommendationGroup`, with graceful degradation to non-personalised results for guests and cold-start users.
- Sensible result caps and query performance appropriate to the seeded catalogue size.

**Test deliverables (this phase's functionality)**
- Integration tests for all three recommendation routes and every supported `RecommendationType`.
- Tests asserting no returned item is unpublished, suppressed, or duplicated within a group.
- Cold-start tests: a guest and a brand-new user receive graceful non-personalised results, not an error or an empty payload.
- Deterministic scoring tests using fixed seed data, so `score` and `explanation` are assertable rather than incidental.
- Placement-grouping tests asserting `RecommendationGroup` shape and correct placement filtering.
- Result-cap tests confirming the documented maximum is enforced.

**Dependencies**
Phase 3 (catalogue), Phase 6 (order history as a behavioural signal). Best done after Phase 8 so results are observable in the real UI.

**Completion criteria**
- Every recommendation endpoint returns correctly grouped, correctly typed results.
- No recommendation returns an unpublished, out-of-stock-suppressed, or duplicate product.
- Guest and new-user requests degrade gracefully instead of erroring or returning empty.
- Explanations are accurate descriptions of why the item was selected — no invented reasoning.
- Response times acceptable under the seeded dataset.
- **Recommendation, cold-start, scoring, and grouping tests added and passing; the whole suite still green.**

---

## Phase 10 — Virtual Try-On backend/provider abstraction

**Objective**
Move Virtual Try-On from frontend mock to a real server-mediated integration, with the provider hidden behind an abstraction and provider credentials never leaving the server.

**Main deliverables**
- `POST /api/virtual-try-on`, `GET /api/virtual-try-on/eligible`, `GET /api/virtual-try-on/product/:productId`.
- A `VirtualTryOnProvider` interface plus at least a mock provider implementation, so the concrete third-party provider is swappable without touching routes, controllers, or the frontend.
- Multipart image upload handling (`multer`) with MIME-type and size limits and rejection of non-image payloads.
- Provider credentials read only from validated env config; **never** returned to the client, logged, or embedded in a response.
- Rate limiting and per-user quota on the VTO endpoint, plus provider timeout and failure handling that returns a correctly shaped error.
- Privacy-first image lifecycle: uploaded customer photographs are processed transiently and **not** persisted beyond what the request requires; temporary files are cleaned up deterministically. The retention rule is documented explicitly.
- Consent enforced server-side — a request without `consentGiven` is rejected, not silently processed.
- Results honestly flagged via `isDemo` while a mock provider is in use; no false claim of real provider processing.
- Optional feedback capture (`helpful` / `not_helpful`) for the admin VTO usage metric.

**Test deliverables (this phase's functionality)**
- Integration tests for all three VTO routes against a stub provider — no real provider call in the test suite.
- A provider-swap test: a second `VirtualTryOnProvider` implementation is selected by configuration alone, proving the abstraction holds.
- Upload-rejection tests: oversized file, non-image MIME type, and missing file each rejected with the correct status and error shape.
- A consent test asserting a request without `consentGiven` is rejected before any provider call is attempted.
- A temporary-file cleanup test asserting no uploaded image remains on disk after the request completes, including on the failure path.
- Provider-failure tests: timeout and error responses surface as a correctly shaped error, never a stack trace or a leaked provider payload.
- A test asserting no provider credential appears in any response body or log line.
- A test asserting `isDemo` is `true` while a mock/stub provider is in use.

**Dependencies**
Phase 1 (foundation and test harness), Phase 3 (product/variant resolution for eligibility and colour), Phase 4 (user identity, quota, consent audit).

**Completion criteria**
- A try-on request completes through Express against the mock provider and returns a result assignable to `VirtualTryOnResult`.
- No provider key is present in any response, log line, or client-visible artefact.
- Requests without consent, with an oversized file, or with a non-image file are rejected with correct status codes.
- Temporary uploads are provably removed after processing; retention behaviour matches the documented policy.
- The provider can be swapped by changing configuration alone — demonstrated by a second implementation of the interface.
- The existing product-page try-on flow still carries the exact selected product and colour, per `AGENTS.md`.
- `isDemo` accurately reflects whether a real provider was used.
- **VTO route, provider-swap, upload-rejection, consent, and cleanup tests added and passing; the whole suite still green.**

---

## Phase 11 — Comprehensive regression, security, authorisation, validation and hardening

**Objective**
Raise the backend to a defensible standard of correctness and security suitable for dissertation assessment, by auditing and deepening the test coverage that Phases 1–10 already established.

> **This is not the first introduction of testing.** Test tooling landed in Phase 1 and every phase from 1 to 10 shipped tests for its own functionality. Phase 11 is the *cross-cutting* pass: full regression, gap analysis, the complete authorisation matrix, uniform validation, and security hardening. If this phase finds a route group with no tests at all, that is a defect in an earlier phase and should be reported as such.

**Main deliverables**
- **Coverage audit** of the existing suite: enumerate every route and identify what Phases 1–10 did *not* cover. Close the gaps; name any gap left open deliberately and say why.
- **Full regression run** across the whole suite, proving no later phase broke an earlier one.
- Deepened unit coverage for the highest-risk logic: pricing/totals maths, inventory decrement, promo application, and validator edge cases.
- Edge-case and adversarial tests the feature phases would not naturally write: unicode and oversized payloads, deeply nested objects, duplicate and conflicting parameters, unexpected types, and empty/null bodies.
- Verification that the isolated test-database strategy chosen in Phase 1 still holds across the now much larger suite, and that tests remain independent and order-insensitive.
- **Complete authorisation matrix tests:** guest / customer / admin against *every* protected route, including cross-user access attempts (user A reading user B's order, cart, profile, or wishlist).
- **Uniform request validation** audited across every endpoint (Zod or equivalent), with consistent `{ code, message, details }` errors — any endpoint still missing validation is fixed here.
- **Security hardening:** `helmet`, tuned CORS, global and per-route rate limiting, body-size limits, NoSQL-injection/query-operator sanitisation, JWT expiry and refresh review, `bcrypt` cost review, mass-assignment protection on update endpoints, and generic error messages that leak no internals or stack traces.
- A dependency vulnerability audit with findings recorded and either resolved or explicitly justified.
- Documented log hygiene: no secrets, tokens, passwords, or customer photographs in logs.
- A coverage report captured as dissertation evidence.

**Dependencies**
Phases 1–10 — all of which already carry their own tests. This phase audits and extends that body of work rather than creating it.

**Completion criteria**
- The full test suite passes, and the real pass/fail output is reported — no failure is described as a pass.
- The coverage audit is written down: what was already covered by Phases 1–10, what gaps were closed here, and what gaps remain by explicit decision.
- Every route group has meaningful coverage; no route group is untested.
- Every endpoint validates its input; no unvalidated body or query parameter reaches a database call.
- The authorisation matrix has no unexpected allow.
- No stack trace, internal path, or database error text is exposed to a client.
- Rate limits demonstrably engage.
- The audit result is recorded with remaining items justified.
- The suite is order-insensitive and touches no development or production data.

---

## Phase 12 — Backend deployment and production configuration

**Objective**
Deploy the hardened backend so the frontend can reach it from a hosted environment, with production configuration separated from development.

> **Scope note:** the Python ML service does not exist yet at this point, so this phase deploys the Express + Atlas topology only. Phase 13 will therefore need to *update and redeploy* this deployment once the model arrives. Build the deployment and its documentation expecting that second pass — keep configuration additive and the rollback procedure repeatable.

**Main deliverables**
- Production build and start pipeline (`tsc` output run by `node`, not a dev runner).
- Hosting configuration for **Render, with `backend/` as the service root** — installing from `backend/package-lock.json` only, with the port bound from the environment. The frontend deploys separately to Vercel with `frontend/` as its project root; the two deployments share no build.
- Production environment variables set in the platform's secret store — **never** committed, and never printed.
- MongoDB Atlas production readiness: separate database or cluster, least-privilege database user, IP/network access rules, and a backup expectation recorded.
- Production CORS restricted to the deployed frontend origin.
- `VITE_API_BASE_URL` for the deployed frontend pointed at the deployed API (frontend environment configuration only — no source change).
- Structured production logging at an appropriate level, plus `/api/health` wired to the platform's health check.
- Deployment documentation: required variables by name and purpose, deploy steps, rollback procedure.
- Cold-start, timeout, and file-upload constraints of the chosen host assessed against the VTO endpoint.

**Dependencies**
Phase 11 (do not deploy an unhardened, untested backend).

**Completion criteria**
- The deployed `/api/health` responds successfully and reports a healthy Atlas connection.
- The deployed frontend performs real end-to-end requests against the deployed API from a browser.
- No secret exists in the repository, the build output, or any log.
- Production CORS rejects unlisted origins.
- Deployment and rollback steps are written down and have been followed at least once.
- Development environment still works unchanged after the production split.

---

## Phase 13 — ML Size Recommendation integration (LAST)

**Objective**
Integrate the client-supplied Python ML size-recommendation service through Express. **This phase is last purely because the trained ML model is not yet available** — it is a sequencing consequence of that unavailability, not a judgement about the feature's importance. Nothing before it may assume the model's inputs, outputs, or behaviour.

> **Blocked until the client delivers the model.** Do not start, and do not build a Node-based substitute for the model in the meantime.

**Because this phase runs after Phase 12, deployment work is part of its scope.** Phase 12 deploys the Express backend and MongoDB Atlas *before* the ML service exists, so by the time the model arrives the production environment is already live. Phase 13 therefore includes deploying the new Python service **and** updating and redeploying the already-deployed Express backend so it can reach it:

- Deploy the Python ML service to its own hosted environment, independent of Express.
- Add the new ML configuration to the deployed Express environment (service URL, credential, timeout) via the platform's secret store — never committed.
- Redeploy Express with the size-recommendation routes and the ML client enabled.
- Update production CORS, networking, and any egress or IP-allowlist rules so Express can reach the Python service and the browser still cannot.
- Extend the Phase 12 deployment documentation and rollback procedure to cover the two-service topology.
- Re-verify the Phase 12 completion criteria after redeployment — the deployment is being changed, so its guarantees must be re-established rather than assumed.

**Main deliverables**
- A separate Python service (e.g. FastAPI/Flask) hosting the client-supplied model, deployed independently of Express.
- Express proxy endpoints at the paths the frontend already calls: `GET /api/size-recommendation/schema/:productId` and `POST /api/size-recommendation`.
- **Model-determined form schema:** the backend/model decides which measurement fields are required, returned as `SizeRecommendationFormSchema` (`fields` with `key`, `label`, `inputType`, `required`, `min`/`max`, `unit`, `helpText`, `displayOrder`, `options`). No permanent hard-coded input set — the frontend stays model-agnostic per `AGENTS.md`.
- Per-product model selection via `sizeModelKey`, and `sizeRecommendationEligible` respected.
- Result mapping to `SizeRecommendationResult`: `recommendedSize`, `confidencePercent`, `confidenceLabel`, `expectedFit`, `explanation`, optional `alternativeSize`, `productNote`, `measurementSummary`, and a `disclaimer`.
- Metric/imperial unit handling and validated measurement input, collecting **only** the fields the active schema declares.
- Python service credentials and internal URL held server-side only; the browser never calls the ML service directly.
- Timeout, retry, and graceful-degradation behaviour — if the model is unavailable, the product page must degrade cleanly rather than break size selection or Add to Bag.
- Language review: guidance framing, no guaranteed-fit claim, no body-shaming language, measurements changeable by the user.
- Optional recommendation-outcome logging for the admin size-rec metric, storing only what is necessary.
- Deployment and redeployment work as itemised above.

**Test deliverables (this phase's functionality)**
- Integration tests for both size-recommendation routes against a stubbed ML service — the suite must never call the real model.
- Schema-driven tests: two different stub schemas produce two different required-field sets, proving no input set is hard-coded.
- Result-mapping tests asserting the `SizeRecommendationResult` shape, including the optional fields and the mandatory `disclaimer`.
- Unit-conversion tests for metric and imperial input.
- Validation tests rejecting measurements outside the active schema's declared `min`/`max`, and rejecting fields the schema did not declare.
- Degradation tests: with the ML service stubbed as down or timing out, the endpoint returns a correctly shaped error and no unhandled exception.
- A test asserting no ML credential or internal service URL appears in any response body or log line.
- Post-deployment smoke tests against both deployed services.

**Dependencies**
Phase 12 (deployable, hardened, already-deployed backend) **and** delivery of the trained model by the client. Also depends on Phase 4 for measurement-profile storage.

**Completion criteria**
- The Python service is deployed and reachable from Express only.
- Express has been redeployed with the ML integration enabled, and the Phase 12 completion criteria have been re-verified against the updated deployment.
- Schema and recommendation endpoints return payloads assignable to `SizeRecommendationFormSchema` and `SizeRecommendationResult`.
- The form rendered on the product page is driven entirely by the model-supplied schema — changing the schema changes the form with no frontend code change.
- No ML credential or internal service URL is exposed to the browser.
- With the ML service deliberately stopped, the product page still renders and Add to Bag still works.
- Copy reviewed: guidance-not-guarantee, no body-shaming language.
- Size Recommendation appears beside the size selector, preserving the product-page hierarchy in `AGENTS.md`.
- **Size-recommendation tests added and passing, and the full Phase 11 suite re-run green against the updated backend.**
- The two-service deployment and rollback procedure is documented and has been followed at least once.

---

## Phase 14 — Final end-to-end/dissertation validation

**Objective**
Validate the complete integrated system against the dissertation's stated aims and produce the evidence needed for write-up and demonstration.

**Main deliverables**
- Full end-to-end journeys exercised on the deployed system: browse → filter → product detail → size recommendation → virtual try-on → add to bag → checkout → order confirmation → order history.
- Full admin journey: login → dashboard → catalogue CRUD → duplicate → publish/unpublish → bulk actions → CSV import → categories → inventory → order management → review moderation.
- Verification of the three differentiating features against the dissertation aims: Virtual Try-On, ML Size Recommendation, Product Recommendations.
- Confirmation that the complete architecture behaves as designed: React → Express → MongoDB Atlas, Express → VTO provider, Express → Python ML service.
- Regression pass proving no earlier phase was broken by a later one; full test suite re-run on the deployed configuration.
- Cross-browser and responsive check of the integrated storefront and admin areas.
- Final security and privacy review: no secret in the repository, no `.env` committed, customer photograph handling matches the documented policy, measurement data handling matches the stated privacy rules.
- Performance observations under realistic catalogue size, recorded as evidence rather than asserted.
- Dissertation artefacts: architecture diagram, endpoint inventory, schema documentation, screenshots, and a reproducible demonstration script.
- An explicit, honest limitations section: simulated payment, mock-provider fallbacks, dataset scale, model constraints, and anything left unimplemented.

**Dependencies**
Phase 13, and therefore all preceding phases.

**Completion criteria**
- Every customer and admin journey completes on the deployed system without a blocking defect.
- All three differentiating features demonstrably work through the intended server-mediated architecture.
- The test suite passes on the deployed configuration, with real results reported.
- No secret, credential, or `.env` file is present in the repository history or build output.
- Documentation and evidence are complete enough to support the write-up and a live demonstration.
- Known limitations are documented plainly rather than concealed.

---

## Working rules that apply to every phase

These are a summary for convenience. **[AGENTS.md](../AGENTS.md) is authoritative** — if the two ever disagree, AGENTS.md wins.

1. **One phase, one scoped task at a time.** Finish, report, stop.
2. **Inspect before editing.** Read the existing backend code and the relevant frontend service and types first.
3. **`backend/` is the write scope.** `frontend/` is read-only until Phase 8, and even then only service modules and environment configuration. The root `package.json` is off limits except in Phase 1 (backend-delegating `npm --prefix` scripts), and only on the owner's explicit request. **Never add a `workspaces` field and never create a root `package-lock.json`.**
4. **Conform to the frontend contract.** `frontend/src/types/index.ts` and the `frontend/src/services/` route names are fixed points.
5. **Every implementation phase ships its own tests.** From Phase 1 onward, a phase is not complete until tests covering the functionality it introduced exist and pass. Do not defer testing to Phase 11 — Phase 11 audits and hardens, it does not backfill.
6. **Verify after changing.** Run the relevant build, type-check, and tests. Report the real outcome, including failures.
7. **Report changed files and limitations** at the end of every task.
8. **Never expose or commit secrets**, and never read or print `.env` contents.
9. **Branch per phase; never work on `backend-development` or `main` directly.** Within an authorised task an agent may commit, push its scoped branch, and open or update a pull request targeting `backend-development` — then stop for review. **Merging requires explicit owner authorisation**, and no force-push, reset, rebase, history rewrite or branch deletion is permitted without it. See the Git workflow in [AGENTS.md](../AGENTS.md).
