from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    modelKey: str = Field(min_length=1, max_length=100)
    measurements: dict[str, float]


class PredictResponse(BaseModel):
    predictedSize: str
    confidence: float = Field(ge=0, le=1)
    probabilities: dict[str, float]
    modelVersion: str
