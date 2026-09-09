# Production deployment: Render, Atlas and Vercel

Phase 12 prepares the current production topology only:

```text
Vercel frontend -> Render Express API -> MongoDB Atlas
                         |
                         +-> Cloudinary / Pixelcut (Virtual Try-On)
```

The Phase 13 Python size-recommendation service does not exist yet and is not part of this
deployment. This document contains no account identifiers, deployed URLs or secret values.

## Render setup

Connect `shafiq079/vestra` to Render using the repository-level `render.yaml`. The Blueprint
defines one Node web service, `vestra-backend`, with these settings:

| Setting | Value |
|---|---|
| Production branch | `main` (only after the separately reviewed `backend-development` release PR) |
| Root directory | `backend` |
| Build | `npm ci --include=dev && npm run build && npm prune --omit=dev` |
| Start | `npm start` (`node dist/server.js`) |
| Health check | `/api/health` |
| Runtime | Node.js 18 or newer, as enforced by `backend/package.json` |
| Runtime mode | `NODE_ENV=production` |

`npm ci` consumes only `backend/package-lock.json`. Development packages are installed explicitly
so the TypeScript compiler is available, then pruned after compilation. The service must not use a
development runner. Render supplies `PORT`; do not override it in the dashboard. The server reads
that value and connects to Atlas before it begins listening, so invalid configuration or an
unreachable database fails the deployment rather than presenting a healthy API.

The Blueprint deliberately does not invent a plan, region, service ID, URL or account-specific
settings. Select those in the Render dashboard. Values marked `sync: false` must be entered into
Render's environment settings and must never be committed. Deploy the reviewed `main` branch, not
this feature branch or an unfinished integration branch.

## Production environment

Render injects `PORT`. All other runtime configuration enters through Render's environment
settings and is validated at process startup. Defaults shown below are application defaults, not
secret values. Values classified as secret must be stored only in Render.

| Variable | Purpose | Required in production | Secret |
|---|---|---:|---:|
| `NODE_ENV` | Enables production proxy, logging, index and CORS behaviour; set to `production` | Yes | No |
| `PORT` | HTTP listener port supplied by Render | Yes (platform-supplied) | No |
| `MONGODB_URI` | TLS Atlas connection URI, including the production database name | Yes | **Yes** |
| `CORS_ORIGIN` | Exact allowed Vercel frontend origin; comma-separated exact origins are supported | Yes | No |
| `JWT_SECRET` | Signs access tokens and VTO guest capabilities; minimum 32 characters | Yes | **Yes** |
| `JWT_ACCESS_TTL_SECONDS` | Access-token lifetime; default `900` | No | No |
| `BCRYPT_ROUNDS` | Password hashing cost, range 4–15; default `12` | No | No |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime; default `7` | No | No |
| `DEMO_CUSTOMER_PASSWORD` | Used only by the explicitly invoked demo-user seed command | No | **Yes** |
| `DEMO_ADMIN_PASSWORD` | Used only by the explicitly invoked demo-user seed command | No | **Yes** |
| `PIXELCUT_API_KEY` | Server-only Pixelcut provider credential | Yes | **Yes** |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account/tenant name | Yes | No |
| `CLOUDINARY_API_KEY` | Server-only Cloudinary API key | Yes | **Yes** |
| `CLOUDINARY_API_SECRET` | Server-only Cloudinary signing secret | Yes | **Yes** |
| `VTO_DAILY_QUOTA` | Started jobs allowed per owner per UTC day; default `5` | No | No |
| `VTO_CONCURRENT_LIMIT` | Simultaneously active jobs per owner; default `1` | No | No |
| `VTO_RATE_LIMIT_WINDOW_SECONDS` | VTO submission limiter window; default `60` | No | No |
| `VTO_RATE_LIMIT_MAX_REQUESTS` | VTO submissions per window; default `5` | No | No |
| `VTO_PROVIDER_TIMEOUT_MS` | Pixelcut submission/status request timeout; default `10000` | No | No |
| `VTO_JOB_DEADLINE_SECONDS` | Overall asynchronous job deadline; default `600` | No | No |
| `VTO_SOURCE_URL_TTL_SECONDS` | Temporary signed source-photo URL lifetime; default `900` and at least 60 seconds longer than the job deadline | No | No |
| `VTO_RECONCILE_INTERVAL_SECONDS` | Abandoned-job cleanup/reconciliation interval; default `60` | No | No |

Use a strong, newly generated `JWT_SECRET` and production-only provider credentials. Do not copy
secrets into build commands, logs, documentation, shell history, Vercel variables or the Blueprint.
Production configuration rejects `CORS_ORIGIN=*`. Configure the exact HTTPS Vercel origin without
a trailing slash, for example the actual stable production domain chosen by the owner. Add further
comma-separated origins only when they genuinely need browser access; preview domains are not
implicitly trusted.

## MongoDB Atlas

1. Use a production Atlas database (and preferably a production project/cluster), separate from
   development and the in-memory test database. Choose and retain an explicit production database
   name in `MONGODB_URI`.
2. Create a dedicated application database user. Grant only the read/write privileges needed on
   that database; do not use an Atlas owner or broad administrative credential.
3. Configure Atlas Network Access so the Render service can connect. Prefer Render's documented
   outbound address ranges when the selected Render plan exposes stable ranges. If a broader rule
   is temporarily required by the hosting setup, protect it with the dedicated least-privilege
   credentials, record the decision and revisit it; never treat an open network rule as sufficient
   authentication.
4. Use the `mongodb+srv://` Atlas TLS URI supplied by Atlas and place it only in Render's secret
   environment settings as `MONGODB_URI`. Never commit or log it.
5. Enable an Atlas backup policy appropriate to the dissertation demonstration and expected data,
   and confirm that recovery points are being created. Application deployment rollback is not a
   substitute for database backup.

Confirm connectivity without printing the URI: inspect Render for the sanitised “MongoDB
connected” event, then request `/api/health`. A `200` response with `database.status` equal to
`connected` confirms the active connection without exposing its host, database or credentials.
Do not use a production write merely as a connectivity probe.

## Vercel frontend

Keep the frontend as an independent Vercel project with **Root Directory** `frontend`. Its existing
API client already reads `VITE_API_BASE_URL` and falls back to the local backend. In the Vercel
Production environment set:

```text
VITE_API_BASE_URL=<actual Render backend origin>/api
```

Do not use the placeholder literally and do not commit a production `.env`. Add the frontend's
actual stable HTTPS origin to the backend's Render `CORS_ORIGIN` value, then redeploy the affected
project after changing either build-time Vercel variables or Render runtime variables. Frontend
preview deployments need an explicitly listed stable origin; wildcard CORS is not an option.

## Virtual Try-On hosting constraints

- Express accepts one in-memory multipart image of at most **10 MiB**, plus a tightly bounded field
  set. Confirm the selected Render service accepts requests of this size; avoid base64 wrapping,
  which increases request size and is not the implemented contract.
- `VTO_PROVIDER_TIMEOUT_MS` bounds each Pixelcut network operation, while
  `VTO_JOB_DEADLINE_SECONDS` bounds the asynchronous job lifecycle. The browser may see a pending
  job and poll again; a request timeout is not proof that a paid provider job failed.
- The private Cloudinary source URL must remain valid throughout provider processing. Keep
  `VTO_SOURCE_URL_TTL_SECONDS` at least 60 seconds beyond the job deadline, as startup validation
  requires. Customer source images are temporary and deletion failures are retried.
- Reconciliation runs once at startup and every `VTO_RECONCILE_INTERVAL_SECONDS`. A Render restart
  or cold start interrupts only the in-process timer: durable job records remain in Atlas and the
  startup pass resumes cleanup/reconciliation. Cold starts can delay the next poll and should be
  considered when selecting Render's plan and timeout values.
- Phase 11's general HTTP limiter is process-local and is acceptable for **one** Render instance.
  Horizontal scaling would give each instance a separate allowance and therefore requires a
  shared rate-limit store in a later, separately scoped change. VTO's persisted quota/job controls
  remain database-backed.

Do not perform a live Pixelcut generation or Cloudinary upload as a routine deployment probe. Live
VTO verification remains deferred until the owner separately authorises provider use.

## Release and deployment sequence

1. Open the Phase 12 pull request against `backend-development`.
2. The owner reviews and merges the Phase 12 pull request.
3. Review the accumulated `backend-development` branch and merge it to `main` through a separate
   production-release pull request.
4. Connect or update the Render Blueprint so the backend deploys from the production `main` branch.
5. Enter every required `sync: false` value in Render's secret/environment settings. The initial
   service cannot become healthy until these are present; Render prompts for them when creating a
   Blueprint service.
6. Complete the Atlas production database, application-user, network-access and backup setup.
7. Configure Vercel's `VITE_API_BASE_URL` and ensure the Vercel production origin exactly matches
   Render's `CORS_ORIGIN`.
8. Redeploy the frontend if its build-time environment changed.
9. Run the smoke checklist below and record the deployed commit and outcomes.

## Smoke-test checklist

- [ ] Render installs, compiles and starts the reviewed `main` commit successfully.
- [ ] `GET <Render origin>/api/health` returns `200`, `status: "ok"` and database `connected`.
- [ ] The health response and Render logs expose no URI, credentials, tokens or stack trace.
- [ ] A request with the exact Vercel `Origin` receives the matching
      `Access-Control-Allow-Origin` header.
- [ ] A request with a deliberately unlisted `Origin` receives no allow-origin header (test using
      a harmless `GET`; browser access is consequently blocked).
- [ ] A public catalogue request such as `GET /api/products` succeeds.
- [ ] Register/login or the owner-approved demo login succeeds over HTTPS, and tokens appear only
      in the response/browser storage—not logs or URLs.
- [ ] The deployed frontend performs a real browser request through `VITE_API_BASE_URL`.
- [ ] No production mock system has replaced an implemented API route.
- [ ] Local development still uses `http://localhost:5000/api` and permits
      `http://localhost:5173` with the local example configuration.
- [ ] Live Pixelcut/Cloudinary generation remains untested unless separately authorised.

## Rollback

Record the Git SHA of every known-good production deploy. If an application release is faulty,
use Render's rollback/redeploy facility to deploy the immediately preceding known-good `main`
commit (or revert the faulty commit through the normal reviewed Git workflow) and repeat the
health, CORS, catalogue and authentication smoke checks. Restore the previous compatible Vercel
environment/build if the frontend endpoint changed.

Do **not** delete, downgrade or restore Atlas data merely to roll back application code. If a future
release includes a data migration, it must provide its own reviewed, non-destructive compatibility
and recovery procedure backed by Atlas backups.
