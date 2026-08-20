#!/usr/bin/env python3
"""Wykresy plików, których algorytm NIE zaliczył jako pewne trafienie.

Obejmuje fałszywe negatywy oraz przypadki NIEPEWNE (te ostatnie formalnie liczą się
jako wykryte, ale wymagają oka eksperta, więc też trafiają do przeglądu).
Każdy panel ma: obie gałęzie, WSZYSTKIE znalezione piki kandydujące, okna szukania
wzorca TPrA, wybrane punkty 1–4 oraz **konkretny powód odrzucenia** pod wykresem.

Wynik: `wyniki_analizy/falszywe_negatywy_<data>.pdf`.

Uruchomienie:  python3 wykresy_falszywe_negatywy.py
"""
import glob
import os
from collections import defaultdict
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt                                    # noqa: E402
from matplotlib.backends.backend_pdf import PdfPages               # noqa: E402
from matplotlib.lines import Line2D                                # noqa: E402

from test_ities_local import load_algorithm                        # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
POZ = os.path.join(ROOT, "06_ities_update_20260727", "TPrA - pozytywy")
OUT = os.path.join(ROOT, "wyniki_analizy", f"falszywe_negatywy_{date.today():%Y%m%d}.pdf")

KOLEJNOSC = ["uncertain", "TPrA_ONLY", "MEASUREMENT_QUALITY_FAIL", "not_detected",
             "NO_VALID_ANALYTE_PAIR", "too_few_points", "CRASH"]

OPIS = {
    "uncertain": ("NIEPEWNE — para pików jest, ΔE_s odbiega od 0,350 V o 10–15 mV. "
                  "Formalnie liczy się jako wykrycie, ale z flagą do weryfikacji."),
    "TPrA_ONLY": ("Wzorzec TPrA znaleziony, brak kandydata piku analitu w wymaganym zakresie "
                  "(E ≥ E_TPrA + 0,10 V) na którejś z gałęzi."),
    "MEASUREMENT_QUALITY_FAIL": ("Nie udało się zbudować pary pików wzorca TPrA — najczęściej "
                                 "brak piku na gałęzi powrotnej w oknie 0,05–0,35 V."),
    "not_detected": ("Para pików znaleziona, ale ΔE_s poza tolerancją ±15 mV od 0,350 V. "
                     "Warto sprawdzić, czy wybrana para to na pewno amfetamina."),
    "NO_VALID_ANALYTE_PAIR": "Kandydaci analitu są, ale żadna para nie spełnia E4 > E3.",
    "too_few_points": "Plik nie nadaje się do analizy (za mało punktów liczbowych).",
    "CRASH": "Błąd wykonania.",
}

POWOD_MQ = {
    "NO_CANDIDATES": "na którejś z gałęzi nie znaleziono ŻADNEGO piku ponad próg szumu 0,15 µA",
    "NO_TPRA_IN_WINDOWS": ("piki są, ale żaden nie trafił w okno wzorca "
                           "(anodowa 0,20–0,45 V / powrotna 0,05–0,35 V)"),
    "NO_VALID_TPRA_PAIR": ("piki w oknach są, ale żadna ich para nie przechodzi sanity-check "
                           "(przesunięcie osi poza −0,65…−0,20 V albo E2 ≤ E1)"),
}


def powod_odrzucenia(algo, wynik):
    """Jedno zdanie: dlaczego ten plik nie został uznany za pewne trafienie."""
    st = wynik.get("status")
    d = wynik.get("delta_Es")

    if st in ("not_detected", "uncertain") and d is not None:
        odchyl = (d - algo.AMPHETAMINE_TARGET_DELTA_V) * 1000
        prog = algo.DETECTION_TOLERANCE_V * 1000
        if st == "uncertain":
            return (f"ΔE_s odbiega o {odchyl:+.0f} mV od 0,350 V — poza progiem pewności "
                    f"±{prog:.0f} mV, w paśmie NIEPEWNE (do ±15 mV)")
        return (f"ΔE_s odbiega o {odchyl:+.0f} mV od 0,350 V — poza pasmem NIEPEWNE "
                f"(±15 mV), więc odrzucone")

    if st == "MEASUREMENT_QUALITY_FAIL":
        r = wynik.get("internal_reason", "")
        return POWOD_MQ.get(r, f"nie zbudowano pary wzorca TPrA ({r})")

    if st == "TPrA_ONLY":
        p2 = (wynik.get("points") or {}).get("2")
        if p2 and p2.get("E") is not None:
            return (f"wzorzec TPrA OK, ale brak piku analitu powyżej "
                    f"{p2['E'] + 0.10:.2f} V na anodowej lub powrotnej")
        return "wzorzec TPrA OK, brak kandydatów piku analitu w wymaganym zakresie"

    if st == "NO_VALID_ANALYTE_PAIR":
        return "kandydaci analitu są, ale pik anodowy wypada PRZED katodowym (E4 ≤ E3)"

    if st == "too_few_points":
        return "plik nie zawiera użytecznych danych liczbowych"

    return wynik.get("warning", "")[:110] or "—"


def zawin(tekst, szer=62, maks_linii=3):
    """Łamie powód na linie, żeby zmieścił się pod panelem."""
    linie, biezaca = [], ""
    for slowo in tekst.split():
        if len(biezaca) + len(slowo) + 1 > szer:
            linie.append(biezaca); biezaca = slowo
        else:
            biezaca = f"{biezaca} {slowo}".strip()
    linie.append(biezaca)
    return "\n".join(linie[:maks_linii])


def rysuj(ax, algo, path, wynik):
    """Jeden panel diagnostyczny z powodem odrzucenia pod wykresem."""
    name = os.path.basename(path)
    try:
        E, I, _, _ = algo.parse_file(open(path, "rb").read())
        E, I, _, _ = algo.detect_cycles_and_select(E, I)
        upper, lower = algo.split_cv(E)
    except Exception as exc:                                       # noqa: BLE001
        ax.text(0.5, 0.5, f"{name}\nnie da się narysować:\n{exc}",
                ha="center", va="center", fontsize=7, transform=ax.transAxes)
        ax.set_xticks([]); ax.set_yticks([])
        return ""

    IuA = I * 1e6
    ax.plot(E[upper], IuA[upper], color="#64748B", lw=1.1, zorder=2)
    ax.plot(E[lower], IuA[lower], color="#7C9A86", lw=1.0, zorder=2)
    ax.axvspan(*algo.WIN_TPRA_POS_RAW, color="#2563EB", alpha=0.05, zorder=0)
    ax.axvspan(*algo.WIN_TPRA_NEG_RAW, color="#2563EB", alpha=0.05, zorder=0)

    try:
        for c in algo.branch_peaks(E, I, upper, "max"):
            ax.plot(c["E"], c["I"] * 1e6, "^", color="#94A3B8", ms=5, zorder=3)
        for c in algo.branch_peaks(E, I, lower, "min"):
            ax.plot(c["E"], c["I"] * 1e6, "v", color="#94A3B8", ms=5, zorder=3)
    except Exception:                                              # noqa: BLE001
        pass

    pts = wynik.get("points", {}) or {}
    for key, kolor in (("1", "#2563EB"), ("2", "#2563EB"),
                       ("3", "#DC2626"), ("4", "#DC2626")):
        p = pts.get(key)
        if p and p.get("I") is not None and p.get("E") is not None:
            ax.plot(p["E"], p["I"] * 1e6, "o", color=kolor, ms=7,
                    markeredgecolor="white", markeredgewidth=0.8, zorder=5)
            ax.annotate(key, (p["E"], p["I"] * 1e6), textcoords="offset points",
                        xytext=(4, 4), fontsize=7, color=kolor, weight="bold")

    d = wynik.get("delta_Es")
    tyt = name if len(name) <= 40 else name[:38] + "…"
    podtyt = f"ΔE_s = {d:.4f} V" if d is not None else "brak pary pików"
    ip = wynik.get("Ip_analyte_fwd_uA")
    if ip is not None:
        podtyt += f"   Ip = {ip:.2f} µA"
    ax.set_title(f"{tyt}\n{podtyt}", fontsize=7.5)
    ax.set_xlabel("E / V", fontsize=7)
    ax.set_ylabel("I / µA", fontsize=7)
    ax.tick_params(labelsize=6)
    ax.grid(alpha=0.25)

    return zawin(powod_odrzucenia(algo, wynik))


def dopisz_powody(fig, podpisy):
    """Dopisuje powód pod każdym panelem — dopiero po tight_layout, żeby znać
    realne pozycje osi (wcześniej tekst pod osią był obcinany przy zapisie)."""
    for ax, tekst in podpisy:
        if not tekst:
            continue
        bb = ax.get_position()
        fig.text(bb.x0, bb.y0 - 0.036, tekst, fontsize=6.3, color="#B91C1C",
                 va="top", ha="left", linespacing=1.35)


def main():
    algo = load_algorithm()
    files = [f for f in sorted(glob.glob(os.path.join(POZ, "*")))
             if os.path.isfile(f) and not os.path.basename(f).startswith(".")]

    grupy = defaultdict(list)
    detected = []
    for path in files:
        name = os.path.basename(path)
        algo.RESULTS.clear()
        try:
            r = algo.analyze(name, open(path, "rb").read())
        except Exception as exc:                                   # noqa: BLE001
            grupy["CRASH"].append((path, {"status": "CRASH", "warning": repr(exc)}))
            continue
        if r.get("status") == "detected":
            if len(detected) < 3:
                detected.append((path, r))
        else:
            grupy[r["status"]].append((path, r))

    razem = sum(len(v) for v in grupy.values())
    niepewne = len(grupy.get("uncertain", []))
    print(f"Do przeglądu: {razem} z {len(files)} plików "
          f"({razem - niepewne} odrzuconych + {niepewne} NIEPEWNYCH)")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    NA_STRONE = 6
    with PdfPages(OUT) as pdf:
        fig = plt.figure(figsize=(11.7, 8.3))
        fig.text(0.5, 0.86, "ITIES — pliki bez pewnego trafienia", ha="center",
                 fontsize=21, weight="bold")
        fig.text(0.5, 0.815, f"{razem} z {len(files)} plików potwierdzonych jako pozytywne "
                             f"({date.today():%d.%m.%Y})", ha="center", fontsize=11.5)
        fig.text(0.5, 0.775, f"{razem - niepewne} fałszywych negatywów + {niepewne} NIEPEWNYCH "
                             "(te formalnie liczą się jako wykrycie)",
                 ha="center", fontsize=9.5, color="#475569")
        y = 0.70
        for st in KOLEJNOSC:
            if st in grupy:
                kolor = "#CA8A04" if st == "uncertain" else "#DC2626"
                fig.text(0.10, y, st, fontsize=10.5, weight="bold", color=kolor)
                fig.text(0.46, y, f"{len(grupy[st])} plików", fontsize=10.5)
                fig.text(0.10, y - 0.032, OPIS.get(st, ""), fontsize=8.2, color="#334155")
                y -= 0.082
        legenda = [
            Line2D([], [], color="#64748B", lw=1.5, label="gałąź pierwsza (anodowa)"),
            Line2D([], [], color="#7C9A86", lw=1.5, label="gałąź powrotna (katodowa)"),
            Line2D([], [], marker="^", color="#94A3B8", ls="", label="kandydaci pików (anodowa)"),
            Line2D([], [], marker="v", color="#94A3B8", ls="", label="kandydaci pików (katodowa)"),
            Line2D([], [], marker="o", color="#2563EB", ls="", label="punkty 1–2 = wzorzec TPrA"),
            Line2D([], [], marker="o", color="#DC2626", ls="", label="punkty 3–4 = analit"),
            Line2D([], [], color="#2563EB", alpha=0.25, lw=8, label="okna szukania TPrA"),
        ]
        fig.legend(handles=legenda, loc="lower center", ncol=2, fontsize=8.5, frameon=False,
                   bbox_to_anchor=(0.5, 0.02))
        pdf.savefig(fig); plt.close(fig)

        pary = [("WYKRYTE", detected[:3]),
                ("ODRZUCONE (ΔE_s poza tolerancją)", grupy.get("not_detected", [])[:3])]
        if all(v for _, v in pary):
            fig, axes = plt.subplots(2, 3, figsize=(11.7, 9.2))
            fig.suptitle("Porównanie: tak wygląda trafienie, a tak odrzucenie",
                         fontsize=13, weight="bold")
            podpisy = []
            for wiersz, (etykieta, lista) in enumerate(pary):
                for kol, (path, wynik) in enumerate(lista):
                    ax = axes[wiersz][kol]
                    podpisy.append((ax, rysuj(ax, algo, path, wynik)))
                axes[wiersz][0].set_ylabel(f"{etykieta}\n\nI / µA", fontsize=8, weight="bold")
            fig.tight_layout(rect=(0, 0.02, 1, 0.94), h_pad=6.0)
            dopisz_powody(fig, podpisy)
            pdf.savefig(fig); plt.close(fig)

        for st in KOLEJNOSC:
            if st not in grupy:
                continue
            lista = grupy[st]
            for start in range(0, len(lista), NA_STRONE):
                partia = lista[start:start + NA_STRONE]
                fig, axes = plt.subplots(2, 3, figsize=(11.7, 9.2))
                fig.suptitle(f"{st} — {start+1}–{start+len(partia)} z {len(lista)}",
                             fontsize=12, weight="bold")
                podpisy = []
                for ax, (path, wynik) in zip(axes.ravel(), partia):
                    podpisy.append((ax, rysuj(ax, algo, path, wynik)))
                for ax in axes.ravel()[len(partia):]:
                    ax.axis("off")
                fig.tight_layout(rect=(0, 0.02, 1, 0.95), h_pad=6.0)
                dopisz_powody(fig, podpisy)
                pdf.savefig(fig); plt.close(fig)
                print(f"  {st}: {start+len(partia)}/{len(lista)}")

    print(f"\nZapisano: {OUT}")


if __name__ == "__main__":
    main()
