from __future__ import annotations

import base64
import hashlib
import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
MODEL_B64 = MODEL_DIR / "clothing_size_decision_tree_v1.joblib.b64"
METADATA_PATH = MODEL_DIR / "clothing_size_decision_tree_v1.metadata.json"

SUPPORTED_MODEL_KEYS = {
    "outerwear_women",
    "dresses_women",
    "tops_women",
    "knitwear_women",
    "trousers_women",
    "outerwear_men",
    "knitwear_men",
    "shirts_men",
    "trousers_men",
    "jumpsuits_women",
    "activewear_women",
    "clothing_size_decision_tree_v1",
}

SCHEMA_FIELDS = [
    {
        "key": "weight",
        "label": "Weight",
        "inputType": "number",
        "required": True,
        "min": 22,
        "max": 136,
        "unit": "kg",
        "helpText": "Enter your current body weight.",
        "displayOrder": 1,
    },
    {
        "key": "height",
        "label": "Height",
        "inputType": "number",
        "required": True,
        "min": 137,
        "max": 194,
        "unit": "cm",
        "helpText": "Enter your height without shoes.",
        "displayOrder": 2,
    },
    {
        "key": "age",
        "label": "Age",
        "inputType": "number",
        "required": True,
        "min": 16,
        "max": 80,
        "unit": "years",
        "helpText": "Age is used only to improve this size recommendation.",
        "displayOrder": 3,
    },
]


class ModelNotSupportedError(ValueError):
    pass


class MeasurementValidationError(ValueError):
    def __init__(self, details: dict[str, list[str]]):
        super().__init__("Measurements are invalid.")
        self.details = details


@dataclass(frozen=True)
class Prediction:
    predicted_size: str
    confidence: float
    probabilities: dict[str, float]
    model_version: str


class DecisionTreeSizeModel:
    def __init__(self) -> None:
        metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        encoded = MODEL_B64.read_text(encoding="ascii").strip()
        raw = base64.b64decode(encoded, validate=True)
        digest = hashlib.sha256(raw).hexdigest()
        if digest != metadata["model_sha256"]:
            raise RuntimeError("The persisted ML model checksum does not match its metadata.")
        self._metadata: dict[str, Any] = metadata
        self._model = joblib.load(io.BytesIO(raw))
        self._features = list(metadata["features"])

    @property
    def version(self) -> str:
        return str(self._metadata["model_version"])

    @property
    def metadata(self) -> dict[str, Any]:
        return dict(self._metadata)

    def ensure_model_key(self, model_key: str) -> None:
        if model_key not in SUPPORTED_MODEL_KEYS:
            raise ModelNotSupportedError(model_key)

    def schema(self, model_key: str) -> list[dict[str, Any]]:
        self.ensure_model_key(model_key)
        return [dict(field) for field in SCHEMA_FIELDS]

    def validate_measurements(self, model_key: str, measurements: dict[str, float]) -> dict[str, float]:
        self.ensure_model_key(model_key)
        expected = {field["key"] for field in SCHEMA_FIELDS}
        supplied = set(measurements)
        details: dict[str, list[str]] = {}

        for unexpected in sorted(supplied - expected):
            details.setdefault(unexpected, []).append("This field is not used by the active model.")

        cleaned: dict[str, float] = {}
        for field in SCHEMA_FIELDS:
            key = str(field["key"])
            if key not in measurements:
                details.setdefault(key, []).append("This field is required.")
                continue
            try:
                value = float(measurements[key])
            except (TypeError, ValueError):
                details.setdefault(key, []).append("Enter a valid number.")
                continue
            minimum = float(field["min"])
            maximum = float(field["max"])
            if value < minimum or value > maximum:
                details.setdefault(key, []).append(f"Enter a value between {minimum:g} and {maximum:g} {field['unit']}.")
                continue
            cleaned[key] = value

        if details:
            raise MeasurementValidationError(details)
        return cleaned

    def predict(self, model_key: str, measurements: dict[str, float]) -> Prediction:
        clean = self.validate_measurements(model_key, measurements)
        row = pd.DataFrame([{feature: clean[feature] for feature in self._features}], columns=self._features)
        predicted = str(self._model.predict(row)[0])
        probabilities_array = self._model.predict_proba(row)[0]
        classes = [str(value) for value in self._model.classes_]
        probabilities = {name: float(value) for name, value in zip(classes, probabilities_array)}
        confidence = probabilities[predicted]
        return Prediction(
            predicted_size=predicted,
            confidence=confidence,
            probabilities=probabilities,
            model_version=self.version,
        )


MODEL = DecisionTreeSizeModel()
