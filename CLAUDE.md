# VESTRA — Claude Code Working Agreement

This file governs how Claude Code works in this repository during the **backend development stage** of the VESTRA dissertation artefact.

## Standing project instructions

@agents.md

The imported instructions above remain authoritative for project purpose, frontend stack, layout architecture, design system, privacy rules, and general change policy. **Do not duplicate them here.**

### Precedence

Where this file and `agents.md` disagree, **this file wins — but only on the two points below**, which reflect a decision taken by the project owner after `agents.md` was written:

| `agents.md` clause | Current status |
|---|---|
| "Do NOT implement backend functionality unless explicitly requested" | **Superseded.** Backend development is now explicitly authorised (see below). |
| "Do not modify `backend/` unless explicitly instructed" | **Superseded.** `backend/` is now the primary write scope. |

Every other clause in `agents.md` still applies unchanged — including the frontend stack rules, the VTO and Size Recommendation architecture, the privacy rules, and the change policy.

---

## Repository architecture — two independent applications

**This is fixed. Do not change it, and do not reintroduce npm workspaces.**

`frontend/` and `backend/` live in one Git repository but are **two fully independent Node applications**, each installed, built, and deployed on its own:

| Application | Root for install/build | Deployment target | Deployment root |
|---|---|---|---|
| `frontend/` | `frontend/package.json` + `frontend/package-lock.json` | **Vercel** | `frontend/` |
| `backend/` | `backend/package.json` + `backend/package-lock.json` | **Render** | `backend/` |

Hard rules:

- **No npm workspaces.** The root `package.json` has **no `workspaces` field** and must never regain one. An earlier iteration of Phase 0B registered `backend` as a workspace; that approach was **reversed** in favour of independence and must not be restored.
- **No root `package-lock.json`.** Dependency locking lives *only* in `frontend/package-lock.json` and `backend/package-lock.json`. Never create a lockfile at the repository root.
- **Each application installs from its own manifest and its own lockfile only.** Install backend dependencies with `npm install` **run inside `backend/`**, which updates `backend/package-lock.json` only. Never install a backend dependency from the repository root, and never let one application's install touch the other's lockfile or `node_modules`.
- **No shared `node_modules` assumption.** Neither application may rely on hoisting or on a root `node_modules` existing. `cd frontend && npm ci` and `cd backend && npm ci` must each succeed on their own from a clean checkout.
- **Root scripts are convenience wrappers only** and must delegate with `npm --prefix`, never with `--workspace`:

  ```
  "dev":     "npm --prefix frontend run dev"
  "build":   "npm --prefix frontend run build"
  "preview": "npm --prefix frontend run preview"
  ```

  The root manifest declares no dependencies and is not required by either deployment. Both hosts build from their own subdirectory and never read it.
- **Lockfiles must stay portable.** A committed lockfile must contain the native platform packages for *all* platforms npm resolves (Linux for Vercel/Render as well as the local development platform). Never repair a broken install by hand-placing packages into `node_modules`, and never present a build as passing when it only passes because of out-of-lockfile binaries.

---

## Authorisation

**Backend development is explicitly authorised.** Work in `backend/` no longer requires per-task permission to exist; it requires only that the specific task has been scoped and requested.

The agreed phase sequence is recorded in [backend/IMPLEMENTATION_PLAN.md](backend/IMPLEMENTATION_PLAN.md). Follow it. Do not jump ahead, reorder phases, or bundle several phases into one change.

---

## Scope of changes

### Primary write scope: `backend/`

All new implementation work belongs under `backend/`. Documentation may also be written at the repository root when the owner asks for it.

### The frontend is stable — treat it as read-only

The React frontend is **complete and stable for the purposes of this stage**. It is a finished dissertation artefact component, not a work in progress.

- **Do not** redesign, rebuild, restyle, refactor, or "improve" the frontend.
- **Do not** regenerate working pages, components, stores, or services.
- **Do** inspect the frontend freely to understand API contracts and existing behaviour. Reading it is expected and encouraged.
- **Do not modify any file under `frontend/`** unless a later, explicitly scoped integration task requires it. Phase 8 is the first phase that may touch frontend files, and even then changes must be minimal and swap-in-place (mock service → real HTTP call), never structural.

If backend work appears to require a frontend change before Phase 8, **stop and report it** rather than making the change.

### Files that need owner approval before being touched

- `package.json` (root) — the root file has exactly one remaining authorised exception, gated on the owner explicitly requesting that phase's implementation:
  - **Phase 1** may add the backend-delegating root scripts (`dev:backend`, `build:backend`, `test:backend`, and `start:backend` if useful), because that is the phase which creates the backend scripts they call. They must use `npm --prefix backend run <script>` — **never** `--workspace`. A root script must never be added before the backend script it delegates to exists.

  Phase 0B's earlier `workspaces` exception is **withdrawn**: the root manifest now carries no `workspaces` field, and adding one back is prohibited (see *Repository architecture* above). The existing `dev` / `build` / `preview` scripts keep their names and their `npm --prefix frontend` form. Nothing else may modify the root manifest.
- `frontend/package.json` and `frontend/package-lock.json` — the manifest is owner-approval-only. `frontend/package-lock.json` may be **synchronised** to match the manifest when it is provably stale (`npm install --package-lock-only`, which preserves existing pins), but dependencies must never be intentionally upgraded and `npm audit fix` must never be run.
- `frontend/` source files (see above)
- `.gitignore`
- `agents.md`

---

## Contracts the backend must honour

The frontend already defines the API contract. The backend conforms to the frontend, not the other way round.

- **Type definitions:** `frontend/src/types/index.ts` is the canonical DTO shape (`Product`, `User`, `Cart`, `Order`, `Category`, `Collection`, `PaginatedResult<T>`, `ApiError`, and the VTO / size-recommendation types). Backend response payloads must be assignable to these types.
- **Base path:** `frontend/src/services/apiClient.ts` defaults to `http://localhost:5000/api`. The Express API is mounted under `/api`.
- **Auth transport:** a bearer token read from `localStorage['vestra-auth-token']` and sent as `Authorization: Bearer <token>`.
- **Error shape:** every non-2xx response body must be `{ code, message, details? }` so the existing Axios interceptor keeps working.
- **Endpoint names:** the service modules in `frontend/src/services/` already name the routes the frontend will call. Match those paths; do not invent parallel naming.
- **Mock toggle:** `VITE_USE_MOCK_API` must keep working. With mocks enabled the frontend must not make real network calls, so the backend must never become a hard dependency of the frontend build.

**Preserving compatibility with the existing React frontend is a hard requirement**, not a nice-to-have. A backend change that forces a frontend rewrite is the wrong change.

---

## Backend stack

Fixed for this project. Do not substitute alternatives.

| Layer | Technology |
|---|---|
| Runtime | Node.js (18+) |
| Framework | Express |
| Language | TypeScript |
| Database | MongoDB Atlas |
| ODM | Mongoose |

Prefer the standard, well-understood option over the clever one. Add a dependency only when it is genuinely needed, and say why when you do.

---

## External services — routed through Express only

### Virtual Try-On (Phase 10)

VTO provider calls **must** go through the Express backend. The browser must never hold or transmit a provider API key.

```
React → Express → external VTO provider
```

Implement the provider behind an abstraction so the concrete provider can be swapped without touching route handlers or the frontend.

### ML Size Recommendation (Phase 13 — deliberately last)

Size Recommendation will be a **separate Python service** that Express calls; it is **not** implemented in Node.

```
React → Express → Python ML size-recommendation service
```

This is **last purely because the trained ML model is not available yet** — a sequencing consequence of that unavailability, not a statement about the feature's importance. The model is to be supplied by the client later. Because Phase 12 deploys the Express backend before the model exists, **Phase 13 also covers deploying the Python service and updating/redeploying the Express backend configuration and integration** so the two can talk. Until the model arrives:

- Do not guess at the model's inputs or outputs.
- Do not hard-code one permanent set of measurement fields.
- Do not build a Node-based stand-in for the ML model.
- Keep the existing schema-driven, model-agnostic approach on the frontend intact.

---

## Secrets

- **Never** read, print, echo, log, summarise, or commit the contents of any `.env` file — including `backend/.env`.
- **Never** put a secret, connection string, or API key into source code, documentation, test fixtures, or a commit message.
- MongoDB Atlas credentials, JWT signing secrets, and VTO/ML provider keys live in `.env` and are accessed only through validated config loading.
- `.gitignore` already excludes `.env` and `.env.*` while allowing `.env.example`. Keep it that way.
- When a new environment variable is introduced, document its **name and purpose** in `.env.example` and the backend README — never a real value.

---

## How to work

1. **One scoped task at a time.** Complete it, report, and stop. Do not chain unrelated work into a single change.
2. **Inspect before editing.** Read the existing implementation, types, and any relevant frontend service first. Reuse what exists rather than adding a second way to do the same thing.
3. **Make the smallest reasonable change.** Modify the fewest files that do the job.
4. **Verify after changing.** Run the relevant build, type-check, lint, and tests for whatever was touched — backend checks for backend changes, `npm run build` / `npm run typecheck` if a frontend file was legitimately in scope. Fix errors the change introduced.
5. **Test as you go, from Phase 1 onward.** Phase 1 sets up the backend test tooling and the first health/error tests; every implementation phase after it adds tests for the functionality that phase introduced, and is not complete until those tests pass. Phase 11 is the comprehensive regression, security, authorisation, validation and hardening pass — it audits and deepens existing coverage and is **not** where testing begins. Do not defer a phase's tests to Phase 11.
6. **Report honestly.** After every task state: the files created/modified/deleted, the commands run and their real outcome, and any limitation, assumption, shortcut, or known gap. If a test fails or a step was skipped, say so plainly with the output. Do not describe unverified work as verified.

---

## Git rules

**Never commit, push, merge, rebase, tag, create or switch branches, stash, reset, or otherwise alter Git history or branch state unless the project owner explicitly instructs it in that task.**

- Leave changes in the working tree for the owner to review.
- Read-only Git commands (`git status`, `git diff`, `git log`, `git branch --show-current`) are always fine.
- Current working branch: `backend-development`.
- Never add a `.env` file to the index, even if asked to "commit everything".
