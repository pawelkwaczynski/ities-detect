#!/usr/bin/env python3
"""Ile z 294 plików to niezależne PRÓBKI, a ile replikaty tego samego pomiaru?

294 pliki ≠ 294 próbki. Jeśli trudne próbki mają po kilkanaście powtórzeń,
czułość liczona per plik jest obciążona. Liczymy obie.
"""
import csv
import os
import re
from collections import defaultdict

ROOT = os.path.expanduser("~/Desktop/claude_brain/projekty/MVP_Colab/ITIES")
CSV = os.path.join(ROOT, "wyniki_analizy", "diagnoza_pozytywy_20260727.csv")


def id_probki(nazwa):
    """Identyfikator próbki: nazwa pliku bez numeru powtórzenia, objętości i skanu."""
    n = nazwa
    n = re.sub(r"\.txt$", "", n, flags=re.I)
    n = re.sub(r"\(\d+\)\s*$", "", n)             # (1), (28) — numer powtórzenia
    n = re.sub(r"[_ ]?scan\s*\d+", "", n, flags=re.I)
    n = re.sub(r"\d+\s*u?[lL]", "", n)            # objętości 100ul, 20uL
    n = re.sub(r"TPrA(Cl)?|TRrACl|Jon modelowy|jon modelowy|MI|_last|dłuższy",
               "", n, flags=re.I)
    n = re.sub(r"[_\-\s]+", "_", n).strip("_ .").lower()
    return n or nazwa.lower()


def main():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    print(f"Plików: {len(rows)}")

    probki = defaultdict(list)
    for r in rows:
        probki[id_probki(r["plik"])].append(r)
    print(f"Unikalnych próbek (po odcięciu replikatów): {len(probki)}\n")

    # czułość per plik vs per próbka (próbka wykryta = choć jeden plik detected/uncertain)
    ok_pliki = sum(r["status"] in ("detected", "uncertain") for r in rows)
    ok_probki = sum(any(x["status"] in ("detected", "uncertain") for x in lst)
                    for lst in probki.values())
    print(f"Czułość PER PLIK:   {ok_pliki}/{len(rows)} = {100*ok_pliki/len(rows):.0f} %")
    print(f"Czułość PER PRÓBKA: {ok_probki}/{len(probki)} = {100*ok_probki/len(probki):.0f} %")
    print("  (próbka = wykryta, jeśli choć jeden jej pomiar wyszedł detected/uncertain)\n")

    # rozkład liczby powtórzeń
    licz = defaultdict(int)
    for lst in probki.values():
        licz[len(lst)] += 1
    print("Rozkład liczby plików na próbkę:")
    for n in sorted(licz):
        print(f"  {n:2d} plik(ów): {licz[n]:3d} próbek")

    # największe skupiska replikatów wśród niewykrytych
    print("\nPróbki, których ŻADEN pomiar nie został wykryty (od najliczniejszych):")
    nigdy = [(k, lst) for k, lst in probki.items()
             if not any(x["status"] in ("detected", "uncertain") for x in lst)]
    nigdy.sort(key=lambda x: -len(x[1]))
    for k, lst in nigdy[:12]:
        st = defaultdict(int)
        for x in lst:
            st[x["status"]] += 1
        deltas = [float(x["delta_Es"]) for x in lst if x["delta_Es"]]
        d = (f"ΔE_s {min(deltas):.4f}–{max(deltas):.4f}" if deltas else "brak pary")
        print(f"  {k[:42]:42s} {len(lst):3d} plików  {dict(st)}  {d}")
    print(f"\nRazem próbek nigdy niewykrytych: {len(nigdy)} "
          f"(w nich {sum(len(l) for _, l in nigdy)} plików)")

    # ΔE_s per próbka w grupach
    print("\nSkupiska ΔE_s — ile UNIKALNYCH próbek?")
    for lo, hi, opis in [(0.0, 0.30, "~0,27"), (0.365, 0.40, "~0,37")]:
        grupa = defaultdict(list)
        for r in rows:
            if r["status"] == "not_detected" and r["delta_Es"]:
                d = float(r["delta_Es"])
                if lo <= d < hi:
                    grupa[id_probki(r["plik"])].append(d)
        n_plikow = sum(len(v) for v in grupa.values())
        print(f"  grupa {opis}: {n_plikow} plików, ale tylko {len(grupa)} unikalnych próbek")
        for k, v in sorted(grupa.items(), key=lambda x: -len(x[1])):
            print(f"      {k[:44]:44s} {len(v):2d} plików, ΔE_s {min(v):.4f}–{max(v):.4f}")


if __name__ == "__main__":
    main()
