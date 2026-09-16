"""PeakWise analysis core, version 1.0.

Frozen from the SETUP cell (cell index 1) of the project analysis notebook,
state of 2026-08-23. The source is identified by the hash of that cell, not by a file name:
    notebook cell sha256 = 9c0340708dcb31efac22c39a8fb5ccfb6ad9e73dbc37d66dc35de81ca48cb954
tools/extract_algo.py recomputes it from the notebook and refuses a stale module.
The cell is copied verbatim except for the IPython import, which is replaced by inert stubs
(see tools/extract_algo.py). Nothing in the peak-finding path was edited, reordered or retuned.

Cut from the notebook, none of it reachable from analyze():
  - cell 0, 2, 5, 9, 11, 13 (markdown)
  - cell 3, 6 (Colab file upload widgets, local glob of one hard coded folder)
  - cell 4, 7 (matplotlib figure driver for single and overlay plots)
  - cell 8 (HTML results table for the notebook output area)
  - cell 10 (CSV writer; its exact column list is reproduced by result_row() below)
  - cell 12 (manual Ep override switchboard)
  - cell 14, 15 (experiment.json export for the Unreal engine)

Do not edit by hand: re-run tools/extract_algo.py and bump the version register.
"""
ALGO_VERSION = "1.0"
ALGO_CELL_SHA256 = "9c0340708dcb31efac22c39a8fb5ccfb6ad9e73dbc37d66dc35de81ca48cb954"

# ══════════════════════════════════════════════════════════
# SETUP — importy, stałe, wszystkie funkcje
# Uruchom tę komórkę JAKO PIERWSZĄ
# ══════════════════════════════════════════════════════════

import numpy as np
import pandas as pd
from scipy.signal import find_peaks, savgol_filter
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import io, os, csv
# extract_algo.py: IPython is not available in the browser runtime. These stubs keep the
# notebook card renderer importable; they are never called by the public API below.
def display(*a, **k): pass
def HTML(html=""): return html

try:
    from google.colab import files as colab_files
    W_COLABIE = True
except ImportError:
    W_COLABIE = False

# ── Konfiguracja — możesz dostosować ───────────────────
E_OKNO_ANODOWY   = (0.05, 0.80)  # zakres E do szukania piku anodowego [V]
DE_OKNO_KATODOWY = 0.30          # Ep_c szukamy w [Ep_a - 0.30, Ep_a - 0.01] [V]
OKNO_SG          = 11            # okno Savitzky-Golay (nieparzyste)
POLYORDER_SG     = 3             # rząd wielomianu SG
BASELINE_KOTWICA = 30            # punkty do wyznaczenia baseline (start + koniec gałęzi)

# Który cykl z pliku wielocyklowego: 'ostatni' (tak czyta Bartek w Originie, mail 07.07
# i przykłady 11.08 na skanie 4; tak samo prof. Półtorak w ITIES) albo 'pierwszy'
# (stan sprzed 20.08.2026). Pliki z labu mają po JEDNYM cyklu — kolejne skany to
# kolejne pliki: `ba`, `ba(1)`, `ba(2)`, `ba(3)`.
KTORY_CYKL       = 'ostatni'

# Dwie procedury Ip (Bartek slajd 1 z 11.08, potwierdzone przez prof. 18.08.2026):
#  - pik WYRAŹNY: Ip = I(maksimum) − baseline(Ep)
#  - pik SŁABY (ramię bez maksimum): przecięcie stycznej do zbocza ze styczną za pikiem,
#    Ip = I(przecięcie) − baseline(E przecięcia)
PEAK_SHAPE_DROP_FRAC = 0.05   # spadek za maksimum < 5 % wzrostu ⇒ brak wyraźnego maksimum
PEAK_SHAPE_LOOK_V    = 0.080  # okno za maksimum [V], w którym szukamy spadku
TANGENT_FLANK_FRAC   = (0.25, 0.75)  # styczna do zbocza: MNK po punktach między 25 % a 75 % wzrostu
TANGENT_POST_V       = (0.05, 0.20)  # styczna za pikiem: MNK w oknie [Ep+0,05; Ep+0,20] V
# Okna linii bazowej odczytane z kotwic Bartka (5 przykładów, 11.08.2026):
#  - anodowa: płaski odcinek PRZED wzrostem prądu, kończy się ~0,1-0,2 V przed stopą piku
#  - katodowa: początek gałęzi powrotnej tuż za apeksem (0,86→0,63 V przy apeksie ~0,9 V)
# Jedna reguła dla obu gałęzi: onset = pierwszy punkt, w którym nachylenie prądu
# przekracza max(ONSET_SLOPE_FRAC · maks. nachylenie zbocza, 1,5 · 10. percentyl
# nachylenia przed pikiem); baseline = MNK po odcinku [onset−0,35; onset−0,05] V
# (najbardziej płaski odcinek prądu pojemnościowego tuż przed sygnałem).
# Odtwarza kotwice Bartka: anodowe −0,24…0,06 V, katodowe 0,86…0,63 V (apeks 1,10 V).
ONSET_SLOPE_FRAC    = 0.20
BASELINE_PRZED_ONSET = (0.35, 0.05)
IP_DEFINICJA         = 'krzywa'   # 'krzywa' | 'styczne' — co raportować jako Ip.
# Tabela Bartka (FDM SPE EXPERIMENTS) zgadza się z odczytem KRZYWEJ (walidacja 20.08.2026,
# 45 elektrod, skan 4: Ip_a 1,5 %, Ip_c 3 %), a przecięcie stycznych daje ~8-14 % więcej.
# Bartek sam ma rozstrzygnąć definicję (mail 11.08) — do tego czasu 'krzywa';
# obie wartości są ZAWSZE w wyniku (Ip_*_krzywa, Ip_*_styczne).
FALLBACK_MARGIN_PKT  = 5          # fallback plateau: minimum musi leżeć >= 5 pkt przed końcem gałęzi
SLABY_PIK_STYCZNE    = False      # True = dla piku słabego (ramię) raportuj przecięcie
                                  # stycznych (procedura prof. z 18.08); False = jak tabela Bartka

KANDYDACI_E = ["Potential applied (V)", "WE(1).Potential (V)",
               "Potential", "Potential (V)", "E", "E/V", "E (V)"]
KANDYDACI_I = ["WE(1).Current (A)", "Current", "Current (A)", "I", "I/A", "I (A)"]


# ══════════════════════════════════════════════════════════
# PARSER
# ══════════════════════════════════════════════════════════

def _sep_dec(tekst):
    linie = tekst.strip().split('\n')[:5]
    sep = ';' if any(';' in l for l in linie) else '\t'
    dec = ',' if (sep == ';' and any(',' in l for l in linie[1:])) else '.'
    return sep, dec


def wczytaj_plik(zawartosc_bytes, nazwa_pliku=""):
    """Wczytuje plik TXT z NOVA. Zwraca (E[V], I[A], info_dict)."""
    for enc in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1250']:
        try: tekst = zawartosc_bytes.decode(enc); break
        except UnicodeDecodeError: continue
    else:
        raise ValueError(f"Nie można zdekodować: {nazwa_pliku}")

    sep, dec = _sep_dec(tekst)
    df = pd.read_csv(io.StringIO(tekst), sep=sep, decimal=dec,
                     header=0, engine='python', on_bad_lines='skip')
    df.columns = [str(c).strip() for c in df.columns]

    kol_E = next((k for k in KANDYDACI_E if k in df.columns), None)
    kol_I = next((k for k in KANDYDACI_I if k in df.columns), None)

    if (kol_E is None or kol_I is None) and df.shape[1] >= 2:
        df2 = pd.read_csv(io.StringIO(tekst), sep=sep, decimal=dec,
                          header=None, engine='python', on_bad_lines='skip')
        E = pd.to_numeric(df2.iloc[:, 0], errors='coerce').dropna().values
        I = pd.to_numeric(df2.iloc[:, 1], errors='coerce').dropna().values
        if len(E) > 10:
            n = min(len(E), len(I))
            return E[:n], I[:n], {"plik": nazwa_pliku}
        raise ValueError(f"Nie rozpoznano kolumn E/I w {nazwa_pliku}: {list(df.columns)[:6]}")

    E = pd.to_numeric(df[kol_E], errors='coerce').dropna().values
    I = pd.to_numeric(df[kol_I], errors='coerce').dropna().values
    n = min(len(E), len(I))
    if n < 20:
        raise ValueError(f"Za mało punktów ({n}) w {nazwa_pliku}")
    return E[:n], I[:n], {"plik": nazwa_pliku, "sep": sep, "dec": dec, "n": n}


# ══════════════════════════════════════════════════════════
# PODZIAŁ CV NA CYKLE I GAŁĘZIE
# ══════════════════════════════════════════════════════════

def wykryj_cykle(E, I, ktory=None):
    """Wycina jeden cykl z pliku wielocyklowego. Zwraca (E, I, n_cykli).

    Cykl = odcinek od minimum E przed apeksem do minimum E po apeksie.
    `ktory`: 'ostatni' (domyślnie, KTORY_CYKL) albo 'pierwszy'.
    """
    ktory = ktory or KTORY_CYKL
    if len(E) < 50: return E, I, 1
    zakres = E.max() - E.min()
    if zakres < 0.05: return E, I, 1
    apex_idx, _ = find_peaks(E, prominence=0.30 * zakres)
    n = len(apex_idx)
    if n <= 1: return E, I, 1
    if ktory == 'pierwszy':
        idx_min = apex_idx[0] + np.argmin(E[apex_idx[0]:apex_idx[1]])
        return E[:idx_min + 1], I[:idx_min + 1], n
    # ostatni: start w minimum E między przedostatnim a ostatnim apeksem
    idx_start = apex_idx[-2] + np.argmin(E[apex_idx[-2]:apex_idx[-1]])
    return E[idx_start:], I[idx_start:], n


def podziel_cv(E, I):
    """
    Dzieli CV na:
    - E_fwd/I_fwd: gałąź forward (E rosnące, do apex)
    - E_down/I_down: gałąź backward going-DOWN (E malejące od apex do min E)
    - E_up/I_up: powrót do potencjału startowego (jeśli istnieje)
    """
    idx_apex = int(np.argmax(E))
    E_bwd = E[idx_apex:]; I_bwd = I[idx_apex:]
    nadir = int(np.argmin(E_bwd))
    return (E[:idx_apex+1], I[:idx_apex+1],
            E_bwd[:nadir+1], I_bwd[:nadir+1],
            E_bwd[nadir:], I_bwd[nadir:],
            idx_apex)


# ══════════════════════════════════════════════════════════
# BASELINE (dwie kotwice — jak Bartek rysuje w Origin)
# ══════════════════════════════════════════════════════════

def baseline_dwa_anchor(E_branch, I_branch, E_piku, m=None):
    """
    Linia prosta od avg(pierwsze m punktów) do avg(ostatnie m punktów).
    Oceniana w punkcie E_piku.
    Odpowiada ręcznej linii bazowej rysowanej w Origin.
    """
    m = min(m or BASELINE_KOTWICA, len(E_branch) // 4)
    E_l = np.mean(E_branch[:m]);  I_l = np.mean(I_branch[:m])
    E_r = np.mean(E_branch[-m:]); I_r = np.mean(I_branch[-m:])
    if abs(E_r - E_l) < 1e-9: return float(I_l)
    return float(I_l + (I_r - I_l) / (E_r - E_l) * (E_piku - E_l))


# ══════════════════════════════════════════════════════════
# KSZTAŁT PIKU I STYCZNE (wspólne dla obu gałęzi)
# Pracują na prądzie znormalizowanym `y` = I·sign, tak żeby pik był ZAWSZE
# maksimum (anodowy: sign=+1, katodowy: sign=−1), a oś E rosła wzdłuż skanu
# (`Eb` = E·dir, dir=+1 forward, −1 reverse).
# ══════════════════════════════════════════════════════════

def _points_for_span(Eb, span_v):
    """Liczba punktów gałęzi pokrywająca `span_v` woltów (≥ 2)."""
    step = float(np.median(np.abs(np.diff(Eb)))) if len(Eb) > 1 else 0.0
    return 2 if step <= 0 else max(2, int(round(span_v / step)))


def _line_through(Eb, y, centre, half):
    """Prosta MNK przez ±half punktów wokół `centre`; None gdy za krótko."""
    lo, hi = max(0, centre - half), min(len(y), centre + half + 1)
    if hi - lo < 3:
        return None
    a, b = np.polyfit(Eb[lo:hi], y[lo:hi], 1)
    return float(a), float(b), (float(Eb[lo]), float(Eb[hi - 1]))


def _onset_index(Eb, y, pl):
    """Początek sygnału faradajowskiego przed `pl`.

    Nachylenie dy/dE po starcie gałęzi najpierw OPADA (stan nieustalony po zmianie
    kierunku skanu), osiąga minimum na płaskim prądzie pojemnościowym, potem ROŚNIE
    z sygnałem. Onset = pierwszy punkt ZA najbardziej płaskim odcinkiem, w którym
    nachylenie przekracza max(ONSET_SLOPE_FRAC · maks, 1,5 · 10. percentyl).
    """
    if pl < 5:
        return 0
    dy = np.gradient(y, Eb)
    start = int(np.searchsorted(Eb, Eb[0] + 0.05))
    seg = dy[start:pl + 1]
    if len(seg) < 3 or np.max(seg) <= 0:
        return start
    m = int(np.argmax(seg))                 # najstromszy punkt zbocza
    if m < 3:
        return start
    przed = seg[:m]                         # tylko odcinek PRZED zboczem (za nim nachylenie
    p10 = float(np.percentile(przed, 10))   # znów maleje do zera na wierzchołku)
    prog = max(ONSET_SLOPE_FRAC * float(seg[m]), 1.5 * abs(p10))
    plaskie = np.where(przed <= p10)[0]
    k_min = int(plaskie[-1]) if len(plaskie) else 0
    k = np.where(przed[k_min:] > prog)[0]
    return start + k_min + int(k[0]) if len(k) else start + m


def _baseline_before_onset(Eb, y, onset):
    """Prosta MNK po odcinku [onset−0,35; onset−0,05] V. None, gdy odcinek za krótki."""
    e_on = Eb[onset]
    m = (Eb >= max(e_on - BASELINE_PRZED_ONSET[0], Eb[0] + 0.05)) & (Eb <= e_on - BASELINE_PRZED_ONSET[1])
    idx = np.where(m)[0]
    if len(idx) < 8:
        return None
    a, b = np.polyfit(Eb[idx], y[idx], 1)
    return float(a), float(b), (float(Eb[idx[0]]), float(Eb[idx[-1]]))


def classify_peak_shape(Eb, y, v, pl):
    """'clear' gdy w oknie PEAK_SHAPE_LOOK_V za maksimum `pl` prąd spada o co najmniej
    PEAK_SHAPE_DROP_FRAC wzrostu od stopy `v`; inaczej 'weak' (ramię/plateau), a Ip
    musi przyjść z przecięcia stycznych, nie z y[pl]."""
    rise = float(y[pl] - y[v])
    look = _points_for_span(Eb, PEAK_SHAPE_LOOK_V)
    tail = y[pl:min(len(y), pl + look + 1)]
    drop = float(y[pl] - np.min(tail)) if len(tail) > 1 else 0.0
    ratio = drop / rise if rise > 0 else 0.0
    return ("clear" if ratio >= PEAK_SHAPE_DROP_FRAC else "weak"), ratio


def tangent_intersection(Eb, y, v, pl):
    """Styczna do zbocza × styczna za pikiem (slajd 1 Bartka, 11.08.2026).

    Zbocze: MNK po punktach, w których wzrost od stopy `v` mieści się między
    TANGENT_FLANK_FRAC (czyli „2 punkty na zboczu" w Originie, tylko odporniej).
    Za pikiem: MNK w oknie TANGENT_POST_V za `pl` — Bartek bierze punkty wyraźnie
    ZA maksimum (0,08-0,17 V dalej), nie tuż przy nim.
    Zwraca dict z przecięciem albo None.
    """
    if pl - v < 4:
        return None
    rise = float(y[pl] - y[v])
    if rise <= 0:
        return None
    frac = (y[v:pl + 1] - y[v]) / rise
    fl = v + np.where((frac >= TANGENT_FLANK_FRAC[0]) & (frac <= TANGENT_FLANK_FRAC[1]))[0]
    if len(fl) < 3:
        return None
    post = np.where((Eb > Eb[pl] + TANGENT_POST_V[0]) & (Eb <= Eb[pl] + TANGENT_POST_V[1]))[0]
    post = post[post > pl]
    if len(post) < 3:
        return None
    a1, b1 = np.polyfit(Eb[fl], y[fl], 1)
    a2, b2 = np.polyfit(Eb[post], y[post], 1)
    if abs(a1 - a2) < 1e-12:
        return None
    e_x = (b2 - b1) / (a1 - a2)
    y_x = a1 * e_x + b1
    if not (Eb[v] <= e_x <= Eb[post[-1]]):
        return None
    return {"Eb": float(e_x), "y": float(y_x), "idx_flank": (int(fl[0]), int(fl[-1])),
            "idx_post": (int(post[0]), int(post[-1])), "flank": (float(a1), float(b1)),
            "post": (float(a2), float(b2))}


def _foot_index(y, pl, frac=0.10):
    """Stopa piku: ostatni punkt przed `pl`, w którym wzrost od startu < frac wzrostu."""
    base = float(np.min(y[:pl + 1])) if pl > 0 else float(y[0])
    rise = float(y[pl] - base)
    if rise <= 0:
        return 0
    below = np.where(y[:pl] - base < frac * rise)[0]
    return int(below[-1]) if len(below) else 0


def ip_dwie_procedury(Eb, y, pl, bl_at):
    """Liczy Ip trzema odczytami na znormalizowanej gałęzi i wybiera raportowany.

    `bl_at(Eb)` → wartość baseline (w jednostkach y) dla danego Eb.
    Odczyty:
      Ip_max      = y[pl] − bl(Ep)            klasyczny: maksimum piku minus bazowa
      Ip_krzywa_x = y(E_x) − bl(E_x)          krok 4 Bartka: pionowa z przecięcia stycznych,
                                              odczyt KRZYWEJ i bazowej przy E_x (slajd 2)
      Ip_styczne  = y_x − bl(E_x)             przecięcie stycznych minus bazowa (slajd 4)
    Wybór: pik wyraźny → Ip_max (albo styczne, gdy IP_DEFINICJA='styczne');
           pik słaby (ramię bez maksimum) → Ip_krzywa_x (albo styczne, gdy SLABY_PIK_STYCZNE).
    """
    v = _onset_index(Eb, y, pl)
    shape, ratio = classify_peak_shape(Eb, y, v, pl)
    tang = tangent_intersection(Eb, y, v, pl)
    ip_max = float(y[pl] - bl_at(Eb[pl]))
    if tang:
        ip_krzywa_x = float(np.interp(tang["Eb"], Eb, y)) - float(bl_at(tang["Eb"]))
        ip_styczne = float(tang["y"] - bl_at(tang["Eb"]))
    else:
        ip_krzywa_x, ip_styczne = None, None
    if shape == "weak" and tang:
        if SLABY_PIK_STYCZNE: ip, metoda = ip_styczne, "styczne (pik słaby)"
        else:                 ip, metoda = ip_krzywa_x, "krzywa przy przecięciu (pik słaby)"
    elif IP_DEFINICJA == 'styczne' and tang:
        ip, metoda = ip_styczne, "styczne"
    else:
        ip, metoda = ip_max, "maksimum"
    return {"shape": shape, "drop_ratio": ratio, "idx_onset": v, "styczne": tang,
            "Ip_max": ip_max, "Ip_krzywa_x": ip_krzywa_x, "Ip_styczne": ip_styczne,
            "E_styczne": tang["Eb"] if tang else None, "Ip": ip, "metoda": metoda}


# ══════════════════════════════════════════════════════════
# DETEKCJA PIKU ANODOWEGO (forward)
# ══════════════════════════════════════════════════════════

def znajdz_pik_anodowy(E_fwd, I_fwd, E_okno=None):
    """
    Pik anodowy = maksimum I na forward. Ip_a = pik - baseline.
    Baseline = linia przez STOPE przed pikiem (E < Epa-0.35), ekstrapolowana do Epa.
    Odpowiada skosnej linii bazowej Bartka (Wytlumaczenie.pptx, 10.07.2026).
    Od 20.08.2026: Ip liczone dwiema procedurami (krzywa / styczne), patrz ip_dwie_procedury.
    """
    E_okno = E_okno or E_OKNO_ANODOWY
    n = len(I_fwd)
    if n < 20: return None
    w = min(OKNO_SG, n//3*2+1); w = w if w%2==1 else w-1; w = max(5, w)
    Is = savgol_filter(I_fwd, w, POLYORDER_SG, mode='interp')
    maska = (E_fwd >= E_okno[0]) & (E_fwd <= E_okno[1])
    if not maska.any(): return None
    idx_w = np.where(maska)[0]
    best = idx_w[np.argmax(Is[idx_w])]
    Epa = float(E_fwd[best])
    onset = _onset_index(E_fwd, Is, int(best))
    E_stopa = float(E_fwd[onset])
    linia = _baseline_before_onset(E_fwd, I_fwd, onset)
    regula = "onset"
    if linia is not None:
        a, b, okno = linia
        bl_at = lambda e: a*e + b
    else:                                   # za krótka stopa → stara reguła (E < Epa−0,35)
        regula = "stopa<Epa-0.35"
        idxf = np.where(E_fwd < Epa - 0.35)[0]
        if len(idxf) >= 8:
            a, b = np.polyfit(E_fwd[idxf], I_fwd[idxf], 1); bl_at = lambda e: a*e + b
            okno = (float(E_fwd[idxf[0]]), float(E_fwd[idxf[-1]]))
        else:
            bl_at = lambda e: baseline_dwa_anchor(E_fwd, I_fwd, e); okno = None
    bl = bl_at(Epa)
    dp = ip_dwie_procedury(E_fwd, Is, int(best), bl_at)
    return {
        "Ep_a":     Epa,
        "Ip_a_raw": float(I_fwd[best] * 1e9),
        "Ip_a":     float(dp["Ip"] * 1e9),
        "Ip_a_max":      float(dp["Ip_max"] * 1e9),
        "Ip_a_krzywa_x": (float(dp["Ip_krzywa_x"] * 1e9) if dp["Ip_krzywa_x"] is not None else None),
        "Ip_a_styczne":  (float(dp["Ip_styczne"] * 1e9) if dp["Ip_styczne"] is not None else None),
        "E_a_styczne":  dp["E_styczne"],
        "ksztalt":  dp["shape"], "metoda": dp["metoda"], "drop_ratio": dp["drop_ratio"],
        "bl_a":     float(bl * 1e9),
        "bl_okno":  okno, "bl_regula": regula,
        "E_onset":  E_stopa,
        "bl_fn":    bl_at,
        "idx":      int(best),
    }


# ══════════════════════════════════════════════════════════
# DETEKCJA PIKU KATODOWEGO (backward going-DOWN)
# ══════════════════════════════════════════════════════════

def znajdz_pik_katodowy(E_down, I_down, pik_a, dE_okno=None):
    """
    Pik katodowy (redukcja) = najbardziej WYRAZNE lokalne minimum pradu na reverse,
    ponizej Ep_a (find_peaks na -I, prominencja skalowana do piku anodowego).

    Ip_c = pik - baseline. Baseline = OGON DYFUZYJNY na reverse NAD startem redukcji,
    ekstrapolowany do Ep_c. Start redukcji = zero-crossing pradu (od + do -, gdy E maleje)
    miedzy apexem a pikiem. Ogon fitowany w [zc+0.15, zc+0.60] V. Odtwarza metode Bartka
    (baseline dodatni nad ujemnym pikiem -> |Ip_c| wieksze niz surowa wartosc; slajd 5
    Wytlumaczenie.pptx). Od 20.08.2026: Ip dwiema procedurami (krzywa / styczne).
    """
    n = len(I_down)
    if n < 30 or not pik_a:
        return None
    w = min(OKNO_SG * 2 + 1, n // 3 * 2 + 1); w = w if w % 2 == 1 else w - 1; w = max(7, w)
    Is = savgol_filter(I_down, w, POLYORDER_SG, mode='interp')
    maska = E_down <= pik_a['Ep_a'] - 0.02
    if not maska.any():
        return None
    prog = max(0.05 * abs(pik_a['Ip_a']) * 1e-9, 20e-9)
    peaks, props = find_peaks(-Is, prominence=prog)
    keep = [(p, props['prominences'][i]) for i, p in enumerate(peaks) if maska[p]]
    fallback = False
    if keep:
        best = max(keep, key=lambda t: t[1])[0]
    else:
        # FALLBACK PLATEAU (23.08.2026): brak lokalnego
        # minimum o wymaganej prominencji (plateau albo bardzo płytki pik). Bierzemy
        # minimum wygładzonego prądu w oknie poniżej Ep_a; dalej ta sama bazowa onset.
        idx_w = np.where(maska)[0]
        best = int(idx_w[np.argmin(Is[idx_w])])
        if best >= n - FALLBACK_MARGIN_PKT:      # minimum na końcu gałęzi = brak plateau, nie zgadujemy
            return None
        fallback = True
    Ep_c = float(E_down[best])
    # zero-crossing (start redukcji) miedzy apexem a pikiem katodowym
    seg = np.where((E_down < pik_a['Ep_a'] - 0.02) & (E_down > Ep_c))[0]
    zc = None
    for k in range(len(seg) - 1):
        if I_down[seg[k]] > 0 and I_down[seg[k + 1]] <= 0:
            zc = E_down[seg[k]]; break
    if zc is None:
        zc = Ep_c + 0.30
    # baseline: płaski odcinek przed onsetem redukcji (ta sama reguła co anodowa,
    # na gałęzi znormalizowanej Eb=−E, y=−I); gdy za krótki → stara reguła nad zc
    onset_c = _onset_index(-E_down, -Is, int(best))
    linia = _baseline_before_onset(-E_down, -I_down, onset_c)
    regula = "onset"
    if linia is not None:
        a_n, b_n, okno_n = linia             # w układzie znormalizowanym
        bl_at = lambda e: -(a_n * (-e) + b_n)
        okno = (-okno_n[0], -okno_n[1])
    else:
        regula = "ogon nad zc"
        idxt = np.where((E_down > zc + 0.15) & (E_down < zc + 0.60))[0]
        if len(idxt) >= 6:
            a, b = np.polyfit(E_down[idxt], I_down[idxt], 1); bl_at = lambda e: a * e + b
            okno = (float(E_down[idxt[0]]), float(E_down[idxt[-1]]))
        else:
            bl_at = lambda e: 0.0; okno = None
    bl = bl_at(Ep_c)
    # normalizacja: reverse biegnie w dół E, pik jest minimum ⇒ Eb=-E, y=-I
    dp = ip_dwie_procedury(-E_down, -Is, int(best), lambda eb: -bl_at(-eb))
    if fallback:
        if regula != "onset" or dp["Ip_krzywa_x"] is None or dp["Ip_krzywa_x"] <= 0:
            return None                          # brak płaskiej bazowej albo krzywa nad bazową: to nie jest pik
        dp["shape"] = "weak"; dp["metoda"] = "fallback plateau"
        dp["Ip"] = dp["Ip_krzywa_x"] if (dp["Ip_krzywa_x"] is not None and not SLABY_PIK_STYCZNE) else \
                   (dp["Ip_styczne"] if dp["Ip_styczne"] is not None else dp["Ip_max"])
    return {
        "Ep_c":     Ep_c,
        "Ip_c_raw": float(I_down[best] * 1e9),
        "Ip_c":     float(-dp["Ip"] * 1e9),
        "Ip_c_max":      float(-dp["Ip_max"] * 1e9),
        "Ip_c_krzywa_x": (float(-dp["Ip_krzywa_x"] * 1e9) if dp["Ip_krzywa_x"] is not None else None),
        "Ip_c_styczne":  (float(-dp["Ip_styczne"] * 1e9) if dp["Ip_styczne"] is not None else None),
        "E_c_styczne":  (-dp["E_styczne"] if dp["E_styczne"] is not None else None),
        "ksztalt":  dp["shape"], "metoda": dp["metoda"], "drop_ratio": dp["drop_ratio"],
        "bl_c":     float(bl * 1e9),
        "bl_okno":  okno, "bl_regula": regula,
        "E_onset":  float(E_down[onset_c]),
        "bl_fn":    bl_at,
        "idx":      int(best),
    }


# ══════════════════════════════════════════════════════════
# PEŁNA ANALIZA JEDNEGO PLIKU
# ══════════════════════════════════════════════════════════

def analizuj_plik(zawartosc_bytes, nazwa_pliku):
    """Wczytuje plik CV, wykrywa piki, zwraca dict z wynikami."""
    E, I, info = wczytaj_plik(zawartosc_bytes, nazwa_pliku)
    E, I, n_cykli = wykryj_cykle(E, I)
    E_fwd, I_fwd, E_down, I_down, E_up, I_up, idx_apex = podziel_cv(E, I)

    pik_a = znajdz_pik_anodowy(E_fwd, I_fwd)
    pik_c = znajdz_pik_katodowy(E_down, I_down, pik_a) if pik_a else None

    w = {
        "plik": nazwa_pliku, "n_pkt": len(E), "n_cykli": n_cykli, "cykl": KTORY_CYKL,
        "E": E, "I": I,
        "E_fwd": E_fwd, "I_fwd": I_fwd,
        "E_down": E_down, "I_down": I_down,
        "E_up": E_up, "I_up": I_up,
        "pik_a": pik_a, "pik_c": pik_c,
        "Ep_a": None, "Ep_c": None, "delta_Ep": None,
        "Ip_a_nA": None, "Ip_c_nA": None, "Ip_a_Ip_c": None,
    }

    if pik_a: w["Ep_a"] = pik_a["Ep_a"]; w["Ip_a_nA"] = pik_a["Ip_a"]
    if pik_c: w["Ep_c"] = pik_c["Ep_c"]; w["Ip_c_nA"] = pik_c["Ip_c"]

    if pik_a and pik_c:
        w["delta_Ep"] = pik_a["Ep_a"] - pik_c["Ep_c"]
        if pik_c["Ip_c"] != 0:
            w["Ip_a_Ip_c"] = abs(pik_a["Ip_a"] / pik_c["Ip_c"])
        w["status"] = "ok"
    elif pik_a: w["status"] = "tylko_anodowy"
    elif pik_c: w["status"] = "tylko_katodowy"
    else:       w["status"] = "brak_pikow"

    return w


# ══════════════════════════════════════════════════════════
# WIZUALIZACJA
# ══════════════════════════════════════════════════════════

def pokaz_wykres_pojedynczy(wynik, ax=None, kolor='#2563eb', etykieta=None):
    """Rysuje CV z oznaczeniem piku anodowego i katodowego oraz użytej baseline."""
    pokaz = ax is None
    if ax is None:
        fig, ax = plt.subplots(figsize=(10, 6))

    label = etykieta or wynik["plik"]
    ax.plot(wynik["E"], wynik["I"] * 1e9, color=kolor, linewidth=1.6, label=label)

    p_a = wynik.get("pik_a")
    if p_a:
        ax.scatter(p_a["Ep_a"], p_a["Ip_a_raw"],
                   color='#dc2626', s=80, zorder=5, label=f"Ep_a={p_a['Ep_a']:.3f}V")
        ax.axvline(p_a["Ep_a"], linestyle='--', color='#dc2626', alpha=0.35, linewidth=1)
        ax.annotate(f"Ep_a = {p_a['Ep_a']:.3f} V ({p_a['metoda']})",
                    xy=(p_a["Ep_a"], p_a["Ip_a_raw"]),
                    xytext=(8, 6), textcoords='offset points',
                    color='#dc2626', fontsize=9, fontweight='bold')
        Ef = wynik["E_fwd"]
        ee = np.linspace(Ef.min(), p_a["Ep_a"] + 0.05, 50)
        ax.plot(ee, [p_a["bl_fn"](e) * 1e9 for e in ee],
                '--', color='#dc2626', alpha=0.35, linewidth=1)
        if p_a.get("E_a_styczne") is not None:
            ax.axvline(p_a["E_a_styczne"], linestyle=':', color='#dc2626', alpha=0.5)

    p_c = wynik.get("pik_c")
    if p_c:
        ax.scatter(p_c["Ep_c"], p_c["Ip_c_raw"],
                   color='#2563eb', s=80, zorder=5, label=f"Ep_c={p_c['Ep_c']:.3f}V")
        ax.axvline(p_c["Ep_c"], linestyle='--', color='#2563eb', alpha=0.35, linewidth=1)
        ax.annotate(f"Ep_c = {p_c['Ep_c']:.3f} V ({p_c['metoda']})",
                    xy=(p_c["Ep_c"], p_c["Ip_c_raw"]),
                    xytext=(8, -14), textcoords='offset points',
                    color='#2563eb', fontsize=9, fontweight='bold')
        Ed = wynik["E_down"]
        ee = np.linspace(p_c["Ep_c"] - 0.05, Ed.max(), 50)
        ax.plot(ee, [p_c["bl_fn"](e) * 1e9 for e in ee],
                '--', color='#2563eb', alpha=0.35, linewidth=1)
        if p_c.get("E_c_styczne") is not None:
            ax.axvline(p_c["E_c_styczne"], linestyle=':', color='#2563eb', alpha=0.5)

    tytul = label
    if p_a and p_c and wynik.get("delta_Ep") is not None:
        tytul += (f"\nEp_a={p_a['Ep_a']:.3f}V  Ep_c={p_c['Ep_c']:.3f}V  "
                  f"ΔEp={wynik['delta_Ep']*1000:.1f}mV")
    ax.set_title(tytul, fontsize=11)
    ax.set_xlabel("Potencjał E [V]")
    ax.set_ylabel("Prąd I [nA]")
    ax.grid(True, alpha=0.2)
    ax.axhline(0, color='gray', linewidth=0.5, alpha=0.5)

    if pokaz:
        plt.tight_layout(); plt.show()


# ══════════════════════════════════════════════════════════
# KARTA WYNIKU HTML
# ══════════════════════════════════════════════════════════

def _k(etykieta, wartosc):
    return (f"<div style='background:#fff;border:1px solid #e5e7eb;border-radius:10px;"
            f"padding:10px;'><div style='font-size:11px;color:#64748b;'>{etykieta}</div>"
            f"<div style='font-size:18px;font-weight:800;color:#0f172a;'>{wartosc}</div></div>")


def pokaz_karte_wyniku(wynik):
    s = wynik.get('status', 'brak')
    c = '#16a34a' if s=='ok' else ('#d97706' if 'tylko' in s else '#dc2626')
    ikona = '✅' if s=='ok' else ('⚠️' if 'tylko' in s else '❌')
    tytul = {'ok':'Para pików wykryta','tylko_anodowy':'Tylko pik anodowy',
              'tylko_katodowy':'Tylko pik katodowy','brak_pikow':'Brak pików'}.get(s, s)

    def fmt(v, d=4, u=''): return f"{v:.{d}f}{u}" if v is not None else '—'
    pa, pc = wynik.get('pik_a') or {}, wynik.get('pik_c') or {}

    display(HTML(f"""
    <div style="font-family:Arial,sans-serif;border:1px solid #e5e7eb;border-radius:14px;
                padding:18px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.06);
                max-width:820px;margin:12px 0;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <div style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;
                    justify-content:center;background:{c};color:#fff;font-size:22px;">{ikona}</div>
        <div>
          <div style="font-size:11px;color:#64748b;font-weight:700;">ELECTROLAB 3D — CV ANALYZER</div>
          <div style="font-size:20px;color:{c};font-weight:800;">{tytul}</div>
          <div style="font-size:12px;color:#334155;">{wynik['plik']} · cykl: {wynik.get('cykl','?')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        {_k('Ep_a [anodowy]', fmt(wynik.get('Ep_a'),4,' V'))}
        {_k('Ep_c [katodowy]', fmt(wynik.get('Ep_c'),4,' V'))}
        {_k('ΔEp', fmt(wynik['delta_Ep']*1000 if wynik.get('delta_Ep') else None,1,' mV'))}
        {_k(f"Ip_a [{pa.get('metoda','—')}]", fmt(wynik.get('Ip_a_nA'),1,' nA'))}
        {_k(f"Ip_c [{pc.get('metoda','—')}]", fmt(wynik.get('Ip_c_nA'),1,' nA'))}
        {_k('|Ip_a / Ip_c|', fmt(wynik.get('Ip_a_Ip_c'),3))}
        {_k('Ip_a max / krzywa@x / styczne', f"{fmt(pa.get('Ip_a_max'),1)} / {fmt(pa.get('Ip_a_krzywa_x'),1)} / {fmt(pa.get('Ip_a_styczne'),1)} nA")}
        {_k('Ip_c max / krzywa@x / styczne', f"{fmt(pc.get('Ip_c_max'),1)} / {fmt(pc.get('Ip_c_krzywa_x'),1)} / {fmt(pc.get('Ip_c_styczne'),1)} nA")}
        {_k('Kształt pików a / c', f"{pa.get('ksztalt','—')} / {pc.get('ksztalt','—')}")}
      </div>
    </div>"""))


print(f"✅ Setup zakończony (cykl: {KTORY_CYKL}, Ip: {IP_DEFINICJA}, słaby pik→styczne: {SLABY_PIK_STYCZNE}). Możesz uruchomić kolejne komórki.")


# ══════════════════════════════════════════════════════════
# PUBLIC API, added for the web app. Not part of the notebook cell.
# Everything below only wraps and serialises what the notebook functions above
# return. No peak, no baseline and no current is recomputed here.
# ══════════════════════════════════════════════════════════

# Notebook status -> stable code for the UI dictionary.
STATUS_CODES = {
    "ok": "ok",
    "tylko_anodowy": "anodic_only",
    "tylko_katodowy": "cathodic_only",
    "brak_pikow": "no_peaks",
}

# Notebook Ip method label -> stable code for the UI dictionary.
METHOD_CODES = {
    "maksimum": "maximum",
    "styczne": "tangents",
    "styczne (pik słaby)": "tangents_weak",
    "krzywa przy przecięciu (pik słaby)": "curve_at_intersection",
    "fallback plateau": "plateau_fallback",
}

# Notebook baseline rule label -> stable code for the UI dictionary.
BASELINE_CODES = {
    "onset": "onset_fit",
    "stopa<Epa-0.35": "foot_fit",
    "ogon nad zc": "tail_over_zero_crossing",
}

# Exactly the header of cell 10 of the notebook (cv_wyniki_zbiorcze.csv).
CSV_COLUMNS = [
    "plik", "n_pkt", "n_cykli", "cykl", "status",
    "Ep_a_V", "Ep_c_V", "delta_Ep_mV", "Ip_a_nA", "Ip_c_nA", "Ip_a_Ip_c",
    "Ip_a_metoda", "Ip_a_max_nA", "Ip_a_krzywa_x_nA", "Ip_a_styczne_nA", "ksztalt_a",
    "Ip_c_metoda", "Ip_c_max_nA", "Ip_c_krzywa_x_nA", "Ip_c_styczne_nA", "ksztalt_c",
]

BASELINE_PLOT_POINTS = 50   # same sampling as the notebook plot helper


def _f(value):
    """float or None, with NaN and infinities flattened to None for JSON."""
    if value is None:
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    if out != out or out in (float("inf"), float("-inf")):
        return None
    return out


def _fv(value, digits=6):
    """Cell 10 number formatter, kept identical so the CSV matches the notebook."""
    return f"{value:.{digits}f}" if value is not None else ""


def _series(values, scale=1.0):
    return [float(v) * scale for v in values]


def _baseline_curve(bl_fn, e_from, e_to):
    """Baseline sampled over the range the notebook plot draws it on, in V and nA."""
    if bl_fn is None or e_from is None or e_to is None:
        return None
    grid = np.linspace(float(e_from), float(e_to), BASELINE_PLOT_POINTS)
    return {
        "E_V": [float(e) for e in grid],
        "I_nA": [float(bl_fn(e)) * 1e9 for e in grid],
    }


def _window(okno):
    if not okno:
        return None
    a, b = float(okno[0]), float(okno[1])
    return {"from_V": a, "to_V": b, "width_V": abs(b - a)}


def _peak_payload(peak, prefix, bl_from, bl_to):
    """One branch of the result, translated to English keys. Values are passed through."""
    if not peak:
        return None
    ip_reported = _f(peak[f"Ip_{prefix}"])
    ip_curve_x = _f(peak[f"Ip_{prefix}_krzywa_x"])
    ip_tangents = _f(peak[f"Ip_{prefix}_styczne"])
    e_x = _f(peak[f"E_{prefix}_styczne"])
    bl_fn = peak.get("bl_fn")
    baseline_at_peak = _f(peak[f"bl_{prefix}"])
    baseline_at_x = None
    curve_at_x = None
    tangent_at_x = None
    if bl_fn is not None and e_x is not None:
        baseline_at_x = _f(bl_fn(e_x) * 1e9)
        if baseline_at_x is not None:
            if ip_curve_x is not None:
                curve_at_x = ip_curve_x + baseline_at_x
            if ip_tangents is not None:
                tangent_at_x = ip_tangents + baseline_at_x
    method = peak.get("metoda")
    rule = peak.get("bl_regula")
    return {
        "Ep_V": _f(peak[f"Ep_{prefix}"]),
        "Ip_nA": ip_reported,
        "Ip_uA": None if ip_reported is None else ip_reported / 1000.0,
        "Ip_raw_nA": _f(peak[f"Ip_{prefix}_raw"]),
        "Ip_max_nA": _f(peak[f"Ip_{prefix}_max"]),
        "Ip_curve_at_x_nA": ip_curve_x,
        "Ip_tangents_nA": ip_tangents,
        "E_tangents_V": e_x,
        "shape": peak.get("ksztalt"),
        "method": method,
        "method_code": METHOD_CODES.get(method, "other"),
        "drop_ratio": _f(peak.get("drop_ratio")),
        "baseline_nA": baseline_at_peak,
        "baseline_rule": rule,
        "baseline_rule_code": BASELINE_CODES.get(rule, "other"),
        "baseline_window": _window(peak.get("bl_okno")),
        "baseline_curve": _baseline_curve(bl_fn, bl_from, bl_to),
        "baseline_at_x_nA": baseline_at_x,
        "curve_at_x_nA": curve_at_x,
        "tangent_at_x_nA": tangent_at_x,
        "E_onset_V": _f(peak.get("E_onset")),
        "index": int(peak["idx"]) if peak.get("idx") is not None else None,
    }


def _collect_warnings(w, pik_a, pik_c):
    """Facts already present in the notebook result, phrased as one warning each."""
    out = []
    if (w.get("n_cykli") or 1) > 1:
        out.append({
            "code": "multi_cycle", "severity": "low",
            "cycle_used": w.get("cykl"), "n_cycles": int(w["n_cykli"]),
        })
    if pik_a is None:
        out.append({"code": "no_anodic_peak", "severity": "high"})
    if pik_c is None:
        out.append({"code": "no_cathodic_peak", "severity": "high"})
    for peak, branch in ((pik_a, "anodic"), (pik_c, "cathodic")):
        if not peak:
            continue
        if peak.get("ksztalt") == "weak":
            out.append({"code": "weak_peak", "severity": "medium", "branch": branch})
        if peak.get("metoda") == "fallback plateau":
            out.append({"code": "plateau_fallback", "severity": "medium", "branch": branch})
        if peak.get("bl_regula") != "onset":
            out.append({
                "code": "baseline_fallback", "severity": "medium", "branch": branch,
                "rule": peak.get("bl_regula"),
            })
        elif peak.get("bl_okno") is None:
            out.append({"code": "baseline_window_missing", "severity": "medium", "branch": branch})
    return out


def result_row(result):
    """The cv_wyniki_zbiorcze.csv row of cell 10, same columns, same rounding."""
    a = result.get("anodic") or {}
    c = result.get("cathodic") or {}
    d_mV = result.get("dEp_mV")
    return {
        "plik": result.get("file_name"),
        "n_pkt": result.get("n_points"),
        "n_cykli": result.get("n_cycles"),
        "cykl": result.get("cycle_used") or "",
        "status": result.get("status_notebook") or result.get("status"),
        "Ep_a_V": _fv(a.get("Ep_V")),
        "Ep_c_V": _fv(c.get("Ep_V")),
        # cell 10 writes an empty cell when delta_Ep is falsy, kept as is
        "delta_Ep_mV": _fv(d_mV if d_mV else None, 3),
        "Ip_a_nA": _fv(a.get("Ip_nA"), 3),
        "Ip_c_nA": _fv(c.get("Ip_nA"), 3),
        "Ip_a_Ip_c": _fv(result.get("Ip_ratio"), 4),
        "Ip_a_metoda": a.get("method") or "",
        "Ip_a_max_nA": _fv(a.get("Ip_max_nA"), 3),
        "Ip_a_krzywa_x_nA": _fv(a.get("Ip_curve_at_x_nA"), 3),
        "Ip_a_styczne_nA": _fv(a.get("Ip_tangents_nA"), 3),
        "ksztalt_a": a.get("shape") or "",
        "Ip_c_metoda": c.get("method") or "",
        "Ip_c_max_nA": _fv(c.get("Ip_max_nA"), 3),
        "Ip_c_krzywa_x_nA": _fv(c.get("Ip_curve_at_x_nA"), 3),
        "Ip_c_styczne_nA": _fv(c.get("Ip_tangents_nA"), 3),
        "ksztalt_c": c.get("shape") or "",
    }


def algo_config():
    """Every tunable the frozen cell exposes, read from the module, never from the UI."""
    return {
        "E_OKNO_ANODOWY": [float(E_OKNO_ANODOWY[0]), float(E_OKNO_ANODOWY[1])],
        "DE_OKNO_KATODOWY": float(DE_OKNO_KATODOWY),
        "OKNO_SG": int(OKNO_SG),
        "POLYORDER_SG": int(POLYORDER_SG),
        "BASELINE_KOTWICA": int(BASELINE_KOTWICA),
        "KTORY_CYKL": KTORY_CYKL,
        "PEAK_SHAPE_DROP_FRAC": float(PEAK_SHAPE_DROP_FRAC),
        "PEAK_SHAPE_LOOK_V": float(PEAK_SHAPE_LOOK_V),
        "TANGENT_FLANK_FRAC": [float(TANGENT_FLANK_FRAC[0]), float(TANGENT_FLANK_FRAC[1])],
        "TANGENT_POST_V": [float(TANGENT_POST_V[0]), float(TANGENT_POST_V[1])],
        "ONSET_SLOPE_FRAC": float(ONSET_SLOPE_FRAC),
        "BASELINE_PRZED_ONSET": [float(BASELINE_PRZED_ONSET[0]), float(BASELINE_PRZED_ONSET[1])],
        "IP_DEFINICJA": IP_DEFINICJA,
        "FALLBACK_MARGIN_PKT": int(FALLBACK_MARGIN_PKT),
        "SLABY_PIK_STYCZNE": bool(SLABY_PIK_STYCZNE),
        "ALGO_VERSION": ALGO_VERSION,
        "ALGO_CELL_SHA256": ALGO_CELL_SHA256,
        "CSV_COLUMNS": list(CSV_COLUMNS),
    }


def _failed(file_name, status, code, message):
    result = {
        "file_name": file_name,
        "status": status,
        "status_notebook": None,
        "n_points": None,
        "n_cycles": None,
        "cycle_used": None,
        "Ep_a_V": None, "Ep_c_V": None, "dEp_V": None, "dEp_mV": None,
        "Ip_a_nA": None, "Ip_c_nA": None, "Ip_ratio": None,
        "anodic": None, "cathodic": None,
        "curve": None,
        "warnings": [{"code": code, "severity": "high", "detail": message}],
        "algo_version": ALGO_VERSION,
        "algo_cell_sha256": ALGO_CELL_SHA256,
    }
    result["result_row"] = result_row(result)
    return result


def analyze(file_name, content_bytes, with_curve=True):
    """Analyse one CV file. Returns a JSON-ready dict.

    file_name     name shown in the UI and written to the CSV
    content_bytes raw bytes of the TXT export
    with_curve    False drops the E/I arrays (used by the parity test to stay small)
    """
    try:
        w = analizuj_plik(content_bytes, file_name)
    except ValueError as exc:
        text = str(exc)
        if text.startswith("Za mało punktów"):
            return _failed(file_name, "too_few_points", "too_few_points", text)
        return _failed(file_name, "invalid", "unreadable_file", text)
    except Exception as exc:                      # noqa: BLE001 - surfaced to the UI as is
        return _failed(file_name, "error", "analysis_failed", f"{type(exc).__name__}: {exc}")

    pik_a, pik_c = w.get("pik_a"), w.get("pik_c")
    E_fwd, E_down = w["E_fwd"], w["E_down"]
    anodic = _peak_payload(
        pik_a, "a",
        float(np.min(E_fwd)) if len(E_fwd) else None,
        (pik_a["Ep_a"] + 0.05) if pik_a else None,
    )
    cathodic = _peak_payload(
        pik_c, "c",
        (pik_c["Ep_c"] - 0.05) if pik_c else None,
        float(np.max(E_down)) if len(E_down) else None,
    )

    d_V = _f(w.get("delta_Ep"))
    n_fwd, n_down = len(w["E_fwd"]), len(w["E_down"])
    n_up = len(w["E_up"])
    result = {
        "file_name": w["plik"],
        "status": STATUS_CODES.get(w.get("status"), w.get("status")),
        "status_notebook": w.get("status"),
        "n_points": int(w["n_pkt"]),
        "n_cycles": int(w["n_cykli"]),
        "cycle_used": w.get("cykl"),
        "Ep_a_V": _f(w.get("Ep_a")),
        "Ep_c_V": _f(w.get("Ep_c")),
        "dEp_V": d_V,
        "dEp_mV": None if d_V is None else d_V * 1000.0,
        "Ip_a_nA": _f(w.get("Ip_a_nA")),
        "Ip_c_nA": _f(w.get("Ip_c_nA")),
        "Ip_a_uA": None if w.get("Ip_a_nA") is None else _f(w["Ip_a_nA"]) / 1000.0,
        "Ip_c_uA": None if w.get("Ip_c_nA") is None else _f(w["Ip_c_nA"]) / 1000.0,
        "Ip_ratio": _f(w.get("Ip_a_Ip_c")),
        "anodic": anodic,
        "cathodic": cathodic,
        "warnings": _collect_warnings(w, pik_a, pik_c),
        "algo_version": ALGO_VERSION,
        "algo_cell_sha256": ALGO_CELL_SHA256,
    }
    if with_curve:
        # podziel_cv cuts the selected cycle into three consecutive slices that share one
        # point at each join: [0, n_fwd), [n_fwd-1, n_fwd-1+n_down), then the rest.
        down_start = max(n_fwd - 1, 0)
        up_start = max(down_start + n_down - 1, 0)
        result["curve"] = {
            "E_V": _series(w["E"]),
            "I_nA": _series(w["I"], 1e9),
            "fwd_range": [0, n_fwd],
            "down_range": [down_start, down_start + n_down],
            "up_range": [up_start, up_start + n_up],
        }
    else:
        result["curve"] = None
    result["result_row"] = result_row(result)
    return result
