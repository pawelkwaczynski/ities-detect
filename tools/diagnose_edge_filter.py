"""
Diagnostyka zasięgu problemu z edge filterem w branch_peaks().

Edge filter usuwa piki przy obu brzegach gałęzi CV. Dla plików, gdzie
prawdziwy pik TPrA/analitu leży przy granicy skanu (np. TPrA.txt — TPrA−
przy E≈0.10 V), powoduje to fałszywy status MEASUREMENT_QUALITY_FAIL lub
TPrA_ONLY.

Skrypt porównuje 3 warianty filtra BEZ modyfikowania notebooka:
  A_obecny    — filtruje oba brzegi (apex + E_min)               [stan obecny]
  B_apex_only — filtruje tylko stronę apexu (zachowuje piki E_min)
  C_brak      — całkowicie bez filtra brzegowego

Raportuje:
  * ile tpra_only / blad_pomiaru "naprawia się" w wariantach B/C,
  * regresje: pliki obecnie 'positive', które psują się w B/C,
  * dla każdej zmiany podaje ΔE_s (czy to prawdziwa amfetamina ~0.35 V).
"""

from __future__ import annotations

import contextlib
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_all import install_stubs, load_algorithm, LAB_DIR, POMIJAJ, subfolder_for

# Szablon branch_peaks — jedyna zmienna część to klauzula filtra brzegowego.
BRANCH_PEAKS_SRC = '''
def branch_peaks(E, I, idx, kind):
    raw    = I[idx] if kind == "max" else -I[idx]
    y      = smooth_signal(raw)
    branch = "pierwsza_gorna" if kind == "max" else "powrotna_dolna"
    scale    = np.nanpercentile(y, 95) - np.nanpercentile(y, 5)
    prom_min = max(PEAK_PROMINENCE_A, 0.025 * scale)
    distance = max(PEAK_DISTANCE_POINTS, len(idx) // 35)
    peaks, props = find_peaks(y, prominence=prom_min, distance=distance)
    if len(peaks) == 0:
        return []
    widths = peak_widths(y, peaks, rel_height=0.5)[0]
    rows   = []
    edge   = max(12, int(len(idx) * 0.08))
    for p, prom, width in zip(peaks, props["prominences"], widths):
        if EDGE_CLAUSE:
            continue
        if width > len(idx) * MAX_PEAK_WIDTH_FRACTION:
            continue
        radius = max(3, min(18, int(width // 2) + 3))
        lo     = max(0, p - radius)
        hi     = min(len(idx), p + radius + 1)
        local  = np.argmax(raw[lo:hi]) + lo
        gi     = int(idx[local])
        rows.append({
            "idx": gi, "E": float(E[gi]), "I": float(I[gi]),
            "prom": float(prom), "width": float(width),
            "kind": kind, "branch": branch,
        })
    rows = sorted(rows, key=lambda r: r["prom"], reverse=True)
    if rows:
        threshold = max(r["prom"] for r in rows) * 0.18
        strong    = [r for r in rows if r["prom"] >= threshold]
        rows      = strong if len(strong) >= 2 else rows
    return rows[:8]
'''

WARIANTY = {
    "A_obecny":    "p < edge or p > len(idx) - edge",
    "B_apex_only": "(kind == 'max' and p > len(idx) - edge) or (kind == 'min' and p < edge)",
    "C_brak":      "False",
}


def set_variant(ns: dict, clause: str) -> None:
    """Wstrzykuje wariant branch_peaks do przestrzeni nazw notebooka."""
    src = BRANCH_PEAKS_SRC.replace("EDGE_CLAUSE", clause)
    exec(src, ns)


def run_all(ns: dict, pliki: list[Path]) -> dict[str, dict]:
    """Zwraca {nazwa_pliku: {status, delta_Es}} dla aktualnego wariantu."""
    out = {}
    analyze = ns["analyze"]
    build_invalid = ns["build_invalid_result"]
    sink = io.StringIO()
    for plik in pliki:
        ns["RESULTS"].clear()
        try:
            with contextlib.redirect_stdout(sink):
                r = analyze(plik.name, plik.read_bytes())
        except Exception as exc:
            r = build_invalid(plik.name, str(exc))
        out[plik.name] = {
            "status": r.get("status", "invalid"),
            "delta_Es": r.get("delta_Es"),
        }
    return out


def main() -> None:
    install_stubs()
    ns = load_algorithm()

    pliki = sorted(
        p for p in LAB_DIR.iterdir()
        if p.is_file() and p.suffix.lower() not in POMIJAJ
    )
    print(f"Pliki do diagnostyki: {len(pliki)}\n")

    wyniki = {}
    for nazwa, clause in WARIANTY.items():
        set_variant(ns, clause)
        print(f"Wariant {nazwa}: uruchamiam {len(pliki)} plików...")
        wyniki[nazwa] = run_all(ns, pliki)

    base = wyniki["A_obecny"]

    def folder(nazwa_pliku, wariant):
        return subfolder_for(wariant[nazwa_pliku]["status"])

    print("\n" + "=" * 78)
    print("ROZKŁAD STATUSÓW WG WARIANTU")
    print("=" * 78)
    foldery = ["positive", "negative", "tpra_only", "brak_pary_analitu",
               "blad_pomiaru", "niepewne", "za_malo_punktow", "inny_blad"]
    naglowek = f"{'folder':<20}" + "".join(f"{w:>14}" for w in WARIANTY)
    print(naglowek)
    for f in foldery:
        wiersz = f"{f:<20}"
        for w in WARIANTY:
            n = sum(1 for nm in wyniki[w] if subfolder_for(wyniki[w][nm]["status"]) == f)
            wiersz += f"{n:>14}"
        print(wiersz)

    for wariant in ("B_apex_only", "C_brak"):
        print("\n" + "=" * 78)
        print(f"ZMIANY: {wariant} vs A_obecny")
        print("=" * 78)
        naprawy = []   # tpra_only/blad_pomiaru -> lepszy status
        regresje = []  # positive/negative -> gorszy/inny status
        inne = []
        for nazwa_pliku in sorted(base):
            sa = base[nazwa_pliku]["status"]
            sb = wyniki[wariant][nazwa_pliku]["status"]
            if sa == sb:
                continue
            fa = subfolder_for(sa)
            fb = subfolder_for(sb)
            db = wyniki[wariant][nazwa_pliku]["delta_Es"]
            d_str = f"{db:.4f}" if isinstance(db, (int, float)) else "—"
            rekord = (nazwa_pliku, sa, sb, d_str)
            if fa in ("tpra_only", "blad_pomiaru", "brak_pary_analitu"):
                naprawy.append(rekord)
            elif fa in ("positive", "negative", "niepewne"):
                regresje.append(rekord)
            else:
                inne.append(rekord)

        print(f"\n  NAPRAWY ({len(naprawy)}) — tpra_only/blad_pomiaru zmieniło status:")
        for nm, sa, sb, d in naprawy:
            print(f"    {nm:<48} {sa:>24} -> {sb:<24} ΔE_s={d}")
        print(f"\n  REGRESJE ({len(regresje)}) — positive/negative/niepewne zmieniło status:")
        for nm, sa, sb, d in regresje:
            print(f"    {nm:<48} {sa:>24} -> {sb:<24} ΔE_s={d}")
        if inne:
            print(f"\n  INNE ({len(inne)}):")
            for nm, sa, sb, d in inne:
                print(f"    {nm:<48} {sa:>24} -> {sb:<24} ΔE_s={d}")

    print("\n" + "=" * 78)
    print("KONTROLA REGRESJI — pliki-kotwice (muszą zostać 'detected')")
    print("=" * 78)
    kotwice = ["155_100ul_TPrA(1).txt"]
    for k in kotwice:
        if k in base:
            for w in WARIANTY:
                s = wyniki[w][k]["status"]
                d = wyniki[w][k]["delta_Es"]
                d_str = f"{d:.4f}" if isinstance(d, (int, float)) else "—"
                print(f"  {k:<28} {w:<14} -> {s:<14} ΔE_s={d_str}")


if __name__ == "__main__":
    main()
