# VESTRA ML Size Recommendation Service

This independent FastAPI service hosts the Decision Tree clothing-size model.

Production traffic is:

```
React frontend -> Express backend -> FastAPI ML service
```

The browser never calls the ML service directly.

## Local run

```bash
cd ml-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Set `ML_SERVICE_KEY` in the environment, then run:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Health check:

```
GET http://127.0.0.1:8001/health
```

Protected endpoints require `X-ML-Service-Key`.

## Runtime endpoints

- `GET /health`
- `GET /v1/models/{modelKey}/schema`
- `POST /v1/predict`

## Model

The committed model is a real `sklearn.tree.DecisionTreeClassifier` trained from the supplied `weight`, `age`, and `height` inputs with `size` as the target.

The persisted pipeline includes median imputation. Holdout evaluation used a measurement-grouped split so identical measurement combinations could not appear in both training and test groups.

Current model evidence is approximately:

- exact-size accuracy: **49.8%**
- within-one-size accuracy: **77.5%**

The recommendation is sizing guidance, not a guaranteed fit.

## Training and analysis

Install the training dependencies:

```bash
pip install -r requirements-training.txt
```

Reproducible training and visualisation instructions are kept in `training/README.md`.

## Tests

```bash
pip install -r requirements-training.txt
pytest -q
```

The ML suite contains **9 test cases**.

## Production

Render runs this folder as an independent Python web service.

Build:

```bash
pip install -r requirements.txt
```

Start:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

The same `ML_SERVICE_KEY` is configured in the Express backend and this service. It must not be exposed to the frontend.
