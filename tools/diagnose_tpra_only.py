"""
Diagnostyka zasięgu fałszywych negatywów w grupie tpra_only.

Dla każdego pliku tpra_only sprawdza: czy gdyby detekcja pików analitu
była bardziej permisywna (WSZYSTKIE lokalne ekstrema po edge filtrze,
bez progu prominencji i bez filtra 'strong peaks'), to czy powstałaby
poprawna para analitu dająca ΔE_s w zakresie detekcji.

To pokazuje, ile z tpra_only to prawdziwe fałszywe negatywy (słaby,
ale realny pik analitu) — bez modyfikowania algorytmu.
"""

from __future__ import annotations

import contextlib
import io
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_all import install_stubs, load_algorithm, LAB_DIR, POMIJAJ

TARGET_E5 = -0.091
TARGET_DELTA = 0.350
E6_EXPECTED = TARGET_E5 + TARGET_DELTA      # 0.259
ANALYTE_MIN_OFFSET = 0.10


def decyzja(delta: float) -> str:
    err = abs(delta - TARGET_DELTA)
    if err <= 0.010:
        return "detected"
    if err <= 0.015:
        return "uncertain"
    return "not_detected"


def raw_peaks_edge(E, I, idx, kind, ns):
    """WSZYSTKIE lokalne ekstrema na gałęzi, tylko po edge filtrze."""
    from scipy.signal import find_peaks
    raw = I[idx] if kind == "max" else -I[idx]
    y = ns["smooth_signal"](raw)
    n = len(idx)
    edge = max(12, int(n * 0.08))
    peaks, props = find_peaks(y, prominence=0)
    out = []
    for p, pr in zip(peaks, props["prominences"]):
        if p < edge or p > n - edge:
            continue
        gi = int(idx[p])
        out.append({"E": float(E[gi]), "I": float(I[gi]), "prom": float(pr)})
    return out


def main() -> None:
    install_stubs()
    ns = load_algorithm()
    analyze = ns["analyze"]
    sink = io.StringIO()

    pliki = sorted(
        p for p in LAB_DIR.iterdir()
        if p.is_file() and p.suffix.lower() not in POMIJAJ
    )

    klasy = {"detected": [], "uncertain": [], "not_detected": [],
             "brak_pary": [], "nadal_tpra_only": []}

    for plik in pliki:
        ns["RESULTS"].clear()
        try:
            with contextlib.redirect_stdout(sink):
                r = analyze(plik.name, plik.read_bytes())
        except Exception:
            continue
        if r.get("status") != "TPrA_ONLY":
            continue

        E1_raw = r.get("E1_raw")
        E2_raw = r.get("E2_raw")
        shift = r.get("shift")
        if E1_raw is None or E2_raw is None or shift is None:
            klasy["nadal_tpra_only"].append((plik.name, None, None))
            continue

        E_orig, I_orig, _, _ = ns["parse_file"](plik.read_bytes())
        E, I, _ = ns["detect_cycles_and_get_first"](E_orig, I_orig)
        upper, lower = ns["split_cv"](E)

        fwd = raw_peaks_edge(E, I, upper, "max", ns)
        bwd = raw_peaks_edge(E, I, lower, "min", ns)

        a_pos = [c for c in fwd if c["E"] >= E2_raw + ANALYTE_MIN_OFFSET]
        a_neg = [c for c in bwd if c["E"] >= E1_raw + ANALYTE_MIN_OFFSET]

        if not a_pos or not a_neg:
            klasy["brak_pary"].append((plik.name, None, None))
            continue

        best = None
        best_score = float("inf")
        for c4 in a_pos:
            for c3 in a_neg:
                E4c = c4["E"] + shift
                E3c = c3["E"] + shift
                if E4c <= E3c:
                    continue
                E6 = (E3c + E4c) / 2
                score = abs(E6 - E6_EXPECTED)
                if score < best_score:
                    best_score = score
                    best = (c3, c4, E6)
        if best is None:
            klasy["brak_pary"].append((plik.name, None, None))
            continue

        c3, c4, E6 = best
        delta = E6 - TARGET_E5
        st = decyzja(delta)
        klasy[st].append((plik.name, delta,
                          (c3["prom"] * 1e6, c4["prom"] * 1e6)))

    total = sum(len(v) for v in klasy.values())
    print(f"Plików tpra_only: {total}\n")
    print("Gdyby detekcja pików analitu była permisywna (wszystkie ekstrema "
          "po edge filtrze):\n")
    for st in ("detected", "uncertain", "not_detected", "brak_pary"):
        print(f"  {st:<16}: {len(klasy[st]):3d}")
    print()

    print("=" * 78)
    print(f"PRAWDZIWE FAŁSZYWE NEGATYWY (-> detected): {len(klasy['detected'])}")
    print("=" * 78)
    for nm, delta, proms in sorted(klasy["detected"]):
        print(f"  {nm:<50} ΔE_s={delta:.4f}  prom_analit(bwd,fwd)="
              f"({proms[0]:.3f},{proms[1]:.3f})µA")

    print("\n" + "=" * 78)
    print(f"GRANICZNE (-> uncertain): {len(klasy['uncertain'])}")
    print("=" * 78)
    for nm, delta, proms in sorted(klasy["uncertain"]):
        print(f"  {nm:<50} ΔE_s={delta:.4f}  prom_analit(bwd,fwd)="
              f"({proms[0]:.3f},{proms[1]:.3f})µA")

    print("\n" + "=" * 78)
    print(f"PRAWDZIWE tpra_only / brak amfetaminy (-> not_detected lub brak pary): "
          f"{len(klasy['not_detected']) + len(klasy['brak_pary'])}")
    print("=" * 78)


if __name__ == "__main__":
    main()
