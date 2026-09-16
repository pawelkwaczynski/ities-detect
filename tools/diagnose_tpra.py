"""
Diagnostyka kandydatów pików dla wskazanego pliku (domyślnie TPrA.txt).

Krok po kroku pokazuje, dlaczego analyze() kończy danym statusem:
  1. parse -> detect_cycles -> split_cv (długości gałęzi, zakresy E)
  2. WSZYSTKIE lokalne ekstrema na każdej gałęzi (surowy find_peaks bez progu)
  3. kandydaci zwróceni przez branch_peaks() (po smooth + prog + edge + width)
  4. którzy kandydaci wpadają w okna TPrA
  5. pary TPrA przechodzące sanity (shift, E2>E1)
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_all import install_stubs, load_algorithm, LAB_DIR


def pct_od_brzegu(pos: int, n: int) -> float:
    """Odległość pozycji od najbliższego brzegu gałęzi, w procentach."""
    return 100.0 * min(pos, n - 1 - pos) / max(n - 1, 1)


def main() -> None:
    nazwa = sys.argv[1] if len(sys.argv) > 1 else "TPrA.txt"
    install_stubs()
    ns = load_algorithm()

    from scipy.signal import find_peaks

    f = LAB_DIR / nazwa
    content = f.read_bytes()
    E_orig, I_orig, e_col, i_col = ns["parse_file"](content)
    E, I, n_cycles = ns["detect_cycles_and_get_first"](E_orig, I_orig)
    upper, lower = ns["split_cv"](E)

    print(f"PLIK: {nazwa}")
    print(f"  kolumny: {e_col} | {i_col}")
    print(f"  punktów: {len(E_orig)} -> po cyklu {len(E)} (cykli={n_cycles})")
    print(f"  gałąź FWD (upper): {len(upper)} pkt  E=[{E[upper[0]]:.3f}, {E[upper[-1]]:.3f}]")
    print(f"  gałąź BWD (lower): {len(lower)} pkt  E=[{E[lower[0]]:.3f}, {E[lower[-1]]:.3f}]")
    print(f"  DETECTION_MODE = {ns.get('DETECTION_MODE')}")
    print(f"  WIN_TPRA_POS = {ns['WIN_TPRA_POS_RAW']}  WIN_TPRA_NEG = {ns['WIN_TPRA_NEG_RAW']}")
    print(f"  SHIFT zakres = ({ns['SHIFT_MIN']}, {ns['SHIFT_MAX']})  TPRA_TARGET_V = {ns['TPRA_TARGET_V']}")

    smooth_signal = ns["smooth_signal"]

    for nazwa_g, idx, kind in (("FWD (upper, max)", upper, "max"),
                               ("BWD (lower, min)", lower, "min")):
        print("\n" + "=" * 78)
        print(f"GAŁĄŹ {nazwa_g}  —  {len(idx)} pkt")
        print("=" * 78)

        raw = I[idx] if kind == "max" else -I[idx]
        y = smooth_signal(raw)
        n = len(idx)
        edge = max(12, int(n * 0.08))
        print(f"  edge filter = {edge} pkt ({100*edge/n:.1f}% z każdej strony)")

        # --- 2. surowe ekstrema bez progu prominencji ---
        peaks_raw, props_raw = find_peaks(y, prominence=0)
        scale = np.nanpercentile(y, 95) - np.nanpercentile(y, 5)
        prom_min = max(ns["PEAK_PROMINENCE_A"], 0.025 * scale)
        print(f"  scale (p95-p5) = {scale*1e6:.2f} µA   prom_min progu = {prom_min*1e6:.3f} µA")
        print(f"  WSZYSTKIE lokalne ekstrema (surowy find_peaks, prominence=0):")
        for p, pr in sorted(zip(peaks_raw, props_raw["prominences"]),
                            key=lambda t: -t[1]):
            gi = int(idx[p])
            e_val = E[gi]
            i_val = I[gi]
            w_tpra = ("FWD" if kind == "max" else "BWD")
            okno = ns["WIN_TPRA_POS_RAW"] if kind == "max" else ns["WIN_TPRA_NEG_RAW"]
            in_win = "W OKNIE" if okno[0] <= e_val <= okno[1] else ""
            ponad = "prom>=prog" if pr >= prom_min else "prom<PROG  <-- odrzucony"
            print(f"    E={e_val:+.4f}  I={i_val*1e6:+8.2f}µA  prom={pr*1e6:7.3f}µA  "
                  f"poz={p:4d}/{n}  brzeg={pct_od_brzegu(p, n):4.1f}%  {ponad}  {in_win}")

        # --- 3. kandydaci z branch_peaks ---
        cands = ns["branch_peaks"](E, I, idx, kind)
        print(f"\n  KANDYDACI z branch_peaks() ({len(cands)}):")
        for c in cands:
            okno = ns["WIN_TPRA_POS_RAW"] if kind == "max" else ns["WIN_TPRA_NEG_RAW"]
            in_win = "<-- W OKNIE TPrA" if okno[0] <= c["E"] <= okno[1] else ""
            print(f"    E={c['E']:+.4f}  I={c['I']*1e6:+8.2f}µA  prom={c['prom']*1e6:7.3f}µA  {in_win}")

    # --- 4-5. okna + pary ---
    fwd_cands = ns["branch_peaks"](E, I, upper, "max")
    bwd_cands = ns["branch_peaks"](E, I, lower, "min")
    WP = ns["WIN_TPRA_POS_RAW"]
    WN = ns["WIN_TPRA_NEG_RAW"]
    t_pos = [c for c in fwd_cands if WP[0] <= c["E"] <= WP[1]]
    t_neg = [c for c in bwd_cands if WN[0] <= c["E"] <= WN[1]]

    print("\n" + "=" * 78)
    print("SELEKCJA TPrA")
    print("=" * 78)
    print(f"  t_pos (FWD w oknie {WP}): {[round(c['E'], 4) for c in t_pos]}")
    print(f"  t_neg (BWD w oknie {WN}): {[round(c['E'], 4) for c in t_neg]}")

    if not t_pos or not t_neg:
        print("  >>> WYNIK: NO_TPRA_IN_WINDOWS (pusta lista okna)")
    else:
        print(f"\n  Pary TPrA i sanity check:")
        TARGET = ns["TPRA_TARGET_V"]
        SMIN, SMAX = ns["SHIFT_MIN"], ns["SHIFT_MAX"]
        valid = 0
        for cpos in t_pos:
            for cneg in t_neg:
                E2r, E1r = cpos["E"], cneg["E"]
                sh = TARGET - (E1r + E2r) / 2
                ok_shift = SMIN <= sh <= SMAX
                ok_order = E2r > E1r
                status = "OK" if (ok_shift and ok_order) else \
                         f"ODRZUCONA (shift_ok={ok_shift}, E2>E1={ok_order})"
                if ok_shift and ok_order:
                    valid += 1
                print(f"    E1={E1r:+.4f} E2={E2r:+.4f}  shift={sh:+.4f}  {status}")
        print(f"\n  >>> Par przechodzących sanity: {valid}")

    r = ns["analyze"](nazwa, content)
    print(f"\n  >>> analyze() status: {r['status']}  "
          f"(reason={r.get('internal_reason', '-')})  delta_Es={r.get('delta_Es')}")


if __name__ == "__main__":
    main()
