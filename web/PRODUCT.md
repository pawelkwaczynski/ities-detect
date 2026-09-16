# Product

## Platform

web

## Stack
Plain static HTML/CSS/JS modules (no build step, no framework) + Pyodide (Python in WebAssembly) in a Web Worker for the analysis; a minimal Flask/gunicorn server on the Mikrus Frog VPS (256 MB RAM, Alpine 3.23, Python 3.12) only serves files and a version manifest. Chosen because the server cannot afford numpy/scipy in RAM, the algorithm must stay 1:1 with the lab notebook (proven: Pyodide result == CPython result to 1e-9 on test files), and raw measurement files must be able to stay on the user's computer.

## Users
Assumed from the brief, not interviewed. Primary: the electrochemistry lab of prof. Łukasz Półtorak (University of Łódź) analysing cyclic voltammetry (CV) files exported from a Metrohm Autolab / NOVA potentiostat, several to a few hundred TXT files per session, on a lab PC with Chrome/Edge. Secondary (later): police forensic technicians who need a verdict per sample and a printable report; they may not be allowed to upload files to the internet.

## Product Purpose
Turn a CV file into a defensible verdict on amphetamine presence (ITIES method: ion transfer across a liquid/liquid interface, TPrA+ as internal standard, ΔE_s = 0.350 V criterion) with the evidence shown (points 1-4 on the curve, ΔE_s, Ip, concentration) and full traceability (algorithm version + hashes). Success: a lab member gets the same result as the reference notebook in seconds, understands why, and can print or export it.

## Positioning
The only tool built on the lab's own validated procedure (Półtorak group protocol: last full cycle, baseline before signal, two Ip procedures) with measured sensitivity and specificity on lab-labelled data; the algorithm file that runs in the browser is byte-identical to the one validated offline.

## Operating Context
Files: NOVA TXT exports, two variants (";" separator with decimal comma and Scan/Index columns; tab separator with decimal point, two columns "Potential applied (V)", "WE(1).Current (A)"). Binary .nox files cannot be read (must be exported to TXT). Samples usually have several replicate files and a file without the standard (pre-TPrA). Verdict vocabulary (from the notebook): detected / uncertain / not_detected / TPrA_ONLY / MEASUREMENT_QUALITY_FAIL (reasons NO_CANDIDATES, NO_TPRA_IN_WINDOWS, NO_VALID_TPRA_PAIR) / NO_VALID_ANALYTE_PAIR / too_few_points / invalid. The lab reads weak peaks by hand in Origin, so an expert manual mode (pick points 1-4) is part of the workflow.

## Capabilities and Constraints
- Algorithm versions are frozen Python files in `algo/` (v1.0 = notebook state of 2026-08-20, v1.1 = 2026-09-16 diagnostics); `algo/versions.json` is the manifest; the UI must show the version and its sha256 on every result and report.
- Measured on lab-labelled data (16.09.2026, v1.0/v1.1): 121/293 positive files detected (41.3 %), 0/147 negatives and 0/45 neutrals falsely detected; only 26 negatives reached the ΔE_s criterion. The UI must never claim more.
- Not decided (open with the lab): widening the "uncertain" band from 15 to 30 mV; a TPrA identity test; the fate of sample 73-5. The UI keeps thresholds as displayed constants of the loaded algorithm version, never editable in the UI.
- Server: 256 MB RAM shared with nothing else after StudentSpot is retired; ~2.5 GB disk; no root; Python 3.12 venv; port 20412 published as https://frog01-20412.wykr.es.
- Data never has to leave the browser; sessions are kept client-side (IndexedDB) with export; no accounts in v1.
- Terminology stays Polish in the UI (lab language); code and comments in English.

## Brand Commitments
Product name: "ITIES Detect". Logo assets: `assets/ities_logo_B.png` (shield with flask, navy/blue/red; preferred), `assets/ities_logo_A.jpg`. The hub page also hosts a second tile for the sister CV analyser for 3D-printed electrodes; name decided by the owner on 2026-09-16: "PeakWise" (the label is still a single config constant). No logo exists for it yet; ship a typographic placeholder tile and hand the owner an image-generation prompt.
Pinned aesthetic (owner's brief): "friendly, Apple macOS-like GUI".

## Evidence on Hand
- Reference results for parity: `../wyniki_analizy/eval_etykiety_20260916_baseline.csv` (485 files, CPython) and the files in `../07_etykiety_lab_20260916/`.
- Real sample files for demo/tests (lab data, not to be published): `../07_etykiety_lab_20260916/Pozytywne/93P_300ul_TPra(1).txt` (uncertain, ΔE_s 0.3638), `../07_etykiety_lab_20260916/Pozytywne/92-1_200ul_TPrA(1).txt` etc.
- Pyodide feasibility report: `../../../../../../private/tmp` scratch (numbers: 34 MB first load without matplotlib, ~5 s start, 0.03-0.16 s per file, identical results).
- Absent: no user testimonials, no police requirements document, no formal report template from the lab. Do not invent them.

## Product Principles
1. The verdict is only as good as its evidence: every verdict is shown with the curve, the four points and the number that decided it.
2. Same code everywhere: the browser runs the validated Python file unchanged; a JS re-implementation is forbidden.
3. Honest words: "not detected" means no signal met the criterion in this measurement, never "the sample contains no amphetamine"; measurement-quality failures are about the measurement, not the sample.
4. Traceable by default: algorithm version, thresholds, file hashes and timestamps travel with every result and report.
5. Light on the server, private for the user: files can stay on the computer; the server can be a static host.
