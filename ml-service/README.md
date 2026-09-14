# VESTRA ML Size Recommendation service

This independent FastAPI service hosts the Phase 13 **Decision Tree** clothing-size model. The browser never calls it directly. Production traffic is:

`React -> Express -> FastAPI Decision Tree service`

## Local run

```bash
cd ml-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
set ML_SERVICE_KEY=replace-with-a-long-random-secret
# PowerShell: $env:ML_SERVICE_KEY="replace-with-a-long-random-secret"
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Health check:

`GET http://127.0.0.1:8001/health`

The protected endpoints require `X-ML-Service-Key` and are intended only for the Express backend.

## Runtime endpoints

- `GET /health`
- `GET /v1/models/{modelKey}/schema`
- `POST /v1/predict`

## Model

The committed model is a real `sklearn.tree.DecisionTreeClassifier` trained from the client-supplied dataset (`weight`, `age`, `height` -> `size`). The persisted pipeline includes median imputation. The text-safe `.joblib.b64` artifact is verified against the SHA-256 hash in its metadata before loading.

Holdout evaluation used an 80/20 **measurement-grouped** split so identical `(weight, age, height)` combinations could not appear in both training and test sets. The tuned Decision Tree improved exact-size accuracy from about 44.9% to about 49.8%, and within-one-size accuracy from about 73.7% to about 77.5%. These results are guidance quality, not a guaranteed-fit claim.

## Training and documentation analysis

Install the training extras:

```bash
pip install -r requirements-training.txt
```

Then follow `training/README.md`. It contains the NumPy/Pandas cleaning workflow, Seaborn/Matplotlib visualisation script, Decision Tree tuning/evaluation, and reproducible model export.

## Tests

```bash
pip install -r requirements-training.txt
pytest -q
```

## Render

Create a separate Render web service with `ml-service/` as its root.

- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`
- Secret: `ML_SERVICE_KEY`

The same secret value is configured only in the Express Render service. Do not place it in Vercel or any `VITE_` variable.
