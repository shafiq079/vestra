# Phase 13 — ML Size Recommendation audit

## Implemented

- Real client-required `DecisionTreeClassifier` trained from the supplied size dataset.
- NumPy/Pandas cleaning and reproducible training script.
- Seaborn/Matplotlib documentation visualisation script.
- Grouped holdout evaluation to prevent identical measurement combinations leaking between train and test.
- Tuned Decision Tree persisted with model and dataset SHA-256 metadata.
- Independent FastAPI inference service with service-to-service authentication.
- Express schema and recommendation proxy routes.
- Schema-driven frontend measurement form.
- Metric/imperial handling, recommendation confidence, alternative size, explanation and fit disclaimer.
- Safe degradation when the Python service is unavailable.
- Backend integration tests and Python API tests.
- Render two-service deployment configuration and Phase 13 deployment guidance.

## Model evidence

The tuned Decision Tree holdout metrics recorded in the committed metadata are:

- Exact-size accuracy: `0.497803`
- Weighted F1: `0.497842`
- Macro F1: `0.425028`
- Balanced accuracy: `0.423490`
- Within-one-adjacent-size accuracy: `0.775461`
- Log loss: `1.16008`

The training workflow was rerun from the supplied CSV and reproduced the same selected hyperparameters, holdout metrics and model SHA-256. These values are reported as measured results, not inflated. The feature is presented as size guidance rather than guaranteed fit.

## Automated verification

GitHub Actions Phase 13 CI completed successfully for the feature branch:

- Backend TypeScript build — passed.
- Full backend regression suite — `313/313` tests passed across `20/20` test files.
- Phase 13 backend integration tests — `8/8` passed.
- Frontend production build — passed.
- Python FastAPI/model tests — `8/8` passed.
- Trained model checksum is verified when the Python service starts.

## Known limitations

- The supplied dataset contains only `weight`, `age`, `height` and `size`; it does not contain bust/chest, waist, hips, shoulder, inseam, garment type or preferred fit as model features.
- `XS` is not represented as a learned target class in the supplied dataset. Express maps an unavailable predicted class to the nearest product size when necessary.
- Some target classes are heavily imbalanced, especially `XXL`.
- Decision Tree leaf probabilities are used as confidence guidance and should not be interpreted as a calibrated or guaranteed-fit probability.
- Product model keys currently act as aliases to the same v1 Decision Tree because the supplied dataset contains no garment-category feature. The schema/service boundary allows category-specific models to replace these aliases later without changing the frontend form architecture.

## Verification still required before production merge

- Run one real smoke test of `React -> Express -> FastAPI` after the two services are configured with the shared ML service key.
- Production Render deployment is intentionally not performed from the feature branch; `main` remains the production branch.
