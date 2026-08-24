# Backend test suite

Test tooling was established in **Phase 1** and every phase from Phase 1 onward adds
tests for the functionality it introduces. Phase 11 audits and deepens this suite — it
is not where testing begins.

Run from `backend/`:

```bash
npm test          # single run
npm run test:watch
```

## Tooling

| Concern | Choice |
|---|---|
| Runner | Vitest (`vitest.config.mts`) |
| HTTP assertions | `supertest`, driven against the exported Express `app` |
| Database | `mongodb-memory-server` — one isolated in-memory MongoDB for the run |
| Globals | disabled; import `describe` / `it` / `expect` from `vitest` explicitly |

## Convention — where new tests go

- One file per route group or module, named `<subject>.test.ts`, directly under `tests/`.
- Shared helpers and fixtures go in `tests/helpers/` and `tests/fixtures/` as later
  phases need them. Phase 4 is expected to add authenticated-request helpers there.
- Tests drive `createApp()` from `src/app.ts`. Never import `src/server.ts` — it binds a
  port and opens a real database connection.

## Database isolation

`tests/globalSetup.ts` starts a single in-memory `mongod` for the whole run;
`tests/setup.ts` then runs before every test file and gives two independent guarantees
that no test can touch the development or production database:

1. It overwrites `process.env.MONGODB_URI` at module scope, *before* any test file
   imports `src/config/env.ts`. `dotenv` never overrides a value already present in
   `process.env`, so `backend/.env` cannot supply the URI the suite sees.
2. Nothing under test opens its own connection. `src/app.ts` has no database side
   effects, and `connectDatabase()` is called only from `src/server.ts`, which the suite
   never imports. The only live connection is the in-memory one `setup.ts` opens.

`setup.ts` drops the database after each file, so every file starts empty. Because the
files share one database, `fileParallelism` is off — do not turn it on without giving
each file its own database name.

`tests/databaseIsolation.test.ts` asserts both guarantees rather than trusting them. If
it fails, stop — the suite may be pointed at real data.

One server per run rather than one per file is deliberate: starting `mongod` once per
file was measurably slower and produced an occasional start-timeout failure on Windows.
The first run downloads the `mongod` binary (cached under `node_modules/.cache`), which
is why `hookTimeout` is generous in `vitest.config.mts`.

## Test-only routes

`src/routes/diagnostics.ts` provides `/api/__diagnostics/boom` so the error handler can be
exercised against a genuinely unexpected fault. It is mounted only when `createApp()` is
asked for diagnostics, which defaults to `NODE_ENV === 'test'`.
`tests/errorHandling.test.ts` asserts that the route 404s when diagnostics are off, so the
gate is verified rather than assumed.

## Phase 1 coverage

| File | Covers |
|---|---|
| `health.test.ts` | `GET /api/health` — 200, response structure, no secret exposure, `/api` base path |
| `errorHandling.test.ts` | 404 shape, internal 500 shape, no stack-trace leakage, diagnostics gating, malformed JSON, helmet/CORS headers |
| `databaseIsolation.test.ts` | in-memory database, test database name, no Atlas URI reachable, empty database, no models registered yet |
| `lifecycle.test.ts` | graceful shutdown — close/disconnect/exit order, exit codes, idempotency, disconnect after a failed close, timeout backstop, SIGINT/SIGTERM/rejection/exception wiring |
