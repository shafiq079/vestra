from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pandas as pd


def test_visualisation_script_creates_documentation_figures(tmp_path: Path) -> None:
    dataset = tmp_path / "sample.csv"
    pd.DataFrame(
        {
            "weight": [45, 52, 60, 68, 77, 88, 100],
            "age": [21, 24, 29, 34, 42, 51, 60],
            "height": [154, 160, 166, 172, 178, 184, 190],
            "size": ["XXS", "S", "M", "L", "XL", "XXL", "XXXL"],
        }
    ).to_csv(dataset, index=False)
    output = tmp_path / "figures"

    completed = subprocess.run(
        [sys.executable, "training/visualize.py", str(dataset), "--output-dir", str(output)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    expected = {
        "size_distribution.png",
        "weight_distribution.png",
        "height_distribution.png",
        "age_distribution.png",
        "measurement_correlation.png",
        "weight_by_size.png",
    }
    assert {path.name for path in output.glob("*.png")} == expected
    assert all(path.stat().st_size > 0 for path in output.glob("*.png"))
