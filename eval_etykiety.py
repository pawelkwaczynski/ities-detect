#!/usr/bin/env python3
"""
Ewaluacja algorytmu ITIES na zbiorze z ETYKIETAMI laboratorium (16.09.2026):
  07_etykiety_lab_20260916/{Pozytywne,Negatywy,Neutrale}
Liczy czulosc (pozytywy), swoistosc (negatywy) i zachowanie na neutralach.
Zapisuje pelny CSV do wyniki_analizy/ oraz JSON z wynikami (do dalszych analiz ROC).

Uzycie:
  python3 eval_etykiety.py [--tag NAZWA] [--set KLUCZ=WARTOSC ...] [--dir KATALOG]
  --set pozwala nadpisac stale notebooka (np. --set WEAK_PEAK_CANDIDATES=True
        --set DETECTION_TOLERANCE_V=0.015) BEZ zmiany notebooka.
Kod wyjscia 0 gdy 0 crashy, 2 gdy sa crashe.
"""
import argparse, ast, csv, json, os, re, sys, time
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_ities_local import load_algorithm

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "07_etykiety_lab_20260916")
OUT  = os.path.join(HERE, "..", "wyniki_analizy")
CLASSES = ("Pozytywne", "Negatywy", "Neutrale")

def grupa_negatywu(name):
    n = name.lower()
    if "codeine" in n and "tpra" in n: return "kodeina+TPrA"
    if "codeine" in n: return "kodeina"
    if "blank" in n: return "blank"
    if "mef" in n: return "mefedron"
    if "amf" in n: return "amfetamina_bez_TPrA"
    if "psylo" in n: return "psylocybina"
    if "hode" in n: return "HODE"
    if "tea" in n: return "TEA"
    if "tma" in n: return "TMA"
    if "pce" in n: return "PCE"
    if "brilliant" in n: return "BrilliantBlue"
    if "naoh" in n or "lioh" in n: return "zasada_sama"
    return "inne"

def sample_id(name):
    """Identyfikator PROBKI (bez numeru powtorzenia), do podzialu na foldy bez przecieku."""
    n = os.path.splitext(name)[0]
    n = re.sub(r"\(\d+\)$", "", n)          # (1), (2)
    n = re.sub(r"[ _]\d+$", "", n)          # ' 2', '_3'
    return n.strip().lower()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default=time.strftime("%Y%m%d"))
    ap.add_argument("--set", action="append", default=[])
    ap.add_argument("--dir", default=DATA)
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    algo = load_algorithm()
    for kv in a.set:
        k, v = kv.split("=", 1)
        if not hasattr(algo, k):
            sys.exit(f"Nieznana stala notebooka: {k}")
        algo.__dict__[k] = ast.literal_eval(v)
        print(f"[override] {k} = {algo.__dict__[k]}")

    rows, crashes = [], []
    t0 = time.time()
    for cls in CLASSES:
        d = os.path.join(a.dir, cls)
        files = sorted(f for f in os.listdir(d) if not f.startswith(".") and f != "desktop.ini")
        for f in files:
            algo.RESULTS.clear()
            path = os.path.join(d, f)
            row = {"klasa": cls, "plik": f, "probka": sample_id(f),
                   "grupa": grupa_negatywu(f) if cls == "Negatywy" else cls.lower()}
            try:
                r = algo.analyze(f, open(path, "rb").read())
            except Exception as exc:
                crashes.append((cls, f, repr(exc)[:160]))
                row.update({"status": "EXCEPTION", "crash": repr(exc)[:160]})
                rows.append(row); continue
            ws = r.get("warnings") or []
            row.update({
                "status": r.get("status"), "status_pl": r.get("status_pl"),
                "binary_result": r.get("binary_result"),
                "review_required": r.get("review_required"),
                "delta_Es": r.get("delta_Es"), "error_mV": r.get("error_mV"),
                "shift": r.get("shift"),
                "E1": r.get("E1"), "E2": r.get("E2"), "E3": r.get("E3"), "E4": r.get("E4"),
                "amp_TPrA_uA": r.get("amplitude_TPrA_uA"),
                "amp_analyte_uA": r.get("amplitude_analyte_uA"),
                "Ip_analyte_fwd_uA": r.get("Ip_analyte_fwd_uA"),
                "Ip_TPrA_fwd_uA": r.get("Ip_TPrA_fwd_uA"),
                "peak_shape_fwd": r.get("peak_shape_analyte_fwd"),
                "n_cycles": r.get("n_cycles"), "cycle_used": r.get("cycle_used"),
                "n_fwd": r.get("n_forward_candidates", r.get("n_fwd")),
                "n_bwd": r.get("n_backward_candidates", r.get("n_bwd")),
                "internal_reason": r.get("internal_reason"),
                "msg_code": r.get("message_code", r.get("msg_code")),
                "warn_codes": "|".join(w.get("code", "") for w in ws),
                "e_col": r.get("e_col"), "i_col": r.get("i_col"),
                "LOD_uM": r.get("LOD_uM"), "LOQ_uM": r.get("LOQ_uM"), "LOQ_zrodlo": r.get("LOQ_zrodlo"),
                "n_par_sanity": r.get("n_par_sanity"), "second_best_error_mV": r.get("second_best_error_mV"),
            })
            rows.append(row)
    dt = time.time() - t0

    os.makedirs(OUT, exist_ok=True)
    keys = sorted({k for r in rows for k in r})
    csv_path = os.path.join(OUT, f"eval_etykiety_{a.tag}.csv")
    with open(csv_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys); w.writeheader(); w.writerows(rows)
    json.dump(rows, open(os.path.join(OUT, f"eval_etykiety_{a.tag}.json"), "w"),
              ensure_ascii=False, indent=0, default=str)

    # ---- podsumowanie ----
    def tab(sub):
        c = Counter(r["status"] for r in sub); n = len(sub)
        det = c.get("detected", 0); unc = c.get("uncertain", 0)
        return n, det, unc, c
    print(f"\n{'='*70}\nEWALUACJA NA ETYKIETACH LAB ({a.tag}) — {len(rows)} plikow, {dt:.0f} s\n{'='*70}")
    for cls in CLASSES:
        sub = [r for r in rows if r["klasa"] == cls]
        n, det, unc, c = tab(sub)
        if cls == "Pozytywne":
            print(f"POZYTYWNE n={n}: WYKRYTO {det} ({100*det/n:.1f} %), +NIEPEWNE {det+unc} ({100*(det+unc)/n:.1f} %)")
        else:
            print(f"{cls.upper()} n={n}: falszywe WYKRYTO {det} ({100*det/n:.1f} %), NIEPEWNE {unc} ({100*unc/n:.1f} %)  -> swoistosc(WYKRYTO) {100*(1-det/n):.1f} %")
        for st, k in c.most_common():
            print(f"    {st:26s} {k:4d}")
    print("\nNEGATYWY wg grupy (n / WYKRYTO / NIEPEWNE / TPrA_ONLY / inne):")
    by = defaultdict(list)
    for r in rows:
        if r["klasa"] == "Negatywy": by[r["grupa"]].append(r["status"])
    for g, sts in sorted(by.items(), key=lambda kv: -len(kv[1])):
        c = Counter(sts)
        inne = len(sts) - c.get("detected",0) - c.get("uncertain",0) - c.get("TPrA_ONLY",0)
        print(f"    {g:22s} {len(sts):3d} / {c.get('detected',0):3d} / {c.get('uncertain',0):3d} / {c.get('TPrA_ONLY',0):3d} / {inne:3d}")
    print(f"\nCRASHE: {len(crashes)}")
    for c in crashes[:15]: print("   ", c)
    print(f"\nCSV: {csv_path}")
    return 0 if not crashes else 2

if __name__ == "__main__":
    sys.exit(main())
