#!/usr/bin/env python3
"""
Lokalny walidator ITIES — uruchamia algorytm z notebooka na katalogu plików TXT,
bez Colaba i bez ręcznego uploadu. Do szybkiego regresyjnego testu po każdej zmianie.

Użycie:
    python3 test_ities_local.py [KATALOG_Z_PLIKAMI]
    (domyślnie: ~/Desktop/ITIES_DETECT/odczyty_laboratoryjne)

Co robi:
    - wyciąga logikę analityczną z ITIES_Detect.ipynb (komórka kodu),
    - podmienia upload/rysowanie na tryb headless,
    - liczy rozkład statusów, wykrywa crashe,
    - sprawdza spójność detected ΔE_s i sygnalizuje wartości spoza zakresu.
"""
import glob
import json
import os
import sys
import types
from collections import Counter

NB = os.path.join(os.path.dirname(__file__), "ITIES_Detect.ipynb")
DEFAULT_DIR = os.path.expanduser("~/Desktop/ITIES_DETECT/odczyty_laboratoryjne")
DELTA_OK = (0.340, 0.360)   # szeroki zakres sanity dla detected ΔE_s


def load_algorithm():
    """Ładuje kod z komórki notebooka jako moduł, w trybie headless."""
    nb = json.load(open(NB))
    code_cell = next(c for c in nb["cells"]
                     if c["cell_type"] == "code" and "def analyze" in "".join(c["source"]))
    src = "".join(code_cell["source"])
    src = src[:src.index("# ─── Upload i uruchomienie")]          # odetnij upload
    src = src.replace("import matplotlib.pyplot as plt",
                      "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt")
    src = src.replace("from IPython.display import display", "def display(*a, **k): pass")
    src += ("\ndef _finalize(result, E=None, I=None):\n"
            "    RESULTS[result['file_name']] = result\n"
            "    return result\n")
    mod = types.ModuleType("ities_algo")
    exec(compile(src, NB, "exec"), mod.__dict__)
    return mod


def main():
    data_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DIR
    algo = load_algorithm()
    files = [f for f in sorted(glob.glob(os.path.join(data_dir, "*")))
             if os.path.isfile(f) and not f.endswith(".DS_Store")]
    if not files:
        print(f"Brak plików w {data_dir}")
        return 1

    statuses, crashes, det = Counter(), [], []
    for f in files:
        name = os.path.basename(f)
        algo.RESULTS.clear()
        try:
            r = algo.analyze(name, open(f, "rb").read())
            statuses[r.get("status")] += 1
            if r.get("status") == "detected":
                det.append((name, r.get("delta_Es"), r.get("amplitude_analyte_uA"),
                            r.get("Ip_analyte_fwd_uA")))
        except Exception as exc:
            crashes.append((name, repr(exc)[:100]))
            statuses["EXCEPTION"] += 1

    print(f"\n{'='*60}\nWALIDATOR ITIES — {len(files)} plików z {data_dir}\n{'='*60}")
    for st, c in statuses.most_common():
        print(f"  {st:26s} {c:4d}")

    print(f"\nCRASHE: {len(crashes)}")
    for n, e in crashes[:20]:
        print(f"  ✗ {n} → {e}")

    if det:
        ds = sorted(d for _, d, _, _ in det if d is not None)
        amps = [a for _, _, a, _ in det if a is not None]
        ips  = [i for _, _, _, i in det if i is not None]
        print(f"\ndetected ΔE_s: n={len(ds)} min={ds[0]:.4f} "
              f"med={ds[len(ds)//2]:.4f} max={ds[-1]:.4f}")
        if amps:
            print(f"detected amplituda analitu: min={min(amps):.2f} µA "
                  f"(im wyżej, tym mniejsze ryzyko fałszywego trafienia z szumu)")
        print(f"Ip analitu (baseline, przepis prof. 20.07): {len(ips)}/{len(det)} plików"
              + (f", min={min(ips):.2f} med={sorted(ips)[len(ips)//2]:.2f} "
                 f"max={max(ips):.2f} µA" if ips else " — UWAGA: 0, regresja baseline?"))
        outliers = [(n, d) for n, d, _, _ in det if d is not None and not (DELTA_OK[0] <= d <= DELTA_OK[1])]
        print(f"detected poza {DELTA_OK} V: {len(outliers)}")
        for n, d in outliers[:10]:
            print(f"  ⚠️ {d:.4f}  {n}")

    print("\nOK — brak crashy." if not crashes else "\nUWAGA: są crashe (patrz wyżej).")
    return 0 if not crashes else 2


if __name__ == "__main__":
    sys.exit(main())
