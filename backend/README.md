# VESTRA — Backend

Node.js / Express / TypeScript REST API over MongoDB Atlas, consumed by the React
frontend in [`frontend/`](../frontend).

`backend/` and `frontend/` are **two independent npm applications** in one Git
repository. This directory installs from its own `package.json` and
`package-lock.json`, has no npm workspace relationship with the frontend, and deploys
separately (backend → Render with `backend/` as the service root; frontend → Vercel).
Never install a backend dependency from the repository root.

The phased build sequence is recorded in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
**Phase 1 (this foundation) is implemented.** No domain models or business endpoints
exist yet — Phase 2 covers schema design.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Language | TypeScript (strict) |
| Database | MongoDB Atlas |
| ODM | Mongoose 8 |
| Env validation | Zod |
| Tests | Vitest 3 + Supertest + `mongodb-memory-server` 10 |

### Node 18 compatibility

`engines.node` is `>=18`, and every dependency is held to it. Mongoose, Vitest and
`mongodb-memory-server` are deliberately kept on their **8.x / 3.x / 10.x** lines because
the next major of each requires Node 20.19+ and would silently break the contract.

The `overrides` entry pinning `vite` to `^6` exists for the same reason: Vitest 3 accepts
`vite@^5 || ^6 || ^7`, but Vite 7 requires Node 20.19+, so an unconstrained install
resolves a transitive dependency that Node 18 cannot run. Vite is not used by the backend
itself — only by Vitest.

`@types/node` is held to **18.x** so the type definitions describe the *minimum* supported
runtime rather than the newest one. On a later major, `tsc` would accept APIs that do not
exist in Node 18 (`process.loadEnvFile`, for example) and the build would pass while the
deployed runtime threw. Keep this line in step with `engines.node`, not with the Node
version that happens to be installed locally.

Before raising any of these, check the target's real requirement rather than assuming:

```bash
npm view <package>@<version> engines
```

## Getting started

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values — .env is git-ignored
npm run dev
```

The API listens on `http://localhost:5000/api`, which is the base URL the frontend
already defaults to (`frontend/src/services/apiClient.ts`).

## Scripts

Run from `backend/`:

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with watch reload (`tsx watch src/server.ts`) |
| `npm run build` | Compile TypeScript to `dist/` (`tsc`) |
| `npm start` | Run the compiled build (`node dist/server.js`) — the production entry point |
| `npm test` | Run the test suite once (`vitest run`) |
| `npm run test:watch` | Run the test suite in watch mode |
| `npm run typecheck` | Type-check `src/` **and** `tests/` without emitting |

Equivalent convenience wrappers exist at the repository root and delegate with
`npm --prefix backend`: `dev:backend`, `build:backend`, `start:backend`, `test:backend`.

## Environment variables

Every variable is validated at startup by [`src/config/env.ts`](src/config/env.ts). A
missing or malformed value aborts the process with a message naming the variable —
never its value. `MONGODB_URI` is treated as sensitive and is never echoed, logged, or
included in an error message.

Copy [`.env.example`](.env.example) to `.env` and fill it in. **Never commit `.env`.**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | Runtime mode: `development` \| `test` \| `production` |
| `PORT` | no | `5000` | Port the HTTP server binds to. 5000 matches the frontend default |
| `MONGODB_URI` | **yes** | — | MongoDB connection string. Must start `mongodb://` or `mongodb+srv://` |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Comma-separated list of permitted browser origins. A wildcard `*` is rejected when `NODE_ENV=production` |

## Structure

```
backend/
├── src/
│   ├── app.ts              # Express app assembly — no port binding, importable by tests
│   ├── server.ts           # Entry point: env → database → listen → graceful shutdown
│   ├── lifecycle.ts        # Shutdown routine + SIGINT/SIGTERM wiring (unit tested)
│   ├── config/
│   │   ├── env.ts          # Zod-validated environment loading, fail-fast, secret-safe
│   │   └── database.ts     # Mongoose connection, event logging, disconnect, state
│   ├── middleware/
│   │   ├── errorHandler.ts # Centralised { code, message, details? } error responses
│   │   └── notFound.ts     # Terminal 404 handler
│   ├── routes/
│   │   ├── index.ts        # /api router root
│   │   ├── health.ts       # GET /api/health
│   │   └── diagnostics.ts  # Test-only error-triggering routes (gated off outside tests)
│   └── utils/
│       ├── httpError.ts    # HttpError carrying status + code + optional details
│       └── logger.ts       # Logger with a single secret-redaction choke point
├── tests/                  # Vitest suite — see tests/README.md
├── .env.example
├── tsconfig.json           # Strict; compiles src/ to dist/
├── tsconfig.test.json      # Type-checks src/ + tests/ (no emit)
└── vitest.config.mts
```

Directories reserved for later phases (`controllers/`, `models/`, `services/`,
`validators/`, `uploads/`) are present but empty.

## API

### `GET /api/health`

Liveness/readiness probe. Returns **200** while the database is connected and **503**
otherwise, so a platform health check can distinguish "process alive" from "actually
serving". It deliberately exposes no connection string, host, database name, or
environment variable value.

```json
{
  "status": "ok",
  "service": "vestra-backend",
  "environment": "development",
  "uptimeSeconds": 12.482,
  "timestamp": "2026-08-25T09:41:02.118Z",
  "database": { "status": "connected", "readyState": 1 }
}
```

## Error contract

Every non-2xx response body matches `ApiError` in `frontend/src/types/index.ts`, which
is what the existing Axios interceptor in `frontend/src/services/apiClient.ts` reads:

```json
{ "code": "ROUTE_NOT_FOUND", "message": "...", "details": { "field": ["..."] } }
```

`details` is optional. A stack trace is **never** placed in a response body in any
environment, and an unrecognised internal error yields a generic
`INTERNAL_SERVER_ERROR` message while the real cause is logged server-side only.

Codes emitted in Phase 1: `ROUTE_NOT_FOUND` (404), `INVALID_JSON` (400),
`PAYLOAD_TOO_LARGE` (413), `INTERNAL_SERVER_ERROR` (500).

## Security posture (Phase 1)

- `helmet` security headers; `x-powered-by` disabled.
- CORS driven entirely by `CORS_ORIGIN`; a production wildcard is rejected at startup.
- JSON and urlencoded bodies capped at 1 MB.
- All logging passes through a redaction step that strips URI userinfo
  (`mongodb+srv://user:pass@…`) and bearer tokens.
- Database errors are reduced to name and message, with the stack dropped, because
  driver stack frames can embed connection options.

Comprehensive hardening (rate limiting, injection sanitisation, the full authorisation
matrix) is Phase 11.

## Testing

See [tests/README.md](tests/README.md) for the tooling, the directory convention later
phases should follow, and how database isolation is guaranteed and asserted.

```bash
npm test
```

## Future services

Both are strictly server-mediated so the browser never holds a provider credential:

- **Virtual Try-On** (Phase 10) — `React → Express → external VTO provider`, behind a
  swappable provider interface.
- **ML Size Recommendation** (Phase 13) — `React → Express → Python ML service`. Last in
  the sequence only because the trained model has not been supplied yet; the measurement
  form schema stays model-determined so no input set is hard-coded.
