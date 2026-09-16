# ITIES Detect

Colab notebook for detecting amphetamine in cyclic voltammograms recorded at a liquid-liquid interface (ITIES), with an internal TPrA+ reference. It locates the reference and analyte peaks, checks the peak separation against the expected value, reads the peak current with a baseline fitted before the signal (tangent intersection for weak peaks), and converts current to concentration with a calibration curve. Algorithm revision history: `WERSJE_ALGORYTMU.md`.

Companion scripts: calibration fit (`kalibracja_cc.py`), quantitation and purity (`ilosciowka.py`), replicate analysis, false-negative plotting, label evaluation against a lab-labelled folder (`eval_etykiety.py`, `eval_katalog.py`), a detection-threshold grid search (`grid_etykiety.py`), a visual-control PDF for spot-checking borderline files (`kontrola_wizualna_20260916.py`), a headless end-to-end test (`test_ities_local.py`) and an end-to-end purity check (`test_end2end_czystosc.py`). More diagnostics under `tools/`.

`web/` is a browser-only build of the same algorithm: Pyodide runs the frozen `algo/*.py` file unchanged in a Web Worker, a small Flask server only serves static files and a version manifest. See `web/README.md`.

`docs/analizy_2026-09/` holds the September evaluation against the lab-labelled set (sensitivity/specificity, threshold sweeps, literature check).

Measurement data and the laboratory calibration constants are not part of this repository. Work in progress with the Electrochemistry@Soft Interfaces group, University of Łódź.
