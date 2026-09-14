from __future__ import annotations

import os

os.environ["ML_SERVICE_KEY"] = "test-service-key-1234567890"

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEADERS = {"X-ML-Service-Key": os.environ["ML_SERVICE_KEY"]}


def test_health_is_public_and_model_is_loaded() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["modelVersion"] == "1.0.0"


def test_schema_requires_internal_service_key() -> None:
    response = client.get("/v1/models/tops_women/schema")
    assert response.status_code == 401


def test_schema_is_model_driven() -> None:
    response = client.get("/v1/models/tops_women/schema", headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["modelKey"] == "tops_women"
    assert [field["key"] for field in body["fields"]] == ["weight", "height", "age"]


def test_prediction_returns_real_decision_tree_output() -> None:
    response = client.post(
        "/v1/predict",
        headers=HEADERS,
        json={"modelKey": "tops_women", "measurements": {"weight": 62, "height": 172.72, "age": 28}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["predictedSize"] in {"XXS", "S", "M", "L", "XL", "XXL", "XXXL"}
    assert 0 <= body["confidence"] <= 1
    assert body["modelVersion"] == "1.0.0"
    assert abs(sum(body["probabilities"].values()) - 1.0) < 1e-9


def test_unexpected_measurement_is_rejected() -> None:
    response = client.post(
        "/v1/predict",
        headers=HEADERS,
        json={
            "modelKey": "tops_women",
            "measurements": {"weight": 62, "height": 172.72, "age": 28, "waist": 70},
        },
    )
    assert response.status_code == 422
    assert "waist" in response.json()["detail"]["details"]


def test_out_of_range_measurement_is_rejected() -> None:
    response = client.post(
        "/v1/predict",
        headers=HEADERS,
        json={"modelKey": "tops_women", "measurements": {"weight": 500, "height": 172.72, "age": 28}},
    )
    assert response.status_code == 422
    assert "weight" in response.json()["detail"]["details"]


def test_unknown_model_key_is_not_silently_substituted() -> None:
    response = client.get("/v1/models/not-a-real-model/schema", headers=HEADERS)
    assert response.status_code == 404


def test_service_key_is_never_echoed() -> None:
    response = client.post(
        "/v1/predict",
        headers=HEADERS,
        json={"modelKey": "tops_women", "measurements": {"weight": 62, "height": 172.72, "age": 28}},
    )
    assert os.environ["ML_SERVICE_KEY"] not in response.text
