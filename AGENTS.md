# VESTRA — Agent Instructions

**This file is the authoritative working agreement for any coding agent in this repository.**
It supersedes the former root `CLAUDE.md`, which is now only a legacy pointer.

It deliberately does **not** repeat implementation detail. Three documents are the deeper
sources of truth, and they win on their own subject matter:

| Question | Authoritative source |
|---|---|
| What happens in which phase, and in what order | [backend/IMPLEMENTATION_PLAN.md](backend/IMPLEMENTATION_PLAN.md) |
| How the backend is built, configured, run and tested | [backend/README.md](backend/README.md) · [backend/tests/README.md](backend/tests/README.md) |
| The exact API/DTO contract | `frontend/src/types/index.ts` and `frontend/src/services/` |

---

## Project purpose

VESTRA is a UK-focused fashion e-commerce application built as a **dissertation software
artefact**. Its differentiating features are:

1. Virtual Try-On
2. ML-based Size Recommendation
3. Product Recommendations
4. Standard fashion e-commerce functionality
5. Customer account functionality
6. Administrative catalogue / order / user management

## Current state

- **The React frontend is implemented and stable.** It is a finished artefact component, not
  work in progress. It is **read-only** during backend development (see *Scope of changes*).
- **Backend development is authorised and is the active work.** `backend/` is the primary
  write scope.
- **Phase 0A, 0B, Phase 1, Phase 2 and Phase 3 are complete and merged.** Phase 1 delivered the
  Express / TypeScript foundation, MongoDB connection handling, `GET /api/health`, the error
  contract, and the test harness; Phase 2 delivered the database/schema design.
- **Phase 4 (authentication, users, profiles and addresses) is the current backend phase.**
- **`backend-development` is the integration branch.** All phase work branches from it and
  targets it by pull request.

Architecture, live today:

```
React frontend  →  Express REST API  →  MongoDB Atlas
   (Vite/TS)         (Node + TS)          (Mongoose)
```

Added later, both strictly server-mediated:

```
Express  →  external Virtual Try-On provider        (Phase 10)
Express  →  Python ML size-recommendation service   (Phase 13)
```

The browser talks only to Express. It never holds a provider or model credential and never
calls an external AI service directly.

---

## Repository architecture — two independent applications

**This is fixed. Do not change it, and do not reintroduce npm workspaces.**

`frontend/` and `backend/` live in one Git repository but are **two fully independent Node
applications**, each installed, built and deployed on its own:

| Application | Manifest + lockfile | Deploys to | Deployment root |
|---|---|---|---|
| `frontend/` | `frontend/package.json` + `frontend/package-lock.json` | **Vercel** | `frontend/` |
| `backend/` | `backend/package.json` + `backend/package-lock.json` | **Render** | `backend/` |

Hard rules:

- **No npm workspaces.** The root `package.json` has no `workspaces` field and must never
  regain one. An earlier iteration registered `backend` as a workspace; that was **reversed**
  and must not be restored.
- **No root `package-lock.json`.** Locking lives only in the two application lockfiles, which
  are independent of each other.
- **Backend dependencies are installed inside `backend/`**, updating `backend/package-lock.json`
  only. Never install a backend dependency from the repository root, and never let one
  application's install touch the other's lockfile or `node_modules`.
- **No shared `node_modules` assumption.** `cd frontend && npm ci` and `cd backend && npm ci`
  must each succeed alone from a clean checkout, with no root `node_modules` present.
- **Root scripts are convenience wrappers only** and delegate with `npm --prefix`, never
  `--workspace`. The root manifest declares no dependencies; neither deployment reads it.
- **Lockfiles must stay portable** — they must contain the Linux native packages the
  Vercel/Render builds resolve. Never repair an install by hand-placing packages into
  `node_modules`, and never present a build as passing when it only passes because of
  out-of-lockfile binaries.

---

## Scope of changes

### Primary write scope: `backend/`

All new implementation work belongs under `backend/`. Documentation may also be written at the
repository root when the owner asks for it.

### The frontend is read-only until Phase 8

- **Do not** redesign, rebuild, restyle, refactor or "improve" the frontend.
- **Do not** regenerate working pages, components, stores, hooks, routing or services.
- **Do** inspect the frontend freely to understand the contract and existing behaviour.
  Reading it is expected.
- **Do not modify any file under `frontend/`.** Phase 8 is the first phase permitted to, and
  even then changes are confined to `frontend/src/services/` and environment configuration —
  swap-in-place (mock service → real HTTP call), never structural.

If backend work appears to require a frontend change before Phase 8, **stop and report it**
rather than making the change.

### Files needing owner approval before being touched

- `package.json` (root) — off limits. The Phase 0B and Phase 1 exceptions have both been used
  and are spent. Never add a `workspaces` field; never create a root lockfile.
- `frontend/package.json` — owner approval only. `frontend/package-lock.json` may be
  *synchronised* when provably stale (`npm install --package-lock-only`, which preserves pins),
  but dependencies must never be intentionally upgraded and `npm audit fix` must never be run.
- Any file under `frontend/` (see above)
- `.gitignore`
- This file (`AGENTS.md`)

---

## Backend stack

Fixed. Do not substitute alternatives.

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Language | TypeScript (strict) |
| Database | MongoDB Atlas |
| ODM | Mongoose 8 |

`engines.node` is `">=18"` and the whole dependency tree is held to it — see the *Node 18
compatibility* section of [backend/README.md](backend/README.md) before raising any dependency.

Prefer the standard, well-understood option over the clever one. Add a dependency only when it
is genuinely needed, and say why when you do.

---

## The contract the backend must honour

**The frontend already defines the API contract. The backend conforms to the frontend, not the
other way round.** A backend change that forces a frontend rewrite is the wrong change.

| Concern | Fixed by |
|---|---|
| DTO shapes | `frontend/src/types/index.ts` — responses must be assignable to `Product`, `User`, `Cart`, `Order`, `Category`, `Collection`, `PaginatedResult<T>`, `ApiError`, and the VTO / size-recommendation types |
| Base path | `/api` — `frontend/src/services/apiClient.ts` defaults to `http://localhost:5000/api` |
| Auth transport | `Authorization: Bearer <token>`, token read from `localStorage['vestra-auth-token']` |
| Error body | **every** non-2xx response is `{ code, message, details? }`, so the existing Axios interceptor keeps working |
| Route names | the service modules in `frontend/src/services/` already name the routes; match those paths and do not invent parallel naming |
| Mock toggle | `VITE_USE_MOCK_API` must keep working — with mocks on, the frontend makes no real network calls, so the backend must never become a hard dependency of the frontend build |

---

## Frontend architecture to preserve

The frontend is read-only, but these rules constrain what the backend may ask of it and must
survive Phase 8 integration.

**Stack:** React, Vite, TypeScript, Tailwind, Shadcn UI, React Router, TanStack Query, Zustand,
React Hook Form, Zod, Axios, Lucide React, Sonner. Do not replace these. Do **not** introduce
Next.js, Supabase, Firebase, Bolt Database, Redux, or server-side rendering.

**Layout separation.** `StorefrontLayout` owns customer-facing global UI (announcement bar,
header, search, cart drawer, mobile navigation, storefront footer). `AdminLayout` is
independent. Never place storefront chrome — announcement bar, Women/Men/New In navigation,
customer wishlist/bag navigation, storefront footer, newsletter, customer-service links — inside
admin pages. Do not reverse this.

**Service-layer API architecture.** Page components contain no API implementation logic; network
and mock access stays inside `frontend/src/services/`. This is what makes Phase 8 a small change.

**Single catalogue source.** Admin catalogue writes and storefront catalogue reads must hit the
same data, so an admin change is visible on the storefront. Phase 7 must preserve this guarantee
server-side. Never create a second, unrelated product data source.

**Existing admin functionality must be preserved:** add / edit / delete / duplicate product,
publish / unpublish, bulk actions, CSV import, categories, inventory.

**Product page hierarchy** — do not reorder: product information → colour → size selection →
Size Recommendation → Virtual Try-On → Add to Bag. Add to Bag remains the primary commerce
action; Virtual Try-On is an important secondary action; Size Recommendation stays visually
associated with size selection.

**Design system.** Preserve the premium editorial fashion identity: premium, editorial, modern,
minimal, trustworthy, fashion-focused. Do not turn it into a SaaS interface, a generic AI landing
page, neon/glassmorphism, or a default Shadcn demo. AI features may use the existing indigo
accent; standard commerce actions stay neutral/black.

**Authentication.** The frontend currently ships mock authentication with route guards
distinguishing unauthenticated users, customers and admins. Real authentication is built
server-side in **Phase 4** and only wired into the frontend in **Phase 8** — until then the mock
path and the demo customer/admin accounts must keep working. Preserve the demo accounts: the
dissertation demonstration depends on them.

---

## Virtual Try-On architecture

Production topology — `React → Express → VTO provider`. Implement the provider behind an
abstraction so the concrete provider can be swapped without touching route handlers or the
frontend. **VTO provider calls must go through Express; the browser must never hold or transmit
a provider API key.** Backend work is **Phase 10**; see the plan for the full deliverable list.

Behaviour the frontend already guarantees and the backend must not break:

- A product-page Try On action preserves the exact selected product, and the selected colour
  where available. Customers must not have to search for the same product again.
- One uploaded photo is reusable for multiple garments in a session; switching garments must not
  require re-uploading.
- Explicit consent is part of the experience, and Phase 10 enforces it server-side — a request
  without consent is rejected, not silently processed.
- Do not display hundreds of products in the fitting-room workspace; use a searchable picker.

**Privacy — customer photographs.** Never persist VTO photographs to `localStorage`,
`sessionStorage`, Zustand persistence, or a mock database; frontend previews use
`URL.createObjectURL` and revoke correctly. Server-side, uploads are processed transiently, are
not retained beyond what the request requires, and temporary files are cleaned up
deterministically including on the failure path. Never claim server-side processing that is not
happening: while a mock/stub provider is in use, results are flagged honestly as demo output.

---

## Size Recommendation architecture

Production topology — `React → Express → Python ML size-recommendation service`. **This is
Phase 13 and it is last** purely because the trained model has not been supplied by the client
yet — a sequencing consequence, not a judgement about the feature's importance. It is **not**
implemented in Node.

Until the model arrives:

- Do not guess the model's inputs or outputs.
- Do not hard-code one permanent set of measurement fields — the backend/model decides which
  fields are required, and the frontend stays schema-driven and model-agnostic.
- Do not build a Node-based stand-in for the ML model.

Result information the frontend expects: recommended size, confidence, expected fit,
explanation, and an alternative size where available. A recommendation is **guidance, not a
guaranteed fit**. Collect only the fields the active schema declares, explain their purpose,
allow measurements to be changed, avoid certainty claims, and never use body-shaming language.

---

## Testing policy — tests start at Phase 1, not Phase 11

Testing is **incremental and continuous**. Phase 1 established the harness (Vitest + Supertest +
an isolated in-memory MongoDB); see [backend/tests/README.md](backend/tests/README.md).

- **Every implementation phase ships tests for the functionality it introduces, and is not
  complete until they pass.**
- **Phase 11** is the comprehensive regression, security, authorisation, validation and
  hardening pass. It audits and deepens existing coverage — it is **not** where testing begins.
  Do not defer a phase's tests to Phase 11.
- No test may touch development or production data.

---

## Secrets

- **Never** read, print, echo, log, summarise or commit the contents of any `.env` file,
  including `backend/.env`.
- **Never** put a secret, connection string or API key into source code, documentation, test
  fixtures, or a commit message.
- MongoDB Atlas credentials, JWT signing secrets and VTO/ML provider keys live in `.env` and are
  reached only through validated config loading.
- Fail fast with a clear message when a required variable is missing — naming the variable,
  never its value. Sanitise database errors and logs so credentials cannot appear.
- `.gitignore` already excludes `.env` and `.env.*` while allowing `.env.example`. Keep it that
  way. Never add a `.env` file to the index, even if asked to "commit everything".
- When a new variable is introduced, document its **name and purpose** in `.env.example` and the
  backend README — never a real value.

---

## How to work

1. **One scoped phase or task at a time.** Complete it, report, stop. Do not chain unrelated
   work into one change, and **do not jump ahead in or reorder the implementation plan**.
2. **Inspect before editing.** Read the existing backend code, the relevant frontend service and
   the types first. Reuse what exists rather than adding a second way to do the same thing.
3. **Make the smallest reasonable change.** Modify the fewest files that do the job. Do not
   regenerate working code, duplicate existing functionality, restructure unrelated
   architecture, or redesign unrelated pages.
4. **Do not add dependencies unnecessarily.**
5. **Verify after changing.** Run the relevant build, type-check and tests for whatever was
   touched. Fix errors the change introduced.
6. **Report honestly.** State the files created/modified/deleted, the commands run and their
   real outcome, and any limitation, assumption, shortcut or known gap. If a test fails or a
   step was skipped, say so plainly with the output. Never describe unverified work as verified.

---

## Git / GitHub workflow

- **`backend-development` is the integration branch.** `main` is the release branch.
- **Every phase or task uses a new scoped branch created from the latest
  `backend-development`** — for example `backend/phase-2-schema`. Never work directly on
  `backend-development` or `main`.
- Within an authorised task you **may** implement, test, `git add`, commit, push the task
  branch, and create or update its pull request.
- **Pull requests target `backend-development`.**
- **Do not merge a pull request unless the owner explicitly authorises it after review.**
- **Do not modify `main` directly**, and do not merge `backend-development` into `main` without
  explicit instruction.
- **No force-push, reset, rebase, history rewriting, tag or branch deletion** unless explicitly
  authorised.
- **After creating or updating the PR, stop and report for review.** Do not continue into the
  next phase.
- Read-only Git commands (`git status`, `git diff`, `git log`, `git branch --show-current`) are
  always fine.
