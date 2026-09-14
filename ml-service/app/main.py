from __future__ import annotations

import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException

from .model_service import MODEL, MeasurementValidationError, ModelNotSupportedError
from .schemas import PredictRequest, PredictResponse


def _docs_enabled() -> bool:
    return os.getenv("ML_ENABLE_DOCS", "false").strip().lower() == "true"


app = FastAPI(
    title="VESTRA ML Size Recommendation",
    version=MODEL.version,
    docs_url="/docs" if _docs_enabled() else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _docs_enabled() else None,
)


def require_service_key(x_ml_service_key: str | None = Header(default=None)) -> None:
    configured = os.getenv("ML_SERVICE_KEY", "").strip()
    if not configured:
        raise HTTPException(status_code=503, detail="ML service authentication is not configured.")
    if not x_ml_service_key or not hmac.compare_digest(configured, x_ml_service_key):
        raise HTTPException(status_code=401, detail="Unauthorised service request.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "modelVersion": MODEL.version}


@app.get("/v1/models/{model_key}/schema", dependencies=[Depends(require_service_key)])
def model_schema(model_key: str) -> dict[str, object]:
    try:
        return {"modelKey": model_key, "modelVersion": MODEL.version, "fields": MODEL.schema(model_key)}
    except ModelNotSupportedError:
        raise HTTPException(status_code=404, detail="Requested size model is not available.") from None


@app.post("/v1/predict", response_model=PredictResponse, dependencies=[Depends(require_service_key)])
def predict(request: PredictRequest) -> PredictResponse:
    try:
        result = MODEL.predict(request.modelKey, request.measurements)
    except ModelNotSupportedError:
        raise HTTPException(status_code=404, detail="Requested size model is not available.") from None
    except MeasurementValidationError as error:
        raise HTTPException(status_code=422, detail={"message": "Measurements are invalid.", "details": error.details}) from None

    return PredictResponse(
        predictedSize=result.predicted_size,
        confidence=result.confidence,
        probabilities=result.probabilities,
        modelVersion=result.model_version,
    )
