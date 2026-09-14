from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, log_loss
from sklearn.model_selection import GroupShuffleSplit, RandomizedSearchCV, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

FEATURES = ["weight", "age", "height"]
SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]
RANDOM_STATE = 42


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the VESTRA Decision Tree size model.")
    parser.add_argument("dataset", type=Path, help="Path to final_test.csv")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "models")
    return parser.parse_args()


def clean_dataset(frame: pd.DataFrame) -> pd.DataFrame:
    required = {*FEATURES, "size"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(sorted(missing))}")

    clean = frame[[*FEATURES, "size"]].copy()
    for column in FEATURES:
        clean[column] = pd.to_numeric(clean[column], errors="coerce")
    clean["size"] = clean["size"].astype(str).str.strip().str.upper()

    # The supplied dataset contains a small number of impossible age values.
    # Mark them missing and let the persisted median-imputer handle them.
    clean.loc[(clean["age"] <= 0) | (clean["age"] > 100), "age"] = np.nan

    allowed_sizes = set(SIZE_ORDER)
    clean = clean[clean["size"].isin(allowed_sizes)].reset_index(drop=True)
    return clean


def measurement_groups(frame: pd.DataFrame) -> pd.Series:
    values = frame[FEATURES].astype(object).where(frame[FEATURES].notna(), "NA").astype(str)
    return values.agg("|".join, axis=1)


def within_one_size(y_true: pd.Series, y_pred: np.ndarray) -> float:
    rank = {size: index for index, size in enumerate(SIZE_ORDER)}
    return float(np.mean([abs(rank[a] - rank[b]) <= 1 for a, b in zip(y_true, y_pred)]))


def metrics(model: Pipeline, x: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    prediction = model.predict(x)
    probability = model.predict_proba(x)
    return {
        "accuracy": float(accuracy_score(y, prediction)),
        "macro_f1": float(f1_score(y, prediction, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y, prediction, average="weighted", zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(y, prediction)),
        "log_loss": float(log_loss(y, probability, labels=model.classes_)),
        "within_one_size": within_one_size(y, prediction),
    }


def pipeline(tree: DecisionTreeClassifier) -> Pipeline:
    return Pipeline([("imputer", SimpleImputer(strategy="median")), ("tree", tree)])


def main() -> None:
    args = parse_args()
    source = args.dataset.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(source)
    clean = clean_dataset(raw)
    groups = measurement_groups(clean)
    x = clean[FEATURES]
    y = clean["size"]

    # Measurement-identical rows stay on one side of the holdout. This avoids
    # inflated test scores caused by the many duplicates in the supplied data.
    split = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=RANDOM_STATE)
    train_index, test_index = next(split.split(x, y, groups=groups))
    x_train, x_test = x.iloc[train_index], x.iloc[test_index]
    y_train, y_test = y.iloc[train_index], y.iloc[test_index]
    groups_train = groups.iloc[train_index]

    baseline = pipeline(DecisionTreeClassifier(random_state=RANDOM_STATE))
    baseline.fit(x_train, y_train)
    baseline_metrics = metrics(baseline, x_test, y_test)

    search_space = {
        "tree__criterion": ["gini", "entropy", "log_loss"],
        "tree__max_depth": [4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, None],
        "tree__min_samples_split": [2, 10, 25, 50, 100, 200],
        "tree__min_samples_leaf": [1, 5, 10, 20, 40, 80, 120, 200],
        "tree__max_features": [None, "sqrt"],
        "tree__class_weight": [None, "balanced"],
        "tree__ccp_alpha": [0.0, 1e-5, 5e-5, 1e-4, 5e-4, 1e-3],
    }
    cross_validation = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=RANDOM_STATE)
    search = RandomizedSearchCV(
        pipeline(DecisionTreeClassifier(random_state=RANDOM_STATE)),
        search_space,
        n_iter=40,
        scoring="accuracy",
        cv=cross_validation,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        return_train_score=False,
    )
    search.fit(x_train, y_train, groups=groups_train)
    tuned = search.best_estimator_
    tuned_metrics = metrics(tuned, x_test, y_test)

    # Fit the selected Decision Tree configuration on all available cleaned rows.
    selected = dict(search.best_params_)
    tree_params = {key.replace("tree__", ""): value for key, value in selected.items()}
    tree_params["random_state"] = RANDOM_STATE
    final_model = pipeline(DecisionTreeClassifier(**tree_params))
    final_model.fit(x, y)

    artifact_path = output_dir / "clothing_size_decision_tree_v1.joblib"
    joblib.dump(final_model, artifact_path, compress=3)
    model_bytes = artifact_path.read_bytes()
    model_sha = hashlib.sha256(model_bytes).hexdigest()

    # A text-safe copy is committed with the project and loaded by the service.
    # The raw .joblib file is also produced by this training script for local use.
    (output_dir / "clothing_size_decision_tree_v1.joblib.b64").write_text(
        base64.b64encode(model_bytes).decode("ascii") + "\n", encoding="ascii"
    )

    dataset_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    metadata = {
        "model_name": "VESTRA clothing size Decision Tree",
        "model_version": "1.0.0",
        "model_type": "sklearn.tree.DecisionTreeClassifier",
        "features": FEATURES,
        "feature_units": {"weight": "kg", "age": "years", "height": "cm"},
        "classes": [str(value) for value in final_model.named_steps["tree"].classes_],
        "size_order": SIZE_ORDER,
        "dataset_sha256": dataset_sha,
        "dataset_rows": int(len(raw)),
        "training_rows": int(len(clean)),
        "exact_duplicate_rows": int(raw.duplicated().sum()),
        "training_note": (
            "Age values <=0 or >100 are treated as missing and imputed with the training median. "
            "Missing numeric values are median-imputed inside the persisted pipeline. Repeated "
            "observations are retained for training because they may represent observed frequency; "
            "measurement-identical rows are grouped during evaluation to prevent train/test leakage."
        ),
        "evaluation_split": "80/20 GroupShuffleSplit by (weight, age, height), random_state=42",
        "baseline_metrics": baseline_metrics,
        "tuned_holdout_metrics": tuned_metrics,
        "cross_validation_best_accuracy": float(search.best_score_),
        "selected_params": tree_params,
        "model_sha256": model_sha,
        "python_version": sys.version.split()[0],
        "numpy_version": np.__version__,
        "pandas_version": pd.__version__,
        "scikit_learn_version": sklearn.__version__,
        "joblib_version": joblib.__version__,
    }
    (output_dir / "clothing_size_decision_tree_v1.metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    print(json.dumps({
        "baseline": baseline_metrics,
        "tuned": tuned_metrics,
        "best_cv_accuracy": search.best_score_,
        "selected_params": tree_params,
        "model_sha256": model_sha,
    }, indent=2, default=str))


if __name__ == "__main__":
    main()
