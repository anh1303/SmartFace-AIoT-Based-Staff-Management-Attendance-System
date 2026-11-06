# Face authentication validation: unresolved environment checks

The initial full run (`face-auth-tests.log`) discovered 119 tests and reported one failure and 14 errors. After correcting test fixtures and adding two transaction tests, the full rerun (`face-auth-tests-fixed.log`) discovered 121 tests: 118 pass, three errors remain, and no tests are skipped. This is not a passing full Python suite.

The stale vector-query fixture, Windows path comparison, and Windows temporary-file fixture are corrected. From `face_auth`, `PYTHONIOENCODING=utf-8 python -m unittest tests.test_remote_extraction tests.test_vector_db_logic tests.test_calibrate_domain_threshold` passes all 23 tests, including receipt replay and transaction rollback checks using the real upsert/enrollment functions with a buffered database fake. This validates application transaction composition, not PostgreSQL locking or actual pgvector persistence.

## Corrected PAD unit fixtures

Four tests in `test_pad_predictor.TestPadMathAndPredictor` initially failed during predictor construction because they referenced absent production artifacts even though model loading was mocked:

| Test | Missing path under `face_auth/antispoof/models/smartface_pad_artifacts/` |
| --- | --- |
| `test_2class_pad_score_identity` | `minifasnet_v2se/deployment/best_model_quantized.onnx` |
| `test_3class_logsumexp_softmax_equivalence` | `E1_v0_mnv3_large/deployment/mnv3_large_3class_best.onnx` |
| `test_color_order_detection` | `minifasnet_v2se/deployment/best_model_quantized.onnx` (first constructor) |
| `test_default_bbox_expansion_factor` | `E1_v5_1_mnv3/deployment/mnv3_e1_preliminary_v5_1_best.onnx` |

The tests now create temporary placeholder files with meaningful MiniFASNet/MobileNet filenames and explicitly mock input shapes, output shapes, and providers. All four pass without real weights. Numerical assertions are preserved; the crop-factor test now patches configuration and verifies that the predictor honors it instead of asserting a stale production default. This tests predictor logic with supplied logits and metadata, not model inference or deployment artifact validity. No production file checks, PAD mathematics, config thresholds, or inference behavior were changed.

## Missing PyTorch

Three modules fail import with `ModuleNotFoundError: No module named 'torch'`: `test_r7_casia_notebook`, `test_r7_gate_ablation_notebook`, and `test_r7_runtime`. Their individual tests are not collected, so the initial run's count does not represent all R7 cases.

`importlib.util.find_spec('torch')` returned no package for both `python` and the existing workspace `.venv/Scripts/python.exe`. No packages were installed. R7 checks may require additional model/checkpoint artifacts after PyTorch becomes available; that has not been verified.

## Corrected Windows temporary-file fixture

Six `test_remote_extraction.ExtractionTests` cases initially fail in shared setup because Windows prevents reopening an open `NamedTemporaryFile`: `test_actual_onnx_matches_hardware_on_identical_pixels`, `test_api_auth_busy_and_valid_request_without_startup_or_db`, `test_bad_images_dimensions_and_models_never_reach_onnx`, `test_exact_hardware_preprocessing_and_normalized_output`, `test_nonfinite_and_degenerate_outputs_rejected`, and `test_production_insightface_session_matches_existing_pi_model`.

The fixture now writes and closes a file inside a temporary directory before extraction opens it. All six cases pass, including the existing real ONNX preprocessing/parity checks; their numerical assertions are unchanged.

No new tests were skipped. The focused console command requires UTF-8 output on this Windows host because the calibration script prints Vietnamese progress text; the default cp1252 pipe otherwise raises `UnicodeEncodeError`.
