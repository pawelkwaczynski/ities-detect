# RELEASE_CHECK, PeakWise

Parity gate: the frozen module running in Pyodide against the same module running in
CPython, compared field by field on the whole result dictionary (peaks, baselines,
methods, warnings, CSV row and the 50 sampled baseline points per branch).

## Environment

- date: 2026-09-16T21:29:55.568Z
- pyodide: 314.0.7
- python (wasm): 3.14.2, numpy 2.4.6, scipy 1.18.0, pandas 3.0.2
- python (cpython baseline): CPython 3.14.7 (numpy 2.4.6, scipy 1.18.0, pandas 3.0.5)
- algo 1.0, file sha256 2d021d6e1ded7b9822acb984c25cb8ca41242fe9ed937069d49378adf9b47eed
- notebook cell sha256 9c0340708dcb31efac22c39a8fb5ccfb6ad9e73dbc37d66dc35de81ca48cb954
- files on disk: 188, baseline records: 188
- load pyodide 0.83 s, packages 0.89 s, analyze 0.95 s
- rss at end: 830.9 MB

## Gate (abs tol 1e-9, rel tol 1e-12)

- compared files: 188
- identical on every field: **187 of 188**
- inside the documented tie bound: 1
- real differences: **0**
- total differing fields: 125
- missing on disk: 0, missing in baseline: 0
- largest numeric deviation seen anywhere in the parity phase, the tie file included: 9.955e+0 absolute (2.147e-3 relative) at cathodic.tangent_at_x_nA

PASS WITH 1 TIE: every file matches except peak indices that landed on the neighbouring sample. The strict zero-difference goal is NOT met; the files below are inside the bound (Ep at most 5 mV, Ip at most 0.1 % apart, same status, one branch).

### Ties

- `SPE iterations/LEYER HEIGHT/0,24/0,24 A/0,24(A) 1 mM FeMeOH ba(2)` (125 fields): Ep_c_V: got -0.102081298828125 exp -0.104522705078125; Ip_c_nA: got -5017.404057616482 exp -5018.680995243802; Ip_c_uA: got -5.017404057616481 exp -5.018680995243802; Ip_ratio: got 1.7109312370139549 exp 1.7104959129763504

Cause, measured with tools/diagnose_file.mjs: the parsed E and I arrays are byte identical in both runtimes; the Savitzky-Golay output is not, because the WASM build of scipy rounds the filter differently in the last bits. Where two adjacent smoothed samples are equal to 14 significant digits, find_peaks picks a different one of the two.

## Negative test (`IP_DEFINICJA = 'styczne'` in memory)

- files re-analysed: 188
- files that now differ from the baseline: **156**
- wall: 0.83 s
PASS: the gate reports differences when the Ip definition is changed, so it can fail.

## Notebook agreement

- cv_wyniki_zbiorcze.csv: 7 rows, 4 matched by name, 3 matched by value under another name, 0 unmatched
- `BH FDM 1Ś BA 0(1).5mM FeMeOH`: identical on all 20 columns
- `BH FDM 1Ś BA 0(2).5mM FeMeOH`: identical on all 20 columns
- `BH FDM 1Ś BA 0(3).5mM FeMeOH`: identical on all 20 columns
- `BH FDM 1Ś BA 0.5mM FeMeOH`: identical on all 20 columns
- `WE_1mm_A`: file name absent from the lab tree, all 20 columns identical to `SPE iterations/WE/1mm/1 mm A/1 set 1 mm 1mM FeMeOH ba (0).txt`
- `WE_3mm (original version)_A`: file name absent from the lab tree, all 20 columns identical to `SPE iterations/WE/3mm (original version)/3 mm A/1 set 3mm 1 mM FeMeOH ba`
- `WE_4mm_A`: file name absent from the lab tree, all 20 columns identical to `SPE iterations/WE/4mm/4 mm A/1 set 4mm 1 mM FeMeOH ba`

## Verdict

RELEASE GATE PASS with 1 documented tie, strict zero differences NOT reached
