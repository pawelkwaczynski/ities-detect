# RELEASE_CHECK, PeakWise

Parity gate: the frozen module running in Pyodide against the same module running in
CPython, compared field by field on the whole result dictionary (peaks, baselines,
methods, warnings, CSV row and the 50 sampled baseline points per branch).

## Environment

- date: 2026-10-25T17:32:50.233Z
- pyodide: 314.0.7
- python (wasm): 3.14.2, numpy 2.4.6, scipy 1.18.0, pandas 3.0.2
- python (cpython baseline): 3.12.13, numpy 2.5.4, scipy 1.18.1, pandas 3.1.0
- cpython baseline file: baseline_cpython_v1.1.jsonl
- algo 1.1, file sha256 66e25f0a8446f6dfcb8e900ef92e265f89aee2ece9f36b2121c0f519fa0a2436
- notebook cell sha256 047f739744fc44ff1a0405bbd96b5e3dd8e09573f2744d96b89d20939e4481a3
- files on disk: 188, baseline records: 188
- load pyodide 1.97 s, packages 2.01 s, analyze 2.16 s
- rss at end: 812.7 MB

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
- wall: 2.13 s
PASS: the gate reports differences when the Ip definition is changed, so it can fail.

## Notebook agreement

- Notebook cells 1 (SETUP) and 10 (CSV export) on all 184 files of `SPE iterations` (PNG files skipped): 184 rows, 26 columns
- PeakWise 1.1 `result_row(analyze(...))` identical on all 26 columns in 184 of 184 rows

## Verdict

RELEASE GATE PASS with 1 documented tie, strict zero differences NOT reached
