#!/usr/bin/env python3
"""Krzywa kalibracyjna amfetaminy z plików CC (paczka ities_update, 27.07.2026).

Uruchamia ekstraktor Ip z notebooka na woltamperogramach o ZNANYCH stężeniach,
porównuje z wartościami laboratorium (CC AMP.xlsx) i z fitem opublikowanym
w Wykresy.pdf, po czym zapisuje:
    - kalibracja_amfetamina.json  — a, b, R2, LOD, LOQ (używane przez notebook),
    - benchmark_CC_<data>.csv     — wartości per plik (nasze vs lab).

Uruchomienie:  python3 kalibracja_cc.py
"""
import csv
import glob
import json
import os
import re
from datetime import date

import numpy as np
from scipy.signal import find_peaks, savgol_filter

from test_ities_local import load_algorithm

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CC_DIR = os.path.join(ROOT, "06_ities_update_20260727", "CC")
OUT_JSON = os.path.join(HERE, "kalibracja_amfetamina.json")
OUT_CSV = os.path.join(ROOT, "wyniki_analizy", f"benchmark_CC_{date.today():%Y%m%d}.csv")

# Stężenie w naczynku [µM] dla dodanej objętości 10 mM roztworu AMP (CC AMP.xlsx)
VOL2C = {10: 28.490, 15: 42.674, 20: 56.818, 25: 70.922, 30: 84.986,
         35: 99.010, 40: 112.994, 50: 140.845, 60: 168.539}

# Średnie Ip lab z CC AMP.xlsx (P16:P24 dodatnie, P28:P36 ujemne) [µA]
LAB_MEAN = {28.490: (3.5220, -3.5517), 42.674: (6.1575, -6.4145),
            56.818: (9.0980, -8.9781), 70.922: (11.9281, -11.9302),
            84.986: (14.2898, -14.0019), 99.010: (16.8288, -16.0554),
            112.994: (19.7637, -18.1940), 140.845: (23.2555, -21.5371),
            168.539: (28.7047, -25.5984)}

# Fit opublikowany przez laboratorium (Wykresy.pdf, wyniki P. Borgul)
LAB_FIT_POS = {"a": 0.1780, "b": -1.089, "R2": 0.9967}
LAB_FIT_NEG = {"a": -0.1551, "b": -0.1524, "R2": 0.9915}

WIN_FWD = (0.60, 0.79)   # okno piku anodowego analitu w plikach CC (brak TPrA)
WIN_BWD = (0.55, 0.70)   # okno piku katodowego na gałęzi powrotnej
PEAK_PROM_uA = 0.03      # przy 28,5 µM pik analitu to garb ~0,06 µA na narastającym tle


def analyte_peak(E, I_uA, idx, kind):
    """Najbardziej prominentny pik analitu w oknie potencjału; indeks globalny.

    Wymagamy PRAWDZIWEGO lokalnego ekstremum. Fallback na argmax brał przy
    najniższym stężeniu narastającą krawędź okna rozpuszczalnika (~0,80 V)
    zamiast piku analitu (~0,71 V) — wyszło to dopiero na kontroli wizualnej.
    """
    lo, hi = WIN_FWD if kind == "max" else WIN_BWD
    sub = idx[(E[idx] >= lo) & (E[idx] <= hi)]
    if len(sub) < 15:
        return None
    y = savgol_filter(I_uA[sub] if kind == "max" else -I_uA[sub], 11, 3)
    peaks, props = find_peaks(y, prominence=PEAK_PROM_uA)
    if len(peaks):
        return int(sub[peaks[int(np.argmax(props["prominences"]))]])
    return None


def linfit(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    a, b = np.polyfit(x, y, 1)
    resid = y - (a * x + b)
    r2 = 1 - np.sum(resid ** 2) / np.sum((y - y.mean()) ** 2)
    se = float(np.sqrt(np.sum(resid ** 2) / (len(x) - 2)))
    return float(a), float(b), float(r2), se


def blank_noise(algo):
    """SD prądu blanku w oknie analitu po odjęciu prostej — podstawa LOD/LOQ."""
    path = os.path.join(CC_DIR, "Blank_CC_Scan3.txt")
    E, I, _, _ = algo.parse_file(open(path, "rb").read())
    fwd, _ = algo.split_cv(E)
    I_uA = I * 1e6
    sel = fwd[(E[fwd] >= WIN_FWD[0]) & (E[fwd] <= WIN_FWD[1])]
    a, b = np.polyfit(E[sel], I_uA[sel], 1)
    return float(np.std(I_uA[sel] - (a * E[sel] + b), ddof=1))


def main():
    algo = load_algorithm()
    rows = []
    for path in sorted(glob.glob(os.path.join(CC_DIR, "CC_*uL_Scan*.txt"))):
        m = re.match(r"CC_(\d+)uL_Scan(\d)\.txt", os.path.basename(path))
        if not m:
            continue
        conc = VOL2C[int(m.group(1))]
        E, I, _, _ = algo.parse_file(open(path, "rb").read())
        E, I, _, _ = algo.detect_cycles_and_select(E, I)
        fwd, bwd = algo.split_cv(E)
        I_uA = I * 1e6
        row = {"plik": os.path.basename(path), "c_uM": conc, "skan": int(m.group(2))}
        for kind, idx, tag in (("max", fwd, "pos"), ("min", bwd, "neg")):
            gi = analyte_peak(E, I_uA, idx, kind)
            if gi is None:
                continue
            bl = algo.peak_baseline_ip(E, I, idx, {"idx": gi, "E": float(E[gi]),
                                                   "I": float(I[gi])}, kind)
            row[f"Ep_{tag}_V"] = round(float(E[gi]), 4)
            row[f"Ip_{tag}_uA"] = round(bl["Ip_A"] * 1e6, 4) if bl else None
            row[f"baza_ok_{tag}"] = bool(bl["flat_ok"]) if bl else None
        row["lab_Ip_pos_uA"] = LAB_MEAN[conc][0]
        row["lab_Ip_neg_uA"] = LAB_MEAN[conc][1]
        rows.append(row)

    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    good = [r for r in rows if r.get("Ip_pos_uA") is not None]
    a, b, r2, se = linfit([r["c_uM"] for r in good], [r["Ip_pos_uA"] for r in good])
    sd = blank_noise(algo)
    lod, loq = 3 * sd / a, 10 * sd / a

    concs = sorted({r["c_uM"] for r in rows})
    print(f"Plików CC: {len(rows)}   (blank + 9 stężeń × 3 skany)\n")
    print("Pik anodowy — nasz Ip vs laboratorium (średnie z 3 skanów)")
    print(f"{'c [µM]':>8} {'Ep [V]':>7} {'nasz Ip':>9} {'lab Ip':>8} {'Δ %':>7}")
    for c in concs:
        sel = [r for r in rows if r["c_uM"] == c and r.get("Ip_pos_uA") is not None]
        ours = float(np.mean([r["Ip_pos_uA"] for r in sel]))
        ep = float(np.mean([r["Ep_pos_V"] for r in sel]))
        lab = LAB_MEAN[c][0]
        print(f"{c:8.2f} {ep:7.3f} {ours:9.3f} {lab:8.3f} {100*(ours-lab)/lab:7.1f}")

    print(f"\nNasza krzywa (n={len(good)}):  Ip = {a:.4f}·c {b:+.4f} µA, R² = {r2:.4f}")
    print(f"Lab (Wykresy.pdf):          Ip = {LAB_FIT_POS['a']:.4f}·c "
          f"{LAB_FIT_POS['b']:+.4f} µA, R² = {LAB_FIT_POS['R2']:.4f}")
    print(f"Różnica nachylenia: {100*(a-LAB_FIT_POS['a'])/LAB_FIT_POS['a']:+.1f} %")
    print(f"\nSzum blanku w oknie analitu: SD = {sd:.4f} µA")
    print(f"LOD = 3·SD/a = {lod:.2f} µM      LOQ = 10·SD/a = {loq:.2f} µM")

    calib = {
        "analit": "amfetamina",
        "zrodlo": "CC (ities_update, pomiary 03.10.2024, paczka 27.07.2026)",
        "galaz": "anodowa (pik dodatni) — wyższe R² niż katodowa, zgodne z metodą lab",
        "jednostki": {"Ip": "µA", "c": "µM"},
        "a": round(a, 6), "b": round(b, 6), "R2": round(r2, 6),
        "SE_reszt_uA": round(se, 6),
        "n_punktow": len(good),
        "zakres_c_uM": [min(concs), max(concs)],
        "LOD_uM": round(lod, 3), "LOQ_uM": round(loq, 3),
        "SD_blank_uA": round(sd, 6),
        "warunki": "pH 5,5; 10 mM NaCl (wodna); 5 mM BTPPA TPBCl w 1,2-DCE; temp. otoczenia",
        "lab_fit_anodowy": LAB_FIT_POS,
        "lab_fit_katodowy": LAB_FIT_NEG,
        "lab_fit_excel_komercja": {"a": 0.123, "b": -2.248e-07,
                                   "uwaga": "jednostki A i M; ROZBIEŻNOŚĆ ze slope 0,178 "
                                            "— do wyjaśnienia z Łukaszem"},
        "data_wyznaczenia": f"{date.today():%Y-%m-%d}",
    }
    json.dump(calib, open(OUT_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nZapisano: {OUT_JSON}\n          {OUT_CSV}")


if __name__ == "__main__":
    main()
