# Phase 13 deployment — ML Size Recommendation

Phase 13 adds a separate Python FastAPI service while keeping the browser isolated from ML credentials:

```text
Vercel React -> Render Express -> MongoDB Atlas
                         |
                         +-> Render FastAPI Decision Tree service
```

## 1. Deploy the ML service

Create the `vestra-size-ml` Render web service from the repository `main` branch after Phase 13 is approved.

- Root directory: `ml-service`
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`
- Environment: `ML_ENABLE_DOCS=false`
- Secret: `ML_SERVICE_KEY=<strong random value at least 32 characters>`

`GET /health` is public for hosting health checks. Prediction and schema endpoints require the `X-ML-Service-Key` header.

## 2. Configure the Express service

Set these variables in the existing `vestra-backend` Render service:

```text
ML_SERVICE_URL=https://<vestra-size-ml-render-host>
ML_SERVICE_KEY=<the exact same secret used by vestra-size-ml>
ML_SERVICE_TIMEOUT_MS=5000
```

Do not place the ML URL or key in Vercel or in a `VITE_` variable. The browser calls only Express.

Redeploy `vestra-backend` after changing the environment.

## 3. Smoke checks

1. `GET <ml-service>/health` returns `200` and reports model version `1.0.0`.
2. `GET <backend>/api/health` still returns healthy database status.
3. Open a product with `sizeRecommendationEligible=true` and click **Find My Size**.
4. Confirm the form is loaded from `GET /api/size-recommendation/schema/:productId`.
5. Submit valid measurements and confirm a size, confidence, explanation and disclaimer appear.
6. Test metric and imperial input.
7. Temporarily stop or misconfigure the ML service in a non-production test environment and confirm the product page still works and manual size selection/Add to Bag are unaffected.
8. Confirm no ML service secret or internal configuration appears in browser responses or logs.

## 4. Rollback

If the ML service causes a production problem, remove or disable `ML_SERVICE_URL`/`ML_SERVICE_KEY` in Express or redeploy the previous known-good backend commit. Size recommendation will return a safe unavailable response while the rest of the storefront remains operational.

The ML service can be rolled back independently by redeploying its previous known-good commit. No MongoDB data migration is required for Phase 13.

## Local development

Start the ML service on port `8001` and configure the backend:

```text
ML_SERVICE_URL=http://127.0.0.1:8001
ML_SERVICE_KEY=<same local secret in both services>
ML_SERVICE_TIMEOUT_MS=3000
```

Then run the normal Express backend on port `5000` and the Vite frontend on port `5173`.
