#!/usr/bin/env python3
"""
Przebieg algorytmu ITIES po DOWOLNYM drzewie katalogow (rekurencyjnie), np. amfa_probki.
Bierze pliki .txt i bez rozszerzenia, pomija .nox/.pdf/.xlsx itd.
Zapisuje CSV: podkatalog, plik, status, dE_s, Ip, ostrzezenia, crash.
Uzycie: python3 eval_katalog.py KATALOG --out WYNIK.csv [--set K=V ...]
"""
import argparse, ast, csv, os, sys, time
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_ities_local import load_algorithm

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root"); ap.add_argument("--out", required=True)
    ap.add_argument("--set", action="append", default=[])
    a = ap.parse_args()
    algo = load_algorithm()
    for kv in a.set:
        k, v = kv.split("=", 1); algo.__dict__[k] = ast.literal_eval(v); print("[override]", k, algo.__dict__[k])
    rows = []; t0 = time.time()
    for dp, dn, fn in os.walk(a.root):
        dn[:] = sorted(d for d in dn if not d.startswith("."))
        for f in sorted(fn):
            if f.startswith(".") or f == "desktop.ini": continue
            ext = os.path.splitext(f)[1].lower()
            if ext not in ("", ".txt", ".csv"): continue
            path = os.path.join(dp, f); rel = os.path.relpath(dp, a.root)
            row = {"podkatalog": rel, "plik": f, "bajty": os.path.getsize(path)}
            algo.RESULTS.clear()
            try:
                r = algo.analyze(f, open(path, "rb").read())
                ws = r.get("warnings") or []
                row.update({"status": r.get("status"), "delta_Es": r.get("delta_Es"),
                            "error_mV": r.get("error_mV"), "shift": r.get("shift"),
                            "amp_analyte_uA": r.get("amplitude_analyte_uA"),
                            "Ip_analyte_fwd_uA": r.get("Ip_analyte_fwd_uA"),
                            "c_analyte_uM": r.get("c_analyte_uM"),
                            "n_cycles": r.get("n_cycles"), "internal_reason": r.get("internal_reason"),
                            "warn_codes": "|".join(w.get("code","") for w in ws),
                            "warning": (r.get("warning") or "")[:200]})
            except Exception as exc:
                row.update({"status": "EXCEPTION", "warning": repr(exc)[:200]})
            rows.append(row)
    keys = sorted({k for r in rows for k in r})
    with open(a.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys); w.writeheader(); w.writerows(rows)
    c = Counter(r["status"] for r in rows)
    print(f"{len(rows)} plikow, {time.time()-t0:.0f} s -> {a.out}")
    for st, k in c.most_common(): print(f"  {st:26s} {k:5d}")
if __name__ == "__main__": main()
