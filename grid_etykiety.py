#!/usr/bin/env python3
"""
Siatka parametrow na zbiorze z etykietami (Pozytywne/Negatywy/Neutrale):
  PEAK_PROMINENCE_A x filtr krawedzi (EDGE_FRAC, EDGE_MIN_PTS) x tolerancja dE_s (post hoc).
Tolerancja nie wplywa na wybor pary, wiec liczona jest po fakcie z dE_s.
Wynik: JSON per konfiguracja (status + dE_s per plik) i tabela zbiorcza.
Uzycie: python3 grid_etykiety.py --prom 1.5e-7 [--edges 0.08:12,0.04:6,0.02:3,0:0]
"""
import argparse, json, os, sys, time
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_ities_local as T

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "07_etykiety_lab_20260916")
OUT  = os.path.join(HERE, "..", "wyniki_analizy", "grid_20260916")

def load_algo_with_edge():
    """Jak load_algorithm(), ale filtr krawedzi sterowany stalymi EDGE_FRAC / EDGE_MIN_PTS."""
    nb = json.load(open(T.NB))
    cell = next(c for c in nb["cells"] if c["cell_type"] == "code" and "def analyze" in "".join(c["source"]))
    src = "".join(cell["source"]); src = src[:src.index("# ─── Upload i uruchomienie")]
    old = "edge   = max(12, int(len(idx) * 0.08))"
    assert src.count(old) == 1, "nie znaleziono linii filtra krawedzi"
    src = src.replace(old, "edge   = max(EDGE_MIN_PTS, int(len(idx) * EDGE_FRAC))")
    src = "EDGE_FRAC = 0.08\nEDGE_MIN_PTS = 12\n" + src
    src = src.replace("import matplotlib.pyplot as plt", "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt")
    src = src.replace("from IPython.display import display", "def display(*a, **k): pass")
    src += "\ndef _finalize(result, E=None, I=None):\n    RESULTS[result['file_name']] = result\n    return result\n"
    import types; mod = types.ModuleType("ities_grid"); exec(compile(src, T.NB, "exec"), mod.__dict__); return mod

def run(algo, files):
    out = []
    for cls, name, path in files:
        algo.RESULTS.clear()
        try:
            r = algo.analyze(name, open(path, "rb").read())
            out.append({"klasa": cls, "plik": name, "status": r.get("status"), "delta": r.get("delta_Es"),
                        "amp": r.get("amplitude_analyte_uA")})
        except Exception as exc:
            out.append({"klasa": cls, "plik": name, "status": "EXCEPTION", "delta": None, "crash": repr(exc)[:100]})
    return out

def score(res, tol_mV):
    s = {}
    for cls in ("Pozytywne", "Negatywy", "Neutrale"):
        sub = [r for r in res if r["klasa"] == cls]
        hit = sum(1 for r in sub if r["delta"] is not None and abs(r["delta"] - 0.350) * 1000 <= tol_mV + 1e-9)
        s[cls] = (hit, len(sub))
    s["crash"] = sum(1 for r in res if r["status"] == "EXCEPTION")
    return s

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prom", type=float, required=True)
    ap.add_argument("--edges", default="0.08:12,0.04:6,0.02:3,0:0")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    files = []
    for cls in ("Pozytywne", "Negatywy", "Neutrale"):
        d = os.path.join(DATA, cls)
        files += [(cls, f, os.path.join(d, f)) for f in sorted(os.listdir(d)) if not f.startswith(".") and f != "desktop.ini"]
    algo = load_algo_with_edge()
    algo.PEAK_PROMINENCE_A = a.prom
    summary = []
    for e in a.edges.split(","):
        frac, mn = e.split(":"); algo.EDGE_FRAC = float(frac); algo.EDGE_MIN_PTS = int(mn)
        t0 = time.time(); res = run(algo, files)
        tag = f"prom{a.prom:.2e}_edge{frac}_{mn}"
        json.dump(res, open(os.path.join(OUT, tag + ".json"), "w"), default=str)
        for tol in (10, 15, 20, 25, 30):
            s = score(res, tol)
            summary.append({"prom": a.prom, "edge_frac": float(frac), "edge_min": int(mn), "tol_mV": tol,
                            "TP": s["Pozytywne"][0], "nP": s["Pozytywne"][1],
                            "FP_neg": s["Negatywy"][0], "nN": s["Negatywy"][1],
                            "FP_neut": s["Neutrale"][0], "nU": s["Neutrale"][1], "crash": s["crash"]})
        print(f"{tag}: {time.time()-t0:.0f} s, crash={score(res,10)['crash']}", flush=True)
    json.dump(summary, open(os.path.join(OUT, f"summary_prom{a.prom:.2e}.json"), "w"))
    for s in summary:
        print(f"prom={s['prom']:.2e} edge={s['edge_frac']}/{s['edge_min']:<2d} tol={s['tol_mV']:2d}: "
              f"czulosc {s['TP']}/{s['nP']}={100*s['TP']/s['nP']:.1f}%  FP_neg {s['FP_neg']}/{s['nN']}  FP_neut {s['FP_neut']}/{s['nU']}")
if __name__ == "__main__": main()
