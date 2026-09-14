from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

SIZE_ORDER = ["XXS", "S", "M", "L", "XL", "XXL", "XXXL"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create documentation visuals for the VESTRA size dataset.")
    parser.add_argument("dataset", type=Path, help="Path to final_test.csv")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent / "figures")
    return parser.parse_args()


def load_and_clean(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    frame = frame[["weight", "age", "height", "size"]].copy()
    for column in ["weight", "age", "height"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["size"] = frame["size"].astype(str).str.strip().str.upper()
    frame.loc[(frame["age"] <= 0) | (frame["age"] > 100), "age"] = np.nan
    return frame


def save_current(path: Path) -> None:
    plt.tight_layout()
    plt.savefig(path, dpi=180, bbox_inches="tight")
    plt.close()


def main() -> None:
    args = parse_args()
    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    frame = load_and_clean(args.dataset)

    plt.figure(figsize=(8, 5))
    sns.countplot(data=frame, x="size", order=SIZE_ORDER)
    plt.title("Clothing Size Class Distribution")
    plt.xlabel("Size")
    plt.ylabel("Rows")
    save_current(output / "size_distribution.png")

    for column, title, xlabel in [
        ("weight", "Weight Distribution", "Weight (kg)"),
        ("height", "Height Distribution", "Height (cm)"),
        ("age", "Age Distribution", "Age (years)"),
    ]:
        plt.figure(figsize=(8, 5))
        sns.histplot(frame[column].dropna(), bins=30, kde=True)
        plt.title(title)
        plt.xlabel(xlabel)
        plt.ylabel("Rows")
        save_current(output / f"{column}_distribution.png")

    plt.figure(figsize=(8, 6))
    correlation = frame[["weight", "age", "height"]].corr(numeric_only=True)
    sns.heatmap(correlation, annot=True, fmt=".2f", square=True)
    plt.title("Measurement Correlation")
    save_current(output / "measurement_correlation.png")

    plt.figure(figsize=(10, 5))
    sns.boxplot(data=frame, x="size", y="weight", order=SIZE_ORDER)
    plt.title("Weight by Clothing Size")
    plt.xlabel("Size")
    plt.ylabel("Weight (kg)")
    save_current(output / "weight_by_size.png")

    print(f"Saved figures to {output.resolve()}")


if __name__ == "__main__":
    main()
