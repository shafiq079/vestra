# Decision Tree training and analysis

The client documentation specifies a **Decision Tree** model. The supplied dataset contains:

- `weight` in kilograms
- `age` in years
- `height` in centimetres
- `size` as the target class

Install the training dependencies from `ml-service/`:

```bash
pip install -r requirements-training.txt
```

Keep the client-supplied `final_test.csv` outside the repository, then run:

```bash
python training/visualize.py /path/to/final_test.csv
python training/train.py /path/to/final_test.csv
```

The visualisation script uses Pandas/NumPy for preparation and Seaborn/Matplotlib for documentation figures.

The training script:

1. validates and cleans the supplied fields;
2. treats impossible age values as missing;
3. keeps median imputation inside the persisted pipeline;
4. compares a basic Decision Tree with a tuned Decision Tree;
5. groups identical `(weight, age, height)` combinations during evaluation to reduce leakage from duplicated observations;
6. tunes Decision Tree hyperparameters with grouped cross-validation;
7. evaluates exact accuracy, balanced accuracy, F1, log loss and within-one-size accuracy;
8. trains the selected Decision Tree on all cleaned observations;
9. exports the model and metadata/checksums used by the deployed FastAPI service.

The raw client dataset is intentionally not committed. Its SHA-256 checksum is recorded in the model metadata so the training source can be verified.

Current version 1.0.0 holdout evidence is approximately **49.8% exact-size accuracy** and **77.5% within-one-size accuracy**. These figures should be reported as model limitations as well as results; this feature provides sizing guidance rather than a fit guarantee.
