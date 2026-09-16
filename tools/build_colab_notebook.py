from __future__ import annotations

import base64
import json
import math
from datetime import date
from pathlib import Path
from textwrap import dedent


ROOT          = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = ROOT / "ITIES_Detect_Colab_MVP.ipynb"
SAMPLE_PATH   = ROOT / "samples" / "ities_synthetic_amphetamine.csv"
LOGO_PATH     = ROOT / "tools" / "logo_colab.jpg"


def md(source: str, tags: list[str] | None = None) -> dict:
    return {
        "cell_type": "markdown",
        "metadata": {"tags": tags or []},
        "source": dedent(source).strip() + "\n",
    }


def code(source: str, tags: list[str] | None = None) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {"tags": tags or []},
        "outputs": [],
        "source": dedent(source).strip() + "\n",
    }


def logo_html() -> str:
    if not LOGO_PATH.exists():
        return ""
    logo_b64 = base64.b64encode(LOGO_PATH.read_bytes()).decode("ascii")
    return f'<img src="data:image/jpeg;base64,{logo_b64}" alt="ITIES Detect" width="540">'


INTRO = f"""
# ITIES Detect — Colab MVP

{logo_html()}

## Założenia

Punkty są brane zgodnie z notatką profesora:

- `1` = pik ujemny `TPrA+`, minimum na **reverse sweep**,
- `2` = pik dodatni `TPrA+`, maksimum na **forward sweep**,
- `3` = pik ujemny analitu/amfetaminy, minimum na **reverse sweep**,
- `4` = pik dodatni analitu/amfetaminy, maksimum na **forward sweep**.

```text
nieparzyste 1 i 3 = sygnały ujemne / reverse sweep
parzyste 2 i 4 = sygnały dodatnie / forward sweep
```

Wzory:

```text
E5 = (E1 + E2) / 2
E6 = (E3 + E4) / 2
ΔE_s = E6 − E5
```

Notebook wybiera dominujące pary pików na właściwych gałęziach CV i ocenia zgodność z profilem amfetaminy (`ΔE_s ≈ 0.350 V`).

## Kalibracja osi potencjału

Surowa oś `E` dryfuje między pomiarami (elektrody, ustawienia potencjostatu) — wartości bezwzględne są nieporównywalne. Notebook przesuwa całą oś tak, by środek pary `TPrA+` (`E5`) trafił na termodynamiczną stałą `−0.091 V` — galwaniczny potencjał przejścia jonu `TPrA+` z fazy wodnej do organicznej.

```text
offset = −0.091 − E5_surowe
E_po_kalibracji = E_surowe + offset
```

Oś wykresu **„E [V] po kalibracji"** jest zakotwiczona do wzorca TPrA — dopiero na niej `ΔE_s` jest porównywalny między pomiarami. Wartość **`offset`** (typowo ok. −0.42 V) profesor znajdzie na **podpisie osi X każdego wykresu**; offset mocno odstający (np. −0.8 V) wskazuje na błędną selekcję piku TPrA.
"""


RUN_CELL = r'''
# Uruchom środowisko

import io, re
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from matplotlib.lines import Line2D
from matplotlib.font_manager import FontProperties
from scipy.signal import find_peaks, peak_widths, savgol_filter
from IPython.display import display

try:
    from google.colab import files
except Exception:
    files = None

# ─── Stałe analityczne (NIE zmieniać bez retestowania na 37 plikach) ─────────
TPRA_TARGET_V              = -0.091
AMPHETAMINE_TARGET_DELTA_V = 0.350
DETECTION_TOLERANCE_V      = 0.010
UNCERTAIN_TOLERANCE_V      = 0.015

# ─── Detekcja pików ───────────────────────────────────────────────────────────
PEAK_PROMINENCE_A       = 1.5e-7        # stały próg szumu aparaturowego (0.15 µA)
PEAK_DISTANCE_POINTS    = 20
MAX_PEAK_WIDTH_FRACTION = 0.35

# ─── Okna selekcji TPrA w surowych potencjałach (empiryczne, 37 plików) ──────
WIN_TPRA_POS_RAW      = (0.20, 0.45)   # TPrA+ na forward
WIN_TPRA_NEG_RAW      = (0.05, 0.35)   # TPrA− na backward
SHIFT_MIN             = -0.65           # sanity check shift
SHIFT_MAX             = -0.20
ANALYTE_MIN_OFFSET    = 0.10            # analit min 100 mV na prawo od TPrA
CYCLE_PROMINENCE_FRAC = 0.30            # próg detekcji multi-cyklu

# ─── Tryb wygładzania: "savgol" (zalecany), "raw" (weryfikacja), "ma" (regresja)
DETECTION_MODE = "savgol"

# ─── Kolory wykresu ────────────────────────────────────────────────────────────
FORWARD_COLOR = "#64748B"   # forward sweep — stalowy szary (spokojny, by kropki dominowały)
RETURN_COLOR  = "#7C9A86"   # reverse sweep — szarozielony
TPRA_COLOR    = "#2563EB"   # TPrA: punkty 1, 2 i linia E5 — niebieski
ANALYTE_COLOR = "#DC2626"   # analit: punkty 3, 4 i linia E6 — czerwony
POINT_COLORS  = {
    "1": TPRA_COLOR,    "2": TPRA_COLOR,      # TPrA−, TPrA+
    "3": ANALYTE_COLOR, "4": ANALYTE_COLOR,   # Analit−, Analit+
    "5": TPRA_COLOR,    "6": ANALYTE_COLOR,   # E5 (środek TPrA), E6 (środek analitu)
}

RESULTS    = {}
FILE_STORE = {}

# ─── Narzędzia ogólne ─────────────────────────────────────────────────────────

def to_num(series):
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    return pd.to_numeric(
        series.astype(str)
        .str.replace("﻿", "", regex=False)
        .str.replace(" ", "", regex=False)
        .str.replace(" ", "", regex=False)
        .str.replace(",", ".", regex=False),
        errors="coerce",
    )

def numeric_ratio(series):
    return float(to_num(series).notna().mean()) if len(series) else 0.0

def norm_col(name):
    return re.sub(r"[\s_\-./()]+", "", str(name).replace("﻿", "").lower())

# ─── Status → etykieta wykresu ────────────────────────────────────────────────

def outcome_info(result):
    status = result.get("status")
    if status == "detected":
        return "positive", "#16a34a", "✅"
    if status in ("uncertain",):
        return "inconclusive", "#ca8a04", "⚠️"
    if status in ("invalid", "too_few_points"):
        return "inconclusive", "#ca8a04", "⚠️"
    if status == "MEASUREMENT_QUALITY_FAIL":
        return "measurement_fail", "#475569", "🛑"
    return "negative", "#dc2626", "❌"

# ─── Nagłówek sekcji wyniku ───────────────────────────────────────────────────

def show_section_header(result):
    _, _, icon = outcome_info(result)
    status_label = result.get("status_pl", result.get("status", "?"))
    file_name    = result.get("file_name", "plik")
    print("\n" + "─" * 68)
    print(f"ITIES DETECT — {file_name}  |  {icon} {status_label}")
    print("─" * 68)

# ─── Tytuł wykresu ────────────────────────────────────────────────────────────

def set_colored_plot_title(ax, file_name, outcome, color):
    prefix = f"ITIES DETECT x {file_name} | "
    fig    = ax.figure
    ax.set_title("")
    fontsize = 15
    fp       = FontProperties(size=fontsize, weight="bold")
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    w_prefix, _, _ = renderer.get_text_width_height_descent(prefix, fp, ismath=False)
    w_status, _, _ = renderer.get_text_width_height_descent(outcome, fp, ismath=False)
    bbox            = ax.get_window_extent(renderer=renderer)
    x0              = (bbox.x0 + bbox.x1 - w_prefix - w_status) / 2
    y0              = bbox.y1 + 12
    x_prefix, y_title = fig.transFigure.inverted().transform((x0, y0))
    x_status, _       = fig.transFigure.inverted().transform((x0 + w_prefix, y0))
    fig.text(x_prefix, y_title, prefix, color="#111827", fontproperties=fp, ha="left", va="bottom")
    fig.text(x_status, y_title, outcome, color=color,    fontproperties=fp, ha="left", va="bottom")

def fmt_v(value):
    return "" if value is None else f"{float(value):+.3f} V"

def fmt_uA(value):
    return "" if value is None else f"{float(value) * 1e6:+.2f} µA"

def style_cv_axes(fig, ax):
    fig.patch.set_facecolor("#ffffff")
    ax.set_facecolor("#ffffff")
    ax.tick_params(colors="#374151", labelsize=11)
    ax.xaxis.label.set_color("#374151")
    ax.yaxis.label.set_color("#374151")
    for spine in ax.spines.values():
        spine.set_color("#d1d5db")
    ax.grid(color="#e5e7eb", alpha=0.9, linewidth=0.7)
    ax.axhline(0, color="#9ca3af", linewidth=0.6, alpha=0.6)

def plot_cv_branches(ax, E, I, shift=0.0, calibrated=True):
    try:
        upper, lower = split_cv(E)
        ax.plot(E[upper] + shift, I[upper] * 1e6, color=FORWARD_COLOR, lw=2.4,
                label="Forward sweep")
        ax.plot(E[lower] + shift, I[lower] * 1e6, color=RETURN_COLOR,  lw=2.4,
                label="Reverse sweep")
    except Exception:
        ax.plot(E + shift, I * 1e6, color=FORWARD_COLOR, lw=2.4, label="I(E)")
    if calibrated:
        ax.set_xlabel(f"E [V] po kalibracji, offset {shift:+.3f} V", fontweight="bold")
    else:
        ax.set_xlabel("E [V] surowe, bez kalibracji", fontweight="bold")
    ax.set_ylabel("I [µA]", fontweight="bold")

def finish_cv_plot(fig, ax, file_name, outcome, title_color, ncol=3, extra_handles=None):
    handles, labels = ax.get_legend_handles_labels()
    if extra_handles:
        handles = handles + extra_handles
        labels  = labels + [h.get_label() for h in extra_handles]
    legend = ax.legend(
        handles, labels,
        loc="upper center", bbox_to_anchor=(0.5, -0.13),
        ncol=ncol, frameon=False, fontsize=10,
        handlelength=1.6, columnspacing=1.8,
    )
    if legend:
        for text in legend.get_texts():
            text.set_color("#374151")
            text.set_fontweight("bold")
    fig.tight_layout(rect=[0, 0.18, 1, 0.91])
    fig.subplots_adjust(bottom=0.22, top=0.89)
    set_colored_plot_title(ax, file_name, outcome, title_color)

# ─── Deduplikacja uploadów ────────────────────────────────────────────────────

def unique_upload_key(name, content):
    for old_name, old_content in FILE_STORE.items():
        if old_content == content:
            return None, f"Pominięto duplikat: {name} ma identyczną zawartość jak {old_name}."
    if name not in FILE_STORE and name not in RESULTS:
        return name, None
    stem, dot, suffix = name.rpartition(".")
    base = stem if dot else name
    ext  = "." + suffix if dot else ""
    n = 2
    while True:
        candidate = f"{base}__{n}{ext}"
        if candidate not in FILE_STORE and candidate not in RESULTS:
            return candidate, f"Nazwa {name} była już w sesji, więc zapisano jako {candidate}."
        n += 1

# ─── Parser TXT/CSV ───────────────────────────────────────────────────────────

def read_table(content):
    text = None
    for enc in ("utf-8-sig", "utf-8", "cp1250", "latin-1"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            pass
    if text is None:
        text = content.decode("utf-8", errors="replace")
    best = None
    for sep in (None, ";", "\t", ","):
        for decimal in (",", "."):
            for header in (0, None):
                try:
                    df = pd.read_csv(
                        io.StringIO(text), sep=sep, decimal=decimal,
                        header=header, engine="python",
                    )
                    df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")
                    if df.shape[0] < 3 or df.shape[1] < 2:
                        continue
                    ratios = [numeric_ratio(df[c]) for c in df.columns]
                    score  = sum(r >= 0.7 for r in ratios) * 10 + sum(ratios)
                    names  = {norm_col(c) for c in df.columns}
                    if "potentialappliedv" in names:
                        score += 20
                    if "we1currenta" in names:
                        score += 20
                    if best is None or score > best[0]:
                        best = (score, df, header)
                except Exception:
                    pass
    if best is None:
        raise ValueError("Nie udało się odczytać pliku TXT/CSV.")
    df = best[1].copy()
    if best[2] is None:
        df.columns = [f"kolumna_{i + 1}" for i in range(df.shape[1])]
    else:
        df.columns = [str(c).replace("﻿", "").strip() for c in df.columns]
    return df

def pick_columns(df):
    e_names = ["Potential applied (V)", "WE(1).Potential (V)", "Potential",
               "Potential (V)", "E", "E/V", "E (V)"]
    i_names = ["WE(1).Current (A)", "Current", "Current (A)", "I", "I/A", "I (A)"]
    by_norm  = {norm_col(c): c for c in df.columns}
    e_col    = next((by_norm[norm_col(c)] for c in e_names if norm_col(c) in by_norm), None)
    i_col    = next((by_norm[norm_col(c)] for c in i_names if norm_col(c) in by_norm), None)
    numeric_cols = [c for c in df.columns if numeric_ratio(df[c]) >= 0.7]
    if e_col and i_col and e_col != i_col:
        return e_col, i_col
    if len(numeric_cols) >= 2:
        return numeric_cols[0], numeric_cols[1]
    raise ValueError("Nie rozpoznano kolumn E/I.")

def parse_file(content):
    df = read_table(content)
    e_col, i_col = pick_columns(df)
    clean = pd.DataFrame({"E": to_num(df[e_col]), "I": to_num(df[i_col])}).dropna()
    if len(clean) < 10:
        raise ValueError("Za mało punktów liczbowych E/I.")
    return clean["E"].to_numpy(float), clean["I"].to_numpy(float), e_col, i_col

# ─── Podział CV na gałęzie ────────────────────────────────────────────────────

def split_cv(E):
    d  = np.diff(E)
    nz = d[np.abs(d) > 1e-12]
    if len(nz) == 0:
        raise ValueError("Nie da się rozdzielić skanu CV.")
    first = 1 if nz[0] > 0 else -1
    eps   = max(np.median(np.abs(nz)) * 0.1, 1e-12)
    signs = np.where(d > eps, 1, np.where(d < -eps, -1, 0))
    turn  = next((i + 1 for i, s in enumerate(signs) if s and s != first), None)
    if turn is None:
        raise ValueError("Brak punktu zawrotu potencjału.")
    return np.arange(0, turn + 1), np.arange(turn, len(E))

# ─── Bugfix #1: detekcja multi-cykli ─────────────────────────────────────────

def detect_cycles_and_get_first(E, I):
    """Wykrywa multi-cykle CV i zwraca dane TYLKO z pierwszego cyklu."""
    if len(E) < 50:
        return E, I, 1
    E_range = E.max() - E.min()
    if E_range < 0.1:
        return E, I, 1
    apex_indices, _ = find_peaks(E, prominence=CYCLE_PROMINENCE_FRAC * E_range)
    n_cycles        = len(apex_indices)
    if n_cycles <= 1:
        return E, I, 1
    first_apex  = apex_indices[0]
    second_apex = apex_indices[1]
    min_between = first_apex + int(np.argmin(E[first_apex:second_apex]))
    return E[:min_between + 1], I[:min_between + 1], n_cycles

# ─── Wygładzanie sygnału ──────────────────────────────────────────────────────

def smooth_savgol(y):
    """Savitzky-Golay — zachowuje kształt piku lepiej niż moving average."""
    n = len(y)
    w = max(5, min(31, (n // 45) * 2 + 1))
    if w % 2 == 0:
        w += 1
    if w >= n or w <= 3:
        return np.asarray(y, dtype=float)
    return savgol_filter(y, window_length=w, polyorder=3, mode="interp")

def smooth_signal(y):
    """Wygładzanie zgodnie z DETECTION_MODE."""
    y = np.asarray(y, dtype=float)
    if DETECTION_MODE == "raw":
        return y
    if DETECTION_MODE == "savgol":
        return smooth_savgol(y)
    # "ma" — moving average (test regresyjny)
    window = max(5, min(31, (len(y) // 45) * 2 + 1))
    if window >= len(y):
        return y
    return np.convolve(y, np.ones(window) / window, mode="same")

# ─── Kandydaci pików na gałęzi ────────────────────────────────────────────────

def branch_peaks(E, I, idx, kind):
    raw    = I[idx] if kind == "max" else -I[idx]
    y      = smooth_signal(raw)
    branch = "pierwsza_gorna" if kind == "max" else "powrotna_dolna"
    edge   = max(12, int(len(idx) * 0.08))
    # Próg prominencji = STAŁY próg szumu aparaturowego (PEAK_PROMINENCE_A).
    # NIE skalujemy progu do amplitudy gałęzi — silny pik TPrA zawyżałby
    # go i gubił słabe, ale realne piki analitu (typowo 0.2–1.4 µA przy
    # TPrA rzędu 4–15 µA). To była przyczyna fałszywych statusów TPrA_ONLY.
    distance = max(PEAK_DISTANCE_POINTS, len(idx) // 35)
    peaks, props = find_peaks(y, prominence=PEAK_PROMINENCE_A, distance=distance)
    if len(peaks) == 0:
        return []
    widths = peak_widths(y, peaks, rel_height=0.5)[0]
    rows   = []
    for p, prom, width in zip(peaks, props["prominences"], widths):
        if p < edge or p > len(idx) - edge:
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
    # Bez filtra 'strong peaks' — odrzucał słaby analit względem mocnego
    # TPrA (globalna prominencja). Selekcję robią okna TPrA, zakresy
    # analitu i sanity-check ΔE_s — prominencja służy tylko do rankingu.
    rows = sorted(rows, key=lambda r: r["prom"], reverse=True)
    return rows[:10]

# ─── Decyzja ΔE_s ─────────────────────────────────────────────────────────────

def decision(delta):
    err = abs(delta - AMPHETAMINE_TARGET_DELTA_V)
    eps = 1e-12
    if err <= DETECTION_TOLERANCE_V + eps:
        return "detected", "WYKRYTO", 1, False, err
    if err <= UNCERTAIN_TOLERANCE_V + eps:
        return "uncertain", "NIEPEWNE", 0, True, err
    return "not_detected", "BRAK", 0, False, err

# ─── Punkt z wartości ręcznej ─────────────────────────────────────────────────

def nearest_on_branch(E, I, value, idx, kind):
    local  = int(np.argmin(np.abs(E[idx] - value)))
    gi     = int(idx[local])
    branch = "pierwsza_gorna" if kind == "max" else "powrotna_dolna"
    return {
        "idx": gi, "E": float(value), "I": float(I[gi]),
        "prom": None, "width": None, "kind": kind, "branch": branch,
    }

# ─── Budowanie wyników ────────────────────────────────────────────────────────

def _base_meta(file_name, mode, e_col, i_col, n_cycles,
               n_pts_total, n_pts_used, n_fwd, n_bwd):
    sig = ("savgol_polyorder3_modeinterp" if DETECTION_MODE == "savgol"
           else DETECTION_MODE)
    return {
        "file_name": file_name, "mode": mode,
        "E_column": e_col, "I_column": i_col,
        "n_points_total": n_pts_total, "n_points_used": n_pts_used,
        "n_points": n_pts_total,        # alias dla wstecznej zgodności
        "n_cycles_detected": n_cycles,
        "n_candidates_fwd": n_fwd, "n_candidates_bwd": n_bwd,
        "detection_signal": sig,
    }

def build_result(file_name, E, I, p1, p2, p3, p4, mode, warnings,
                 e_col, i_col, n_cycles, n_pts_total, n_pts_used,
                 n_fwd=0, n_bwd=0):
    E5_raw = (p1["E"] + p2["E"]) / 2
    E6_raw = (p3["E"] + p4["E"]) / 2
    shift  = TPRA_TARGET_V - E5_raw
    E5     = E5_raw + shift          # = TPRA_TARGET_V = -0.091
    E6     = E6_raw + shift
    delta  = E6 - E5
    status, status_pl, binary, review, err = decision(delta)

    amp_tpra = (abs((p2["I"] - p1["I"]) * 1e6)
                if p2.get("I") is not None and p1.get("I") is not None else None)
    amp_ana  = (abs((p4["I"] - p3["I"]) * 1e6)
                if p4.get("I") is not None and p3.get("I") is not None else None)

    ws = list(warnings)
    if "negative" in file_name.lower() and status == "detected":
        ws.append({"code": "negative_filename_positive_result", "severity": "high",
                   "message": ("Plik oznaczony 'negative', ale ΔE_s zgodne z amfetaminą. "
                               "WYMAGANA WERYFIKACJA EKSPERTA.")})
    if amp_ana is not None and amp_ana < 1.0:
        ws.append({"code": "low_analyte_signal", "severity": "medium",
                   "message": f"Słaby sygnał analitu ({amp_ana:.2f} µA)"})
    if amp_tpra is not None and amp_tpra < 3.0:
        ws.append({"code": "weak_standard", "severity": "medium",
                   "message": f"Słaby wzorzec TPrA ({amp_tpra:.2f} µA)"})

    review_final = review or any(w["severity"] in ("high", "medium") for w in ws)

    r = _base_meta(file_name, mode, e_col, i_col, n_cycles,
                   n_pts_total, n_pts_used, n_fwd, n_bwd)
    r.update({
        "status": status, "status_pl": status_pl,
        "binary_result": binary, "review_required": review_final,
        "E1_raw": p1["E"], "E2_raw": p2["E"],
        "E3_raw": p3["E"], "E4_raw": p4["E"],
        "E1": p1["E"] + shift, "E2": p2["E"] + shift,
        "E3": p3["E"] + shift, "E4": p4["E"] + shift,
        "E5": E5, "E6": E6, "delta_Es": delta,
        "error_mV": err * 1000, "shift": shift,
        "amplitude_TPrA_uA": amp_tpra, "amplitude_analyte_uA": amp_ana,
        "warnings": ws,
        "warning": "; ".join(w["message"] for w in ws),
        "points": {"1": p1, "2": p2, "3": p3, "4": p4,
                   "5": {"E": E5}, "6": {"E": E6}},
    })
    return r

def _build_partial_result(file_name, mode, status, status_pl, msg_code, msg_text,
                           p1, p2, shift, warnings, e_col, i_col, n_cycles,
                           n_pts_total, n_pts_used, n_fwd, n_bwd):
    """Wynik dla statusów TPrA_ONLY i NO_VALID_ANALYTE_PAIR."""
    amp_tpra = (abs((p2["I"] - p1["I"]) * 1e6)
                if p2.get("I") is not None and p1.get("I") is not None else None)
    ws = list(warnings)
    ws.append({"code": msg_code, "severity": "medium", "message": msg_text})
    r = _base_meta(file_name, mode, e_col, i_col, n_cycles,
                   n_pts_total, n_pts_used, n_fwd, n_bwd)
    r.update({
        "status": status, "status_pl": status_pl,
        "binary_result": 0, "review_required": True,
        "E1_raw": p1["E"], "E2_raw": p2["E"], "E3_raw": None, "E4_raw": None,
        "E1": p1["E"] + shift, "E2": p2["E"] + shift, "E3": None, "E4": None,
        "E5": TPRA_TARGET_V, "E6": None, "delta_Es": None,
        "error_mV": None, "shift": shift,
        "amplitude_TPrA_uA": amp_tpra, "amplitude_analyte_uA": None,
        "warnings": ws,
        "warning": "; ".join(w["message"] for w in ws),
        "points": {"1": p1, "2": p2, "3": None, "4": None,
                   "5": {"E": TPRA_TARGET_V}, "6": None},
    })
    return r

def build_measurement_quality_fail(file_name, internal_reason, warnings,
                                    E, I, e_col, i_col, n_cycles,
                                    n_pts_total, n_pts_used, n_fwd=0, n_bwd=0):
    """Bugfix #4 — brak TPrA w standardowym oknie = błąd aparaturowy."""
    ws = list(warnings)
    ws.append({"code": "measurement_quality_fail", "severity": "high",
               "message": ("Nie wykryto wzorca TPrA w standardowym oknie potencjału. "
                           "Wskazuje to na zakłócenie aparaturowe w pomiarze. "
                           "Powtórz pomiar w laboratorium.")})
    r = _base_meta(file_name, "auto", e_col, i_col, n_cycles,
                   n_pts_total, n_pts_used, n_fwd, n_bwd)
    r.update({
        "status": "MEASUREMENT_QUALITY_FAIL", "status_pl": "BŁĄD POMIARU",
        "binary_result": 0, "review_required": True,
        "E1_raw": None, "E2_raw": None, "E3_raw": None, "E4_raw": None,
        "E1": None, "E2": None, "E3": None, "E4": None,
        "E5": None, "E6": None, "delta_Es": None,
        "error_mV": None, "shift": None,
        "amplitude_TPrA_uA": None, "amplitude_analyte_uA": None,
        "internal_reason": internal_reason,
        "warnings": ws,
        "warning": f"BŁĄD POMIARU APARATUROWEGO ({internal_reason})",
        "points": {"1": None, "2": None, "3": None, "4": None, "5": None, "6": None},
    })
    return r

def build_invalid_result(file_name, warning, E=None, I=None, e_col=None, i_col=None):
    return {
        "file_name": file_name, "mode": "auto",
        "status": "invalid", "status_pl": "NIEJEDNOZNACZNE",
        "binary_result": 0, "review_required": True,
        "E1": None, "E2": None, "E3": None, "E4": None,
        "E5": None, "E6": None, "delta_Es": None, "error_mV": None,
        "shift": None, "n_points": None if E is None else len(E),
        "E_column": e_col, "I_column": i_col,
        "warnings": [{"code": "invalid", "severity": "high", "message": warning}],
        "warning": warning,
        "points": {"1": None, "2": None, "3": None, "4": None, "5": None, "6": None},
    }

# ─── Wyświetlanie wyników ─────────────────────────────────────────────────────

def show_warnings(warnings):
    icons = {"high": "🚨", "medium": "⚠️", "low": "ℹ️"}
    for w in warnings:
        print(f"  {icons.get(w['severity'], '•')} [{w['code']}] {w['message']}")

def show_invalid_result(result, E=None, I=None):
    show_section_header(result)
    print(f"\nPlik: {result['file_name']} | {result.get('status_pl', result['status'])} | wymagana kontrola ręczna")
    print("Uwaga:", result.get("warning", ""))
    show_warnings(result.get("warnings", []))
    if E is None or I is None:
        return
    outcome, title_color, _ = outcome_info(result)
    fig, ax = plt.subplots(figsize=(14, 7.6))
    style_cv_axes(fig, ax)
    plot_cv_branches(ax, E, I, shift=0.0, calibrated=False)
    if result.get("status") == "MEASUREMENT_QUALITY_FAIL":
        ax.text(0.5, 0.5,
                "BŁĄD POMIARU APARATUROWEGO\n"
                "Nie wykryto wzorca TPrA w standardowym oknie potencjału.\n"
                "Powtórz pomiar w laboratorium.",
                transform=ax.transAxes, ha="center", va="center",
                fontsize=13, color="#475569", weight="bold",
                bbox=dict(boxstyle="round,pad=0.5", facecolor="#f8fafc",
                          edgecolor="#475569", alpha=0.9))
    finish_cv_plot(fig, ax, result["file_name"], outcome, title_color, ncol=2)
    plt.show()

def show_result(E, I, r):
    if r.get("status") in ("MEASUREMENT_QUALITY_FAIL", "invalid", "too_few_points"):
        show_invalid_result(r, E, I)
        return

    show_section_header(r)
    pts = r["points"]

    rows = [
        {"punkt": "1", "znaczenie": "minimum TPrA+",
         "E": fmt_v(r.get("E1")),
         "I": fmt_uA(pts["1"]["I"] if pts.get("1") else None)},
        {"punkt": "2", "znaczenie": "maksimum TPrA+",
         "E": fmt_v(r.get("E2")),
         "I": fmt_uA(pts["2"]["I"] if pts.get("2") else None)},
    ]
    if pts.get("3") is not None and pts.get("4") is not None:
        rows.extend([
            {"punkt": "3", "znaczenie": "minimum analitu",
             "E": fmt_v(r.get("E3")), "I": fmt_uA(pts["3"]["I"])},
            {"punkt": "4", "znaczenie": "maksimum analitu",
             "E": fmt_v(r.get("E4")), "I": fmt_uA(pts["4"]["I"])},
        ])
    else:
        rows.extend([
            {"punkt": "3", "znaczenie": "minimum analitu", "E": "—", "I": "—"},
            {"punkt": "4", "znaczenie": "maksimum analitu", "E": "—", "I": "—"},
        ])
    rows.append({"punkt": "5", "znaczenie": "E5 TPrA+", "E": fmt_v(r.get("E5")), "I": ""})
    rows.append({"punkt": "6", "znaczenie": "E6 analit",  "E": fmt_v(r.get("E6")), "I": ""})

    if r.get("delta_Es") is None:
        print(f"\nPlik: {r['file_name']} | {r['status_pl']} | brak pełnej pary analitu")
    else:
        print(f"\nPlik: {r['file_name']} | {r['status_pl']} | "
              f"ΔE_s = {r['delta_Es']:.6f} V | błąd = {r['error_mV']:.2f} mV")

    if r.get("n_cycles_detected", 1) > 1:
        print(f"  → Wielocyklowy: {r['n_cycles_detected']} cykli, "
              f"analiza pierwszego ({r.get('n_points_used','?')} pkt z {r.get('n_points_total','?')})")

    show_warnings(r.get("warnings", []))

    try:
        display(pd.DataFrame(rows).style.hide(axis="index"))
    except Exception:
        display(pd.DataFrame(rows))

    outcome, title_color, _ = outcome_info(r)
    shift  = r.get("shift") or 0.0

    fig, ax = plt.subplots(figsize=(14, 7.6))
    style_cv_axes(fig, ax)
    plot_cv_branches(ax, E, I, shift=shift, calibrated=True)

    # Punkty 1–4: same numery (TPrA niebieskie, analit czerwone), biały obrys
    point_names = {"1": "1: TPrA−", "2": "2: TPrA+",
                   "3": "3: Analit−", "4": "4: Analit+"}
    point_handles = []
    for k in ["1", "2", "3", "4"]:
        p = pts.get(k)
        if p is None:
            continue
        px = p["E"] + shift
        py = p["I"] * 1e6
        ax.text(px, py, k, color=POINT_COLORS[k], fontsize=15, fontweight="bold",
                ha="center", va="center", zorder=7,
                path_effects=[pe.withStroke(linewidth=3.5, foreground="white")])
        point_handles.append(Line2D([0], [0], marker="o", linestyle="none",
                                    markersize=9, markerfacecolor=POINT_COLORS[k],
                                    markeredgecolor="white", label=point_names[k]))

    # Linie środków: E5 niebieska (TPrA), E6 czerwona (analit)
    for k, short, full in [("5", "E5", "E5 (TPrA)"), ("6", "E6", "E6 (analit)")]:
        p = pts.get(k)
        if p is None or p.get("E") is None:
            continue
        ax.axvline(p["E"], color=POINT_COLORS[k], ls="--", lw=2.0, label=full)
        ax.text(p["E"], np.nanmax(I * 1e6), short,
                color=POINT_COLORS[k], fontweight="bold", fontsize=12,
                ha="center", va="bottom", zorder=7,
                path_effects=[pe.withStroke(linewidth=3.0, foreground="white")])

    # ΔE_s — strzałka i opis czarne
    if r.get("delta_Es") is not None and pts.get("5") and pts.get("6"):
        y_arrow = np.nanpercentile(I * 1e6, 88)
        ax.annotate("", xy=(r["E6"], y_arrow), xytext=(r["E5"], y_arrow),
                    arrowprops={"arrowstyle": "<->", "color": "#111111", "lw": 1.8})
        ax.text((r["E5"] + r["E6"]) / 2, y_arrow,
                f" ΔE_s = {r['delta_Es']:.3f} V",
                color="#111111", weight="bold", ha="center", va="bottom",
                bbox=dict(boxstyle="round,pad=0.3", facecolor="white",
                          edgecolor="#111111", alpha=0.95))

    finish_cv_plot(fig, ax, r["file_name"], outcome, title_color,
                   ncol=4, extra_handles=point_handles)
    plt.show()

# ─── Eksport CSV ──────────────────────────────────────────────────────────────

def result_row(r):
    outcome, _, icon = outcome_info(r)
    keys = [
        "file_name", "mode", "status", "status_pl", "binary_result", "review_required",
        "E_column", "n_points_total", "n_points_used", "n_cycles_detected",
        "E1_raw", "E2_raw", "E3_raw", "E4_raw",
        "E1", "E2", "E3", "E4", "E5", "E6",
        "delta_Es", "error_mV", "shift",
        "amplitude_TPrA_uA", "amplitude_analyte_uA",
        "n_candidates_fwd", "n_candidates_bwd",
        "detection_signal", "I_column",
    ]
    row = {k: r.get(k) for k in keys}
    row["result"]       = outcome
    row["result_icon"]  = icon
    row["warning_codes"] = "; ".join(w["code"] for w in r.get("warnings", []))
    for k in ["E1_raw", "E2_raw", "E3_raw", "E4_raw",
              "E1", "E2", "E3", "E4", "E5", "E6",
              "delta_Es", "error_mV", "shift"]:
        if row.get(k) is not None:
            row[k] = round(float(row[k]), 6)
    return row

def save_summary_csv(path="ities_wyniki_zbiorcze.csv", download=True):
    if not RESULTS:
        print("Brak wyników w tej sesji.")
        return None
    df = pd.DataFrame([result_row(r) for r in RESULTS.values()])
    df.to_csv(path, index=False)
    print(f"Zapisano zbiorczy CSV: {path}")
    display(df)
    if download and files is not None:
        files.download(path)
    return path

# ─── Główna funkcja analizy ───────────────────────────────────────────────────

def _finalize(result, E=None, I=None):
    """Zapis do RESULTS, narysowanie wyniku i zwrot — wspólne zakończenie analyze()."""
    RESULTS[result["file_name"]] = result
    show_result(E, I, result)
    return result

def analyze(file_name, content, manual=None):
    # 1. Parsowanie pliku
    try:
        E_orig, I_orig, e_col, i_col = parse_file(content)
    except ValueError as exc:
        msg    = str(exc)
        result = build_invalid_result(file_name, msg)
        if "mało punktów" in msg:
            result["status"]    = "too_few_points"
            result["status_pl"] = "ZA MAŁO PUNKTÓW"
        return _finalize(result)

    n_pts_total = len(E_orig)

    # 2. Bugfix #1 — detekcja i wycięcie pierwszego cyklu
    E, I, n_cycles = detect_cycles_and_get_first(E_orig, I_orig)
    n_pts_used     = len(E)
    warnings       = []
    if n_cycles > 1:
        warnings.append({
            "code": "multiple_cycles_detected", "severity": "low",
            "message": (f"Wykryto {n_cycles} cykli CV. "
                        f"Analiza pierwszego cyklu ({n_pts_used} pkt z {n_pts_total}).")
        })

    # 3. Podział na gałęzie
    try:
        upper, lower = split_cv(E)
    except ValueError as exc:
        result = build_invalid_result(file_name, str(exc), E, I, e_col, i_col)
        return _finalize(result, E, I)

    # 4. Tryb ręczny
    if manual:
        fwd_c = branch_peaks(E, I, upper, "max")
        bwd_c = branch_peaks(E, I, lower, "min")
        p1 = nearest_on_branch(E, I, manual["E1"], lower, "min")
        p2 = nearest_on_branch(E, I, manual["E2"], upper, "max")
        p3 = nearest_on_branch(E, I, manual["E3"], lower, "min")
        p4 = nearest_on_branch(E, I, manual["E4"], upper, "max")
        result = build_result(
            file_name, E, I, p1, p2, p3, p4, "manual", warnings,
            e_col, i_col, n_cycles, n_pts_total, n_pts_used,
            len(fwd_c), len(bwd_c),
        )
        return _finalize(result, E, I)

    # 5. Kandydaci pików
    fwd_cands = branch_peaks(E, I, upper, "max")
    bwd_cands = branch_peaks(E, I, lower, "min")
    n_fwd     = len(fwd_cands)
    n_bwd     = len(bwd_cands)

    def _mqfail(reason):
        r = build_measurement_quality_fail(
            file_name, reason, warnings, E, I, e_col, i_col,
            n_cycles, n_pts_total, n_pts_used, n_fwd, n_bwd,
        )
        return _finalize(r, E, I)

    if not fwd_cands or not bwd_cands:
        return _mqfail("NO_CANDIDATES")

    # 6. Bugfix #2 — windowed TPrA selection
    t_pos = [c for c in fwd_cands if WIN_TPRA_POS_RAW[0] <= c["E"] <= WIN_TPRA_POS_RAW[1]]
    t_neg = [c for c in bwd_cands if WIN_TPRA_NEG_RAW[0] <= c["E"] <= WIN_TPRA_NEG_RAW[1]]

    if not t_pos or not t_neg:
        return _mqfail("NO_TPRA_IN_WINDOWS")

    # 7. Najlepsza para TPrA (sanity: shift, E2>E1)
    best_tpra = None
    best_pr   = -1.0
    for cpos in t_pos:
        for cneg in t_neg:
            E2r = cpos["E"]
            E1r = cneg["E"]
            sh  = TPRA_TARGET_V - (E1r + E2r) / 2
            if not (SHIFT_MIN <= sh <= SHIFT_MAX) or E2r <= E1r:
                continue
            pr = cpos["prom"] + cneg["prom"]
            if pr > best_pr:
                best_pr   = pr
                best_tpra = (cpos, cneg, sh)

    if best_tpra is None:
        return _mqfail("NO_VALID_TPRA_PAIR")

    p2, p1, shift = best_tpra
    E2_raw        = p2["E"]
    E1_raw        = p1["E"]

    if abs(shift - (-0.42)) > 0.10:
        warnings.append({"code": "unusual_shift", "severity": "low",
                         "message": f"Nietypowy shift {shift:+.3f} V (typowo ok. −0.42 V)"})

    # 8. Bugfix #3 — kandydaci analitu z asercją E4_cal > E3_cal
    a_pos = [c for c in fwd_cands
             if c["E"] >= E2_raw + ANALYTE_MIN_OFFSET and c["idx"] != p2["idx"]]
    a_neg = [c for c in bwd_cands
             if c["E"] >= E1_raw + ANALYTE_MIN_OFFSET and c["idx"] != p1["idx"]]

    if not a_pos or not a_neg:
        result = _build_partial_result(
            file_name, "auto", "TPrA_ONLY", "BRAK (tylko TPrA)",
            "no_analyte_pair",
            "TPrA wykryty, brak kandydatów analitu w wymaganym zakresie potencjału.",
            p1, p2, shift, warnings, e_col, i_col, n_cycles,
            n_pts_total, n_pts_used, n_fwd, n_bwd,
        )
        return _finalize(result, E, I)

    # 9. Najlepsza para analitu (sanity: E4_cal > E3_cal)
    E6_expected = TPRA_TARGET_V + AMPHETAMINE_TARGET_DELTA_V   # = 0.259 V
    best_p3 = best_p4 = None
    best_score = float("inf")
    for c4 in a_pos:
        for c3 in a_neg:
            E4c = c4["E"] + shift
            E3c = c3["E"] + shift
            if E4c <= E3c:          # analit+ musi być na prawo od analit−
                continue
            score = abs((E3c + E4c) / 2 - E6_expected)
            if score < best_score:
                best_score = score
                best_p3 = c3
                best_p4 = c4

    if best_p3 is None:
        result = _build_partial_result(
            file_name, "auto", "NO_VALID_ANALYTE_PAIR", "BRAK (sanity)",
            "analyte_pair_violates_sanity",
            "Kandydaci analitu istnieją, ale żadna para nie spełnia E4 > E3.",
            p1, p2, shift, warnings, e_col, i_col, n_cycles,
            n_pts_total, n_pts_used, n_fwd, n_bwd,
        )
        return _finalize(result, E, I)

    # 10. Pełny wynik
    result = build_result(
        file_name, E, I, p1, p2, best_p3, best_p4, "auto", warnings,
        e_col, i_col, n_cycles, n_pts_total, n_pts_used, n_fwd, n_bwd,
    )
    return _finalize(result, E, I)

# ─── Upload i uruchomienie ────────────────────────────────────────────────────

print("Wybierz jeden albo kilka plików TXT/CSV z pomiarami.")
if files is None:
    raise RuntimeError("Ten notebook jest przygotowany do uruchomienia w Google Colab.")
uploaded = files.upload()

for name, content in uploaded.items():
    key, note = unique_upload_key(name, content)
    if note:
        print(note)
    if key is None:
        continue
    FILE_STORE[key] = content
    try:
        analyze(key, content)
    except Exception as exc:
        result = build_invalid_result(key, str(exc))
        RESULTS[key] = result
        show_invalid_result(result)

print(f"\nGotowe. Liczba wyników w sesji: {len(RESULTS)}")
'''


MANUAL_CELL = r'''
# Ręczna korekta

# RĘCZNA KOREKTA DLA KONKRETNEGO PLIKU
#
# Kiedy używać:
# - jeśli punkty na wykresie są źle dobrane,
# - jeśli profesor chce ręcznie wskazać E1, E2, E3, E4.
#
# Co wpisać:
# 1. MANUAL_FILE_NAME = dokładna nazwa pliku z uploadu
# 2. MANUAL_E1 = potencjał punktu 1, minimum TPrA+ z dolnej gałęzi
# 3. MANUAL_E2 = potencjał punktu 2, maksimum TPrA+ z górnej gałęzi
# 4. MANUAL_E3 = potencjał punktu 3, minimum analitu z dolnej gałęzi
# 5. MANUAL_E4 = potencjał punktu 4, maksimum analitu z górnej gałęzi
# 6. Ustaw USE_MANUAL = True i uruchom komórkę.

USE_MANUAL       = False
MANUAL_FILE_NAME = ""   # np. "73-3_300ul_20ul_TPrA.txt"
MANUAL_E1        = None
MANUAL_E2        = None
MANUAL_E3        = None
MANUAL_E4        = None

if USE_MANUAL:
    if MANUAL_FILE_NAME not in FILE_STORE:
        raise ValueError("Nie ma takiego pliku w tej sesji. Sprawdź nazwę w wynikach uploadu.")
    values = [MANUAL_E1, MANUAL_E2, MANUAL_E3, MANUAL_E4]
    if any(v is None for v in values):
        raise ValueError("Uzupełnij MANUAL_E1, MANUAL_E2, MANUAL_E3 i MANUAL_E4.")
    analyze(
        MANUAL_FILE_NAME,
        FILE_STORE[MANUAL_FILE_NAME],
        manual={"E1": float(MANUAL_E1), "E2": float(MANUAL_E2),
                "E3": float(MANUAL_E3), "E4": float(MANUAL_E4)},
    )
    print("Ręczna korekta zapisana w wynikach sesji. Pobierz ponownie zbiorczy CSV.")
else:
    print("Tryb ręczny wyłączony. Ustaw USE_MANUAL = True po wpisaniu danych.")
'''


DOWNLOAD_CELL = r'''
# Pobierz zbiorczy CSV

# POBRANIE JEDNEGO ZBIORCZEGO CSV DLA WSZYSTKICH PLIKÓW Z TEJ SESJI
save_summary_csv("ities_wyniki_zbiorcze.csv", download=True)
'''


DOC_CELL = """## Dokumentacja techniczna

### 1. Struktura logiczna

Potok: **stałe → parser → podział CV → detekcja pików → decyzja → budowa wyniku → wyświetlanie**. Spina to funkcja `analyze()`:

1. `parse_file` — wczytanie TXT/CSV, auto-rozpoznanie separatora, przecinka dziesiętnego i kolumn E/I.
2. `detect_cycles_and_get_first` — pomiar wielocyklowy → analiza tylko pierwszego cyklu.
3. `split_cv` — rozcięcie krzywej w wierzchołku potencjału na **forward sweep** (prądy +) i **reverse sweep** (prądy −).
4. `branch_peaks` — kandydaci ekstremów prądu na każdej gałęzi.
5. selekcja TPrA — para wzorca z okien potencjału.
6. selekcja analitu — para amfetaminy na prawo od TPrA, z asercją E4 > E3.
7. `decision` — klasyfikacja ΔE_s.
8. budowa wyniku + wyświetlanie — tabela, wykres dwukolorowy, ostrzeżenia.

### 2. Matematyka

Punkty (notatka profesora): nieparzyste = sygnały ujemne (reverse sweep), parzyste = dodatnie (forward sweep).
`1` TPrA−, `2` TPrA+, `3` analit−, `4` analit+.

```
E5 = (E1 + E2) / 2     środek pary TPrA
E6 = (E3 + E4) / 2     środek pary analitu
delta_Es = E6 − E5     parametr identyfikacyjny
```

**Kalibracja termodynamiczna.** Oś potencjału dryfuje między pomiarami — wartości bezwzględne są niewiarygodne. Środek TPrA wymuszamy do stałej termodynamicznej (potencjał przejścia TPrA+ woda→organika):

```
shift = −0.091 − E5_surowe
E_skalibrowane = E_surowe + shift
```

Po kalibracji E5 = −0.091 V zawsze; ΔE_s jest niezmiennikiem niezależnym od dryfu osi.

**Uśrednianie par = kompensacja szerokości piku.** Piki amfetaminy bywają szerokie i rozmyte; średnia piku dodatniego i ujemnego daje stabilny potencjał formalny.

### 3. Decyzja — progi profesora

```
|delta_Es − 0.350| ≤ 10 mV  →  WYKRYTO    (wynik binarny 1)
                  10–15 mV  →  NIEPEWNE   (0, wymaga kontroli)
                     >15 mV →  BRAK       (0)
```

**`błąd` (`error_mV`)** = |ΔE_s − 0.350| w mV — odległość zmierzonego ΔE_s od wzorcowego profilu amfetaminy. To NIE jest błąd pomiaru ani usterka algorytmu; im mniejszy, tym lepsze dopasowanie. Wartość niezerowa ma trzy naturalne źródła: realny rozrzut chemiczny (amfetamina daje 0.343–0.358 V), dyskretne próbkowanie potencjału (krok ≈ 2.4 mV) oraz zmienność aparatury. Przykład: błąd 1.56 mV = trafienie niemal idealne.

### 4. Biblioteki Python

| Biblioteka | Rola |
|---|---|
| `numpy` | wektory E/I, operacje numeryczne |
| `pandas` | parser TXT/CSV, tabela wyników, eksport CSV |
| `scipy.signal.find_peaks` | detekcja ekstremów prądu — rdzeń (nie piszemy własnego detektora) |
| `scipy.signal.peak_widths` | szerokość piku — odrzucanie zbyt szerokich artefaktów |
| `scipy.signal.savgol_filter` | wygładzanie Savitzky-Golay przed detekcją |
| `matplotlib` | woltamperogram dwukolorowy z punktami 1–6 |

### 5. Triki i zasady

- **Okna potencjału zamiast globalnej prominencji.** TPrA wybierany w oknach surowego E (TPrA+ 0.20–0.45 V, TPrA− 0.05–0.35 V). Globalnie najmocniejszy pik bywa artefaktem — okno go eliminuje.
- **Stały próg prominencji (0.15 µA — próg szumu aparaturowego).** NIE skalowany do amplitudy gałęzi: silny pik TPrA zawyżałby próg i gubił słabe, ale realne piki analitu (typowo 0.2–1.4 µA).
- **Savitzky-Golay** (okno ≈ 15 punktów, wielomian 3. stopnia, `mode="interp"`) — tłumi szum zachowując kształt i wysokość piku, lepiej niż średnia ruchoma.
- **Pierwszy cykl** — pomiar wielocyklowy daje fałszywe pary z mieszanych cykli; analizujemy tylko pierwszy.
- **Asercje sanity** — shift w zakresie −0.65…−0.20 V, E2 > E1, E4 > E3 (analit nie może leżeć fizycznie na lewo od wzorca).
- **Status `MEASUREMENT_QUALITY_FAIL`** — brak TPrA w oknach = zakłócenie aparaturowe; pomiar do powtórzenia, nie błąd algorytmu.

### 6. Problemy → rozwiązania (wykryte empirycznie na plikach laboratoryjnych)

| Problem | Objaw | Rozwiązanie |
|---|---|---|
| Pomiar wielocyklowy | piki mieszane z kilku cykli | wykrycie cykli, analiza pierwszego |
| Globalna prominencja | artefakt wybrany jako TPrA → fałszywy `TPrA_ONLY` | okna potencjału + sanity shift |
| Para analitu E3 > E4 | fizycznie niemożliwa para wygrywała | wymuszenie E4 > E3 |
| Próg prominencji skalowany amplitudą | mocny pik zawyżał próg → gubione słabe piki | stały próg szumu 0.15 µA |

### 7. Deduplikacja uploadów

`unique_upload_key` porównuje **zawartość bajt po bajcie** każdego nowego pliku z już wgranymi:

- identyczna zawartość → plik pominięty (także przy innej nazwie),
- ta sama nazwa, inna zawartość → zapis jako `nazwa__2.txt`.

Zbiorczy eksport CSV obejmuje wyłącznie unikalne pomiary — duplikat nie trafia do pobrania. Porównanie pełnej zawartości jest ściślejsze niż nazwa + rozmiar.

### 8. Zgodność z założeniami profesora

Wzory E5/E6/ΔE_s, kalibracja do −0.091 V, podział na forward/reverse sweep, detekcja binarna 0/1 oraz kompensacja szerokości piku — zaimplementowane 1:1. Dwa świadome odstępstwa:

- **Tolerancja** — pierwotnie ±1%; przyjęto progi 10/15 mV (zatwierdzone, poparte empirycznym rozrzutem ΔE_s 0.343–0.358 V).
- **Okna TPrA** — profesor odradzał sztywne okna; użyto szerokich okien wyłącznie do wstępnej selekcji wzorca, a kalibrację nadal wykonuje przesunięcie termodynamiczne.

### 9. Pochodzenie metody wygładzania

Filtr Savitzky-Golay — wg dokumentacji MathWorks (`sgolay`): dopasowanie wielomianu niskiego stopnia metodą najmniejszych kwadratów w przesuwnym oknie, wartość środkowa zastępowana wartością wielomianu. Przeniesiony na Python jako `scipy.signal.savgol_filter` (okno nieparzyste, wielomian 3. stopnia, `mode="interp"` dla brzegów).
"""


cells = [
    md(INTRO, ["intro"]),
    code(RUN_CELL, ["run"]),
    code(MANUAL_CELL, ["manual"]),
    code(DOWNLOAD_CELL, ["download"]),
    md(DOC_CELL, ["docs"]),
]


def build_notebook() -> Path:
    if NOTEBOOK_PATH.exists():
        existing = json.loads(NOTEBOOK_PATH.read_text(encoding="utf-8"))
        run_cell = next(
            (
                cell
                for cell in existing.get("cells", [])
                if "run" in cell.get("metadata", {}).get("tags", [])
            ),
            None,
        )
        if run_cell is None:
            run_cell = next(
                (
                    cell
                    for cell in existing.get("cells", [])
                    if "def analyze" in "".join(cell.get("source", []))
                ),
                None,
            )
        existing_run = "".join(run_cell.get("source", [])) if run_cell else None
        generated_run = dedent(RUN_CELL).strip() + "\n"
        if existing_run != generated_run:
            raise SystemExit(
                "RUN_CELL w generatorze rozjechal sie z ITIES_Detect_Colab_MVP.ipynb. "
                "NIE nadpisuje. Zrodlem prawdy jest notebook."
            )

    notebook = {
        "cells": cells,
        "metadata": {
            "colab": {"provenance": []},
            "kernelspec": {"display_name": "Python 3", "name": "python3"},
            "language_info": {"name": "python", "version": "3.x"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    output_path = ROOT / f"ITIES_Detect_Colab_MVP_{date.today():%Y%m%d}.ipynb"
    output_path.write_text(
        json.dumps(notebook, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def fmt_decimal_comma(value: float, scientific: bool = False) -> str:
    text = f"{value:.12E}" if scientific else f"{value:.9f}"
    return text.replace(".", ",")


def build_sample() -> None:
    """
    Generuje syntetyczny plik CSV z realistycznymi surowymi wartościami E (0.10–0.90 V),
    odpowiadającymi typowym plikom laboratoryjnym.

    Piki:
      TPrA+  (E2_raw ≈ 0.362 V, forward)  →  I ≈ +18 µA
      TPrA−  (E1_raw ≈ 0.280 V, backward) →  I ≈ −15 µA
      Analit+ (E4_raw ≈ 0.712 V, forward)  →  I ≈ +13 µA
      Analit− (E3_raw ≈ 0.630 V, backward) →  I ≈ −10 µA

    Weryfikacja:
      E5_raw = (0.280 + 0.362) / 2 = 0.321 V
      shift  = −0.091 − 0.321     = −0.412 V
      E6_raw = (0.630 + 0.712) / 2 = 0.671 V
      E6_cal = 0.671 − 0.412       = 0.259 V
      ΔE_s   = 0.259 − (−0.091)   = 0.350 V  ✓
    """
    SAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = ["E;I"]
    # Gałąź forward: E rośnie od 0.100 do 0.900 V (401 punktów)
    for idx in range(401):
        e = 0.100 + idx * 0.002
        i = 4.0e-6 + 0.25e-6 * math.sin(12 * e)
        i += 14e-6 * math.exp(-((e - 0.362) ** 2) / (2 * 0.016 ** 2))   # TPrA+
        i += 9e-6  * math.exp(-((e - 0.712) ** 2) / (2 * 0.018 ** 2))   # Analit+
        rows.append(f"{fmt_decimal_comma(e)};{fmt_decimal_comma(i, scientific=True)}")
    # Gałąź backward: E maleje od 0.900 do 0.100 V (401 punktów)
    for idx in range(401):
        e = 0.900 - idx * 0.002
        i = -4.0e-6 + 0.20e-6 * math.sin(11 * e)
        i -= 11e-6 * math.exp(-((e - 0.280) ** 2) / (2 * 0.014 ** 2))   # TPrA−
        i -= 6e-6  * math.exp(-((e - 0.630) ** 2) / (2 * 0.018 ** 2))   # Analit−
        rows.append(f"{fmt_decimal_comma(e)};{fmt_decimal_comma(i, scientific=True)}")
    SAMPLE_PATH.write_text("\n".join(rows) + "\n", encoding="utf-8")


if __name__ == "__main__":
    notebook_path = build_notebook()
    build_sample()
    print(f"Zapisano {notebook_path.relative_to(ROOT)}")
    print(f"Zapisano {SAMPLE_PATH.relative_to(ROOT)}")
