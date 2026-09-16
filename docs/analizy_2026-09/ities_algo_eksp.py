"""ities_algo_eksp.py: eksperymentalny wariant algorytmu ITIES sterowany flagami (16.09.2026).

Importuje zamrozony `ities_algo_base` (1:1 z notebooka) i NIE modyfikuje go. Nadpisane sa tylko
`branch_peaks` (parametr prominencji, filtr krawedzi, kandydaci krawedziowi) i `analyze`
(kroki 5-10 z hakami). `decision` zostaje bazowa (tolerancje 10/15 mV); B2 dziala po decyzji.

Przy WSZYSTKICH flagach wylaczonych wynik musi byc identyczny z baza (test: parytet_eksp.py).

Flagi (slownik FLAGI, zmieniane przez ustaw_flagi(**kw) albo argumentem `flagi=` w analyze):

  PROJEKT A (detekcja kandydatow)
  A1  odzysk TPrA- ze strefy krawedziowej konca galezi powrotnej (poczatek skanu)
      A1_REQUIRE_FALLBACK  tylko gdy w oknie WIN_TPRA_NEG_RAW nie ma regularnego kandydata
      A1_MIN_FROM_EMIN_V   kandydat >= tyle nad E_min skanu (klaster punktu zawrotu ma 0-10 mV)
      A1_MIN_TAIL_PTS      co najmniej tyle punktow za kandydatem (punkt zawrotu ma 6-7)
  A2  oslona okna rozpuszczalnika: analit+ >= A2_GUARD_EMAX_V pod E_max, analit- i TPrA- >=
      A2_GUARD_EMIN_V nad E_min, prad surowy za pikiem spada o >= A2_RAW_TURN_FRAC * prominencji
  A3  osobne prominencje: A3_TPRA_PROMINENCE_A dla kandydatow TPrA, A3_ANALYTE_PROMINENCE_A
      dla kandydatow analitu (None = PEAK_PROMINENCE_A bazy)
  A4  sanity rozstawu pary: E2-E1 i E4-E3 <= A4_MAX_PAIR_SEP_V (artefakty krawedziowe 279-620 mV)

  PROJEKT B (wybor pary i decyzja)
  B1  fizyczne okno separacji: SEP_T_MIN <= E2-E1 <= SEP_T_MAX, SEP_A_MIN <= E4-E3 <= SEP_A_MAX;
      para spoza okna odpada PRZED wyborem
  B2  wybor pary: B2_PAIR_MODE 'target' (baza), 'prom' (najprominentniejsza), 'hybrid'
      (najprominentniejsza w pasmie +-15 mV, inaczej jak target); B2_AMBIG_MV > 0: WYKRYTO z druga
      para blizej niz tyle mV od najlepszej -> NIEPEWNE (kod b2_ambiguous_pair)
  B3  prog prominencji = clip(B3_K * szum galezi, B3_FLOOR_A, B3_CAP_A); szum wg B3_NOISE
      ('savgol_resid', 'flat_fit', 'mad_diff'); gdy wlaczone, zastepuje prog staly i A3

  DIAGNOSTYKA (domyslnie = baza)
  EDGE_FRAC, EDGE_MIN_PTS  filtr krawedzi (baza 0.08 / 12); PROM_A  globalna prominencja (None = baza)
"""
import os
import sys

import numpy as np
from scipy.signal import find_peaks, peak_widths

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ities_algo_base as base  # noqa: E402

FLAGI_DOMYSLNE = {
    "A1": False, "A1_REQUIRE_FALLBACK": True, "A1_MIN_FROM_EMIN_V": 0.015, "A1_MIN_TAIL_PTS": 10,
    "A2": False, "A2_GUARD_EMAX_V": 0.060, "A2_GUARD_EMIN_V": 0.015, "A2_RAW_TURN_FRAC": 0.5,
    "A3": False, "A3_TPRA_PROMINENCE_A": 1.0e-7, "A3_ANALYTE_PROMINENCE_A": 1.0e-7,
    "A4": False, "A4_MAX_PAIR_SEP_V": 0.25,
    "B1": False, "SEP_A_MIN": 0.015, "SEP_A_MAX": 0.200, "SEP_T_MIN": 0.030, "SEP_T_MAX": 0.230,
    "B2": False, "B2_PAIR_MODE": "prom", "B2_AMBIG_MV": 10.0,
    "B3": False, "B3_K": 5.0, "B3_NOISE": "savgol_resid", "B3_FLOOR_A": 1.0e-7, "B3_CAP_A": None,
    "EDGE_FRAC": 0.08, "EDGE_MIN_PTS": 12, "PROM_A": None,
}
FLAGI = dict(FLAGI_DOMYSLNE)

_DIAG_KEYS = ("in_edge", "from_end", "raw_drop", "rescued_edge")


def ustaw_flagi(**kw):
    """Ustawia flagi globalne. Nieznany klucz = blad. Zwraca kopie aktualnych flag."""
    for k, v in kw.items():
        if k not in FLAGI_DOMYSLNE:
            raise KeyError(f"Nieznana flaga: {k}")
        FLAGI[k] = v
    return dict(FLAGI)


def resetuj_flagi():
    FLAGI.clear()
    FLAGI.update(FLAGI_DOMYSLNE)
    return dict(FLAGI)


def flagi_z_napisu(spec):
    """'A1;A3;B2' -> {'A1': True, 'A3': True, 'B2': True}; 'B1;SEP_A_MIN=0.030' tez dziala.
    Separator to ';' (albo ',' gdy nie ma srednika)."""
    import ast
    out = {}
    sep = ";" if ";" in spec else ","
    for tok in (t.strip() for t in spec.split(sep) if t.strip()):
        if "=" in tok:
            k, v = tok.split("=", 1)
            try:
                out[k] = ast.literal_eval(v)
            except Exception:
                out[k] = v
        else:
            out[tok] = True
    return out


# ─── Szum galezi (B3) ─────────────────────────────────────────────────────────

def branch_noise(E, I, idx, kind, edge_frac=0.08, edge_min=12):
    """Trzy estymatory szumu galezi (1:1 z variant_b.branch_noise):
    flat_fit      SD reszt fitu liniowego surowego pradu na najplaskszym odcinku 80 mV
    savgol_resid  SD (surowy - savgol) we wnetrzu galezi
    mad_diff      1.4826*MAD(diff)/sqrt(2) we wnetrzu galezi"""
    raw = I[idx] if kind == "max" else -I[idx]
    Eb = E[idx]
    y = base.smooth_signal(raw)
    n = len(y)
    edge = max(int(edge_min), int(n * edge_frac))
    out = {"flat_fit": float("nan"), "savgol_resid": float("nan"), "mad_diff": float("nan")}
    seg = base._flattest_segment(Eb, y, edge, n - edge) if n > 2 * edge + base.BASELINE_MIN_PTS + 4 else None
    if seg is not None:
        j, hi = seg
        sl = slice(j, hi + 1)
        if hi - j + 1 >= base.BASELINE_MIN_PTS:
            a, b = np.polyfit(Eb[sl], raw[sl], 1)
            out["flat_fit"] = float(np.std(raw[sl] - (a * Eb[sl] + b), ddof=2))
    inner = slice(edge, n - edge) if n > 2 * edge + 3 else slice(0, n)
    r = raw[inner] - y[inner]
    if len(r) >= 4:
        out["savgol_resid"] = float(np.std(r, ddof=1))
    d = np.diff(raw[inner])
    if len(d) >= 4:
        out["mad_diff"] = float(1.4826 * np.median(np.abs(d - np.median(d))) / np.sqrt(2))
    return out


def _prog_b3(F, fixed, noise):
    if not F["B3"] or not np.isfinite(noise):
        return fixed
    t = F["B3_K"] * noise
    if F["B3_FLOOR_A"] is not None:
        t = max(t, F["B3_FLOOR_A"])
    if F["B3_CAP_A"] is not None:
        t = min(t, F["B3_CAP_A"])
    return float(t)


# ─── Kandydaci pikow (nadpisane branch_peaks) ─────────────────────────────────

def branch_peaks(E, I, idx, kind, prominence=None, keep_edge=False, edge_frac=0.08, edge_min=12):
    """Kopia base.branch_peaks z parametrem prominencji, parametryzowanym filtrem krawedzi
    i opcja zwracania kandydatow ze strefy krawedziowej (in_edge/from_end/raw_drop).
    Przy prominence=None, keep_edge=False, edge 0.08/12 wynik jest identyczny z baza
    (poza polami diagnostycznymi, ktore analyze() usuwa przed build_result)."""
    prominence = base.PEAK_PROMINENCE_A if prominence is None else prominence
    raw = I[idx] if kind == "max" else -I[idx]
    y = base.smooth_signal(raw)
    branch = "pierwsza_gorna" if kind == "max" else "powrotna_dolna"
    n = len(idx)
    edge = max(int(edge_min), int(n * edge_frac))
    distance = max(base.PEAK_DISTANCE_POINTS, n // 35)
    peaks, props = find_peaks(y, prominence=prominence, distance=distance)
    if len(peaks) == 0:
        return []
    widths = peak_widths(y, peaks, rel_height=0.5)[0]
    rows = []
    for p, prom, width in zip(peaks, props["prominences"], widths):
        in_edge = "start" if p < edge else ("end" if p > n - edge else "")
        if in_edge and not keep_edge:
            continue
        if width > n * base.MAX_PEAK_WIDTH_FRACTION:
            continue
        radius = max(3, min(18, int(width // 2) + 3))
        lo = max(0, p - radius)
        hi = min(n, p + radius + 1)
        local = np.argmax(raw[lo:hi]) + lo
        gi = int(idx[local])
        tail = raw[local + 1:]
        raw_drop = float(raw[local] - tail.min()) if len(tail) else 0.0
        rows.append({
            "idx": gi, "E": float(E[gi]), "I": float(I[gi]),
            "prom": float(prom), "width": float(width),
            "kind": kind, "branch": branch, "shape": "peak",
            "in_edge": in_edge, "from_end": int(n - 1 - local), "raw_drop": raw_drop,
        })
    rows = sorted(rows, key=lambda r: r["prom"], reverse=True)
    return rows[:10]


def _strip(c):
    """Usun pola diagnostyczne, zeby build_result dostal dokladnie to co w bazie."""
    return {k: v for k, v in c.items() if k not in _DIAG_KEYS}


decision = base.decision


# ─── analyze (kroki 5-10 z hakami) ─────────────────────────────────────────────

def analyze(file_name, content, manual=None, flagi=None):
    F = dict(FLAGI)
    if flagi:
        for k in flagi:
            if k not in FLAGI_DOMYSLNE:
                raise KeyError(f"Nieznana flaga: {k}")
        F.update(flagi)
    if manual:
        return base.analyze(file_name, content, manual)

    diag = {}

    # 1. Parsowanie
    try:
        E_orig, I_orig, e_col, i_col = base.parse_file(content)
    except ValueError as exc:
        msg = str(exc)
        result = base.build_invalid_result(file_name, msg)
        if "mało punktów" in msg:
            result["status"] = "too_few_points"
            result["status_pl"] = "ZA MAŁO PUNKTÓW"
        return base._finalize(result)
    n_pts_total = len(E_orig)

    # 2. Cykle
    E, I, n_cycles, cycle_used = base.detect_cycles_and_select(E_orig, I_orig)
    n_pts_used = len(E)
    warnings = []
    if n_cycles > 1:
        warnings.append({
            "code": "multiple_cycles_detected", "severity": "low",
            "message": (f"Wykryto {n_cycles} cykli CV. Analiza cyklu {cycle_used} "
                        f"(ostatni pełny; pierwszy odrzucany — zalecenie prof. 20.07; "
                        f"{n_pts_used} pkt z {n_pts_total}).")
        })

    # 3. Galezie
    try:
        upper, lower = base.split_cv(E)
    except ValueError as exc:
        result = base.build_invalid_result(file_name, str(exc), E, I, e_col, i_col)
        return base._finalize(result, E, I)

    E_lo, E_hi = float(E.min()), float(E.max())
    ef, em = F["EDGE_FRAC"], F["EDGE_MIN_PTS"]
    fixed = base.PEAK_PROMINENCE_A if F["PROM_A"] is None else float(F["PROM_A"])
    if F["A3"]:
        prom_t = fixed if F["A3_TPRA_PROMINENCE_A"] is None else float(F["A3_TPRA_PROMINENCE_A"])
        prom_a = fixed if F["A3_ANALYTE_PROMINENCE_A"] is None else float(F["A3_ANALYTE_PROMINENCE_A"])
    else:
        prom_t = prom_a = fixed
    max_sep = F["A4_MAX_PAIR_SEP_V"] if F["A4"] else None

    # B3: prog wzgledem szumu galezi (zastepuje prog staly i A3)
    if F["B3"]:
        nzf = branch_noise(E, I, upper, "max", ef, em)
        nzb = branch_noise(E, I, lower, "min", ef, em)
        nf, nb = nzf[F["B3_NOISE"]], nzb[F["B3_NOISE"]]
        thr_f_t, thr_b_t = _prog_b3(F, prom_t, nf), _prog_b3(F, prom_t, nb)
        thr_f_a, thr_b_a = _prog_b3(F, prom_a, nf), _prog_b3(F, prom_a, nb)
        diag.update({"noise_fwd_A": nf, "noise_bwd_A": nb, "thr_fwd_A": thr_f_t, "thr_bwd_A": thr_b_t})
    else:
        thr_f_t = thr_b_t = prom_t
        thr_f_a = thr_b_a = prom_a
    diag.update({"prom_tpra_A": thr_f_t, "prom_analyte_A": thr_f_a})

    # 5. Kandydaci: lista TPrA i lista analitu (przy rownych progach jedna lista)
    fwd_t = branch_peaks(E, I, upper, "max", thr_f_t, False, ef, em)
    bwd_t = branch_peaks(E, I, lower, "min", thr_b_t, False, ef, em)
    if thr_f_a == thr_f_t and thr_b_a == thr_b_t:
        fwd_a, bwd_a = fwd_t, bwd_t
    else:
        fwd_a = branch_peaks(E, I, upper, "max", thr_f_a, False, ef, em)
        bwd_a = branch_peaks(E, I, lower, "min", thr_b_a, False, ef, em)
    n_fwd, n_bwd = len(fwd_t), len(bwd_t)
    diag.update({"n_fwd_t": n_fwd, "n_bwd_t": n_bwd, "n_fwd_a": len(fwd_a), "n_bwd_a": len(bwd_a)})

    def _mqfail(reason):
        r = base.build_measurement_quality_fail(
            file_name, reason, warnings, E, I, e_col, i_col,
            n_cycles, n_pts_total, n_pts_used, n_fwd, n_bwd, cycle_used)
        r["eksp"] = diag
        return base._finalize(r, E, I)

    if not fwd_t or not bwd_t:
        if not (F["A1"] and fwd_t):
            return _mqfail("NO_CANDIDATES")

    # 6. Okna TPrA
    t_pos = [c for c in fwd_t if base.WIN_TPRA_POS_RAW[0] <= c["E"] <= base.WIN_TPRA_POS_RAW[1]]
    t_neg = [c for c in bwd_t if base.WIN_TPRA_NEG_RAW[0] <= c["E"] <= base.WIN_TPRA_NEG_RAW[1]]

    # A2 (czesc TPrA-): TPrA- nie moze siedziec na krawedzi E_min
    if F["A2"]:
        t_neg = [c for c in t_neg if c["E"] - E_lo >= F["A2_GUARD_EMIN_V"]]

    # A1: odzysk TPrA- ze strefy krawedziowej konca galezi powrotnej (poczatek skanu)
    rescued = []
    if F["A1"] and (not t_neg or not F["A1_REQUIRE_FALLBACK"]):
        thr = thr_b_t
        for c in branch_peaks(E, I, lower, "min", thr_b_t, True, ef, em):
            if c["in_edge"] != "end":
                continue
            if not (base.WIN_TPRA_NEG_RAW[0] <= c["E"] <= base.WIN_TPRA_NEG_RAW[1]):
                continue
            if c["prom"] < thr or c["raw_drop"] < thr:
                continue                      # prad nie zawraca: nie jest lokalnym ekstremum
            if c["from_end"] < F["A1_MIN_TAIL_PTS"]:
                continue                      # punkt zawrotu skanu, nie pik
            if c["E"] - E_lo < F["A1_MIN_FROM_EMIN_V"]:
                continue                      # krawedz okna rozpuszczalnika
            c = dict(c)
            c["rescued_edge"] = True
            rescued.append(c)
        if rescued:
            t_neg = t_neg + rescued
            warnings.append({"code": "tpra_neg_edge_rescued", "severity": "medium",
                             "message": "TPrA- odzyskany ze strefy krawedziowej poczatku skanu (flaga A1)."})
    diag["a1_rescued"] = len(rescued)

    if not t_pos or not t_neg:
        return _mqfail("NO_TPRA_IN_WINDOWS")

    # 7. Najlepsza para TPrA (jak w bazie: suma prominencji) + A4 + B1
    best_tpra, best_pr = None, -1.0
    n_tpra_rej_sep = 0
    for cpos in t_pos:
        for cneg in t_neg:
            E2r, E1r = cpos["E"], cneg["E"]
            sh = base.TPRA_TARGET_V - (E1r + E2r) / 2
            if not (base.SHIFT_MIN <= sh <= base.SHIFT_MAX) or E2r <= E1r:
                continue
            if max_sep is not None and (E2r - E1r) > max_sep:
                n_tpra_rej_sep += 1
                continue
            if F["B1"] and not (F["SEP_T_MIN"] <= E2r - E1r <= F["SEP_T_MAX"]):
                n_tpra_rej_sep += 1
                continue
            pr = cpos["prom"] + cneg["prom"]
            if pr > best_pr:
                best_pr, best_tpra = pr, (cpos, cneg, sh)
    diag["n_tpra_rej_sep"] = n_tpra_rej_sep
    if best_tpra is None:
        return _mqfail("NO_VALID_TPRA_PAIR")
    p2, p1, shift = best_tpra
    E2_raw, E1_raw = p2["E"], p1["E"]
    diag.update({"sepT_V": E2_raw - E1_raw, "tpra_neg_rescued": bool(p1.get("rescued_edge"))})
    if abs(shift - (-0.42)) > 0.10:
        warnings.append({"code": "unusual_shift", "severity": "low",
                         "message": f"Nietypowy shift {shift:+.3f} V (typowo ok. −0.42 V)"})

    # 8. Kandydaci analitu (z listy analitu; odzyskany TPrA- nigdy nie trafia do analitu)
    a_pos = [c for c in fwd_a if c["E"] >= E2_raw + base.ANALYTE_MIN_OFFSET and c["idx"] != p2["idx"]]
    a_neg = [c for c in bwd_a if c["E"] >= E1_raw + base.ANALYTE_MIN_OFFSET and c["idx"] != p1["idx"]]

    # A2: oslona okna rozpuszczalnika dla analitu
    if F["A2"]:
        gx, gn, ft = F["A2_GUARD_EMAX_V"], F["A2_GUARD_EMIN_V"], F["A2_RAW_TURN_FRAC"]
        a_pos = [c for c in a_pos if E_hi - c["E"] >= gx and c["raw_drop"] >= ft * c["prom"]]
        a_neg = [c for c in a_neg if c["E"] - E_lo >= gn and c["raw_drop"] >= ft * c["prom"]]
    diag.update({"n_a_pos": len(a_pos), "n_a_neg": len(a_neg)})

    if not a_pos or not a_neg:
        r = base._build_partial_result(
            file_name, "auto", "TPrA_ONLY", "BRAK (tylko TPrA)", "no_analyte_pair",
            "TPrA wykryty, brak kandydatów analitu w wymaganym zakresie potencjału.",
            _strip(p1), _strip(p2), shift, warnings, e_col, i_col, n_cycles,
            n_pts_total, n_pts_used, n_fwd, n_bwd, cycle_used)
        r["eksp"] = diag
        return base._finalize(r, E, I)

    # 9. Pary analitu: lista (c3, c4, err, prom, sep) po filtrach A4 i B1; wybor wg B2
    E6_expected = base.TPRA_TARGET_V + base.AMPHETAMINE_TARGET_DELTA_V   # = 0.259 V
    pairs = []
    n_rej_sep = 0
    for c4 in a_pos:
        for c3 in a_neg:
            E4c, E3c = c4["E"] + shift, c3["E"] + shift
            if E4c <= E3c:          # analit+ musi byc na prawo od analit-
                continue
            sep = E4c - E3c
            if max_sep is not None and sep > max_sep:
                n_rej_sep += 1
                continue
            if F["B1"] and not (F["SEP_A_MIN"] <= sep <= F["SEP_A_MAX"]):
                n_rej_sep += 1
                continue
            err = abs((E3c + E4c) / 2 - E6_expected)
            pairs.append({"c3": c3, "c4": c4, "err": err, "prom": c3["prom"] + c4["prom"], "sep": sep})
    diag.update({"n_pairs": len(pairs), "n_pairs_rej_sep": n_rej_sep})

    if not pairs:
        r = base._build_partial_result(
            file_name, "auto", "NO_VALID_ANALYTE_PAIR", "BRAK (sanity)", "analyte_pair_violates_sanity",
            "Kandydaci analitu istnieją, ale żadna para nie spełnia E4 > E3"
            + (" ani okna separacji." if n_rej_sep else "."),
            _strip(p1), _strip(p2), shift, warnings, e_col, i_col, n_cycles,
            n_pts_total, n_pts_used, n_fwd, n_bwd, cycle_used)
        r["eksp"] = diag
        r["n_pairs_rejected_sep"] = n_rej_sep
        return base._finalize(r, E, I)

    # sorted jest stabilne, a kolejnosc petli (c4 zewn., c3 wewn.) jak w bazie, wiec przy remisie
    # err wygrywa ta sama para co w bazowym `if score < best_score`.
    by_target = sorted(pairs, key=lambda p: p["err"])
    mode = F["B2_PAIR_MODE"] if F["B2"] else "target"
    if mode == "target":
        best = by_target[0]
    elif mode == "prom":
        best = max(pairs, key=lambda p: p["prom"])
    elif mode == "hybrid":
        inband = [p for p in pairs if p["err"] <= base.UNCERTAIN_TOLERANCE_V + 1e-12]
        best = max(inband, key=lambda p: p["prom"]) if inband else by_target[0]
    else:
        raise ValueError(f"B2_PAIR_MODE: {mode}")
    others = [p for p in pairs if p is not best]
    second = min(others, key=lambda p: p["err"]) if others else None
    diag.update({"best_err_mV": best["err"] * 1e3, "sepA_V": best["sep"],
                 "prom3": best["c3"]["prom"], "prom4": best["c4"]["prom"],
                 "target_err_mV": by_target[0]["err"] * 1e3,
                 "second_err_mV": second["err"] * 1e3 if second else None,
                 "second_gap_mV": (second["err"] - best["err"]) * 1e3 if second else None})

    # 9b. Pik-smiec (audio 16.07): wiecej niz jedna para w pasmie NIEPEWNE wokol targetu
    close_pairs = set()
    for p in pairs:
        if p["err"] <= base.UNCERTAIN_TOLERANCE_V:
            close_pairs.add((round(p["c3"]["E"] + shift, 3), round(p["c4"]["E"] + shift, 3)))
    if len(close_pairs) > 1:
        warnings.append({
            "code": "ambiguous_analyte_pair", "severity": "medium",
            "message": (f"{len(close_pairs)} pary analitu w paśmie ±15 mV od targetu "
                        f"— możliwy pik-śmieć, wybór pary niejednoznaczny."),
        })

    # 10. Pelny wynik (decision bazowa w build_result)
    r = base.build_result(
        file_name, E, I, _strip(p1), _strip(p2), _strip(best["c3"]), _strip(best["c4"]), "auto", warnings,
        e_col, i_col, n_cycles, n_pts_total, n_pts_used, n_fwd, n_bwd, cycle_used)

    # B2: bramka niejednoznacznosci po decyzji
    if F["B2"] and F["B2_AMBIG_MV"] > 0 and r["status"] == "detected" and second is not None \
            and (second["err"] - best["err"]) * 1e3 < F["B2_AMBIG_MV"]:
        r["status"], r["status_pl"] = "uncertain", "NIEPEWNE"
        r["binary_result"], r["review_required"] = 0, True
        r["warnings"].append({"code": "b2_ambiguous_pair", "severity": "medium",
                              "message": (f"Druga para analitu {second['err']*1e3:.1f} mV od celu "
                                          f"(najlepsza {best['err']*1e3:.1f} mV): wybór niejednoznaczny.")})
        r["warning"] = "; ".join(w["message"] for w in r["warnings"])
    r["eksp"] = diag
    r["n_pairs_rejected_sep"] = n_rej_sep
    return base._finalize(r, E, I)
