# VESTRA Backend

The backend is an independent Node.js, Express and TypeScript application backed by MongoDB Atlas.

## Main responsibilities

- authentication and customer profiles
- product catalogue, categories and collections
- cart and wishlist
- checkout, orders and inventory
- admin management APIs
- product recommendations
- Virtual Try-On orchestration through Cloudinary and Pixelcut
- ML size recommendation proxying to the independent FastAPI service

The browser communicates with Express only. Provider and ML credentials remain server-side.

## Local development

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

The default API base is:

```
http://localhost:5000/api
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Compile TypeScript |
| `npm start` | Run the compiled production server |
| `npm test` | Run the backend test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run typecheck` | Type-check source and tests |
| `npm run seed` | Seed the demonstration catalogue |

## Environment

All supported variables are documented in `.env.example`. Production secrets belong in the deployment platform and must not be committed.

Important integrations include MongoDB, Cloudinary, Pixelcut and the ML size recommendation service.

## Virtual Try-On

The production flow is server mediated:

```
browser image -> Express validation -> private Cloudinary source -> Pixelcut
Pixelcut result -> private Cloudinary result -> browser preview
```

Cumulative previews use the previous completed result as the source for the next product. Temporary source and result assets are cleaned through the VTO lifecycle and reconciliation logic.

## Size recommendation

The backend exposes the public size recommendation API and forwards valid requests to the FastAPI ML service. The frontend does not hold the ML service URL or service key.

## Tests

The curated backend suite contains **91 test cases** covering the highest-value customer, admin, ML integration and Virtual Try-On behaviour.

See `tests/README.md` for the retained test scope.

## Production

Render runs this folder as an independent service using:

```bash
npm ci --include=dev && npm run build && npm prune --omit=dev
npm start
```

Health endpoint:

```
GET /api/health
```
