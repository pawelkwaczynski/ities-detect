"""
Porównanie wyników analizy: baseline (przed) vs aktualny (po).

Sprawdza regresje i jakość zmian:
  * macierz przejść folder_przed -> folder_po,
  * REGRESJE: pliki positive -> nie-positive (utrata prawdziwej detekcji),
  * nowe positive: weryfikacja ΔE_s (musi być 0.340–0.360),
  * kontrola plików-kotwic, które MUSZĄ pozostać blad_pomiaru.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

BASELINE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/baseline_przed_analit.csv")
AKTUALNY = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("wyniki_analizy/wyniki_zbiorcze.csv")

# Pliki, które wg droga_do_100_procent.md są wadliwe aparaturowo
# (tylko te z normalnym nazewnictwem, istniejące w folderze).
KOTWICE_BLAD = ["komercja_184_900ul_TPrA.txt", "komercja_183-3_100ul_TPrA.txt"]
KOTWICE_POSITIVE = ["155_100ul_TPrA(1).txt", "TPrA.txt",
                    "komercja_37_2_5_300ul_20ul_TPrA.txt"]


def wczytaj(path: Path) -> dict[str, dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return {row["file_name"]: row for row in csv.DictReader(f)}


def main() -> None:
    przed = wczytaj(BASELINE)
    po = wczytaj(AKTUALNY)

    wspolne = sorted(set(przed) & set(po))
    print(f"Plików porównanych: {len(wspolne)}\n")

    # macierz przejść
    przejscia: dict[tuple, int] = {}
    for nm in wspolne:
        a = przed[nm]["subfolder"]
        b = po[nm]["subfolder"]
        przejscia[(a, b)] = przejscia.get((a, b), 0) + 1

    print("=" * 70)
    print("MACIERZ PRZEJŚĆ (folder_przed -> folder_po)")
    print("=" * 70)
    for (a, b), n in sorted(przejscia.items(), key=lambda x: -x[1]):
        strzalka = "  (bez zmian)" if a == b else ""
        print(f"  {a:<20} -> {b:<20} {n:4d}{strzalka}")

    # REGRESJE: positive -> nie-positive
    print("\n" + "=" * 70)
    regresje = [nm for nm in wspolne
                if przed[nm]["subfolder"] == "positive"
                and po[nm]["subfolder"] != "positive"]
    print(f"REGRESJE (positive -> nie-positive): {len(regresje)}")
    print("=" * 70)
    for nm in regresje:
        print(f"  {nm:<50} -> {po[nm]['subfolder']}  ΔE_s={po[nm]['delta_Es']}")
    if not regresje:
        print("  Brak — żadna dotychczasowa detekcja nie zniknęła.")

    # NOWE positive: weryfikacja ΔE_s
    print("\n" + "=" * 70)
    nowe_pos = [nm for nm in wspolne
                if przed[nm]["subfolder"] != "positive"
                and po[nm]["subfolder"] == "positive"]
    print(f"NOWE positive: {len(nowe_pos)}  — weryfikacja ΔE_s w [0.340, 0.360]")
    print("=" * 70)
    zle = []
    for nm in nowe_pos:
        d = po[nm]["delta_Es"]
        try:
            dv = float(d)
        except (TypeError, ValueError):
            dv = None
        ok = dv is not None and 0.340 <= dv <= 0.360
        if not ok:
            zle.append(nm)
    print(f"  Wszystkie nowe positive mają ΔE_s w zakresie amfetaminy: "
          f"{'TAK' if not zle else 'NIE'}")
    if zle:
        for nm in zle:
            print(f"    PODEJRZANY: {nm}  ΔE_s={po[nm]['delta_Es']}")
    # rozkład ΔE_s nowych positive
    wart = sorted(float(po[nm]["delta_Es"]) for nm in nowe_pos
                  if po[nm]["delta_Es"])
    if wart:
        print(f"  ΔE_s nowych positive: min={wart[0]:.4f}  max={wart[-1]:.4f}  "
              f"mediana={wart[len(wart)//2]:.4f}")

    # kontrola kotwic
    print("\n" + "=" * 70)
    print("KONTROLA PLIKÓW-KOTWIC")
    print("=" * 70)
    for nm in KOTWICE_POSITIVE:
        if nm in po:
            s = po[nm]["subfolder"]
            flaga = "OK" if s == "positive" else "  <-- UWAGA"
            print(f"  [musi=positive]      {nm:<42} -> {s}  ΔE_s={po[nm]['delta_Es']}  {flaga}")
    for nm in KOTWICE_BLAD:
        if nm in po:
            s = po[nm]["subfolder"]
            flaga = "OK" if s == "blad_pomiaru" else "  <-- UWAGA"
            print(f"  [musi=blad_pomiaru]  {nm:<42} -> {s}  {flaga}")


if __name__ == "__main__":
    main()
