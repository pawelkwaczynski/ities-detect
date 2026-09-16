# RELEASE_CHECK

Parity test of the frozen algorithm in Pyodide (Node) against the CPython baseline.

## Environment

- date: 2026-09-16T21:29:14.795Z
- pyodide: 314.0.7
- python (wasm): 3.14.2
- numpy 2.4.6, scipy 1.18.0, pandas 3.0.2
- algo 1.1  sha256 c0e29b1e799c8fba75a4375cc57ee644866bce96af97df941c79cce5ed118361
- files on disk: 485
- baseline rows: 485
- load pyodide: 0.83 s
- load packages: 0.90 s
- analyze wall: 56.66 s
- rss end: 1224.7 MB

## Gate: 0 differences on status, delta_Es, Ip_analyte_fwd_uA (tol 1e-9)

- compared: 485
- differences: **0**
- missing on disk: 0
- missing in baseline: 0

PASS: Pyodide matches CPython on all compared files.

## Negative test (AMPHETAMINE_TARGET_DELTA_V = 0.356 in memory)

- files re-analysed: 200
- differences vs baseline: **27**
- wall: 21.02 s
PASS: the parity test reports differences when the threshold is wrong. The test can fail.

## Verdict

RELEASE GATE PASS
