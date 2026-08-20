# ITIES Detect

Colab notebook for detecting amphetamine in cyclic voltammograms recorded at a liquid-liquid interface (ITIES), with an internal TPrA+ reference. It locates the reference and analyte peaks, checks the peak separation against the expected value, reads the peak current with a baseline fitted before the signal (tangent intersection for weak peaks), and converts current to concentration with a calibration curve.

Companion scripts: calibration fit (`kalibracja_cc.py`), quantitation and purity (`ilosciowka.py`), replicate analysis, false-negative plotting, and a headless end-to-end test (`test_ities_local.py`).

Measurement data and the laboratory calibration constants are not part of this repository. Work in progress with the Electrochemistry@Soft Interfaces group, University of Łódź.
