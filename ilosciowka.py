#!/usr/bin/env python3
"""Ilościówka ITIES — stężenie amfetaminy i % czystości próbki.

Odwzorowanie procedury laboratorium („Excel do komercji.xlsx"):
    1. odważka m [mg] rozpuszczona w V_probki = 3 mL 10 mM NaCl,
    2. do naczynka (V_cell = 3,5 mL) dodaje się porcję V_dodane [µL] tego roztworu,
    3. z woltamperogramu odczytuje się prąd piku Ip,
    4. z krzywej kalibracyjnej Ip = a·c + b wychodzi stężenie c w naczynku,
    5. % czystości = c zmierzone / c oczekiwane przy 100 % czystości.

Jednostki: Ip w µA, c w µM. Uwaga: 1 A/M = 1 µA/µM, więc współczynniki
kalibracji z Excela lab (A, M) wchodzą tu bez przeliczania.

Uruchomienie jako skrypt = walidacja na wszystkich próbkach z Excela lab.
"""
import json
import os

M_AMFETAMINA = 135.21      # g/mol
V_PROBKI_ML = 3.0          # objętość rozpuszczenia odważki
V_CELL_ML = 3.5            # objętość naczynka elektrochemicznego

HERE = os.path.dirname(os.path.abspath(__file__))
CALIB_JSON = os.path.join(HERE, "kalibracja_amfetamina.json")

# Kalibracja używana przez laboratorium do próbek komercyjnych („Excel do komercji").
# To ONA stoi za porównaniem z HPLC (R² = 0,9239), więc jest domyślna do czasu
# rozstrzygnięcia rozbieżności z krzywą CC (a = 0,177) przez Łukasza.
KALIBRACJA_LAB = {"a": 0.123, "b": -0.2248, "zrodlo": "Excel do komercji.xlsx (lab)"}


def wczytaj_kalibracje_cc():
    """Kalibracja wyznaczona przez nas z plików CC (kalibracja_cc.py)."""
    if not os.path.exists(CALIB_JSON):
        return None
    d = json.load(open(CALIB_JSON, encoding="utf-8"))
    return {"a": d["a"], "b": d["b"], "zrodlo": d["zrodlo"],
            "LOD_uM": d.get("LOD_uM"), "LOQ_uM": d.get("LOQ_uM")}


def stezenie_z_ip(ip_uA, kalibracja=None):
    """Stężenie analitu w naczynku [µM] z prądu piku [µA]."""
    k = kalibracja or KALIBRACJA_LAB
    if ip_uA is None:
        return None
    return (ip_uA - k["b"]) / k["a"]


def stezenie_oczekiwane_uM(masa_mg, v_dodane_uL,
                           v_probki_mL=V_PROBKI_ML, v_cell_mL=V_CELL_ML,
                           masa_molowa=M_AMFETAMINA):
    """Stężenie w naczynku, jakie dałaby próbka o 100 % czystości [µM].
    Odpowiednik kolumny J w Excelu lab: (C_ideal · V_dodane)/(V_cell + V_dodane)."""
    if not masa_mg or not v_dodane_uL:
        return None
    c_ideal_M = (masa_mg * 1e-3 / masa_molowa) / (v_probki_mL * 1e-3)
    v_dodane_L = v_dodane_uL * 1e-6
    c_naczynko_M = c_ideal_M * v_dodane_L / (v_cell_mL * 1e-3 + v_dodane_L)
    return c_naczynko_M * 1e6


def czystosc_procent(ip_uA, masa_mg, v_dodane_uL, kalibracja=None, **kw):
    """% amfetaminy w próbce. Zwraca (procent, c_zmierzone_uM, c_oczekiwane_uM)."""
    c_zm = stezenie_z_ip(ip_uA, kalibracja)
    c_ocz = stezenie_oczekiwane_uM(masa_mg, v_dodane_uL, **kw)
    if c_zm is None or not c_ocz:
        return None, c_zm, c_ocz
    return 100.0 * c_zm / c_ocz, c_zm, c_ocz


# ─── Walidacja na danych laboratorium ────────────────────────────────────────

def _wiersze_z_excela():
    import openpyxl
    path = os.path.join(os.path.dirname(HERE), "06_ities_update_20260727",
                        "Excel do komercji.xlsx")
    ws = openpyxl.load_workbook(path, data_only=True)["Sheet1"]
    out = []
    for r in range(8, 50):
        nazwa, masa, vmax, prad, proc = (ws[f"B{r}"].value, ws[f"C{r}"].value,
                                         ws[f"H{r}"].value, ws[f"S{r}"].value,
                                         ws[f"V{r}"].value)
        if nazwa is None or masa is None or vmax is None:
            continue
        if not isinstance(prad, (int, float)) or not isinstance(proc, (int, float)):
            continue
        out.append({"nazwa": str(nazwa), "masa_mg": masa,
                    "v_dodane_uL": vmax * 1e6, "ip_uA": prad * 1e6, "lab_pct": proc})
    return out


def main():
    wiersze = _wiersze_z_excela()
    cc = wczytaj_kalibracje_cc()
    print(f"Próbek z Excela lab: {len(wiersze)}\n")
    print(f"{'próbka':>10} {'m [mg]':>7} {'V [µL]':>7} {'Ip [µA]':>8} "
          f"{'lab %':>8} {'nasze %':>8} {'Δ':>10} {'% wg CC':>9}")
    maxdiff = 0.0
    for w in wiersze:
        pct, c_zm, c_ocz = czystosc_procent(w["ip_uA"], w["masa_mg"], w["v_dodane_uL"])
        pct_cc = czystosc_procent(w["ip_uA"], w["masa_mg"], w["v_dodane_uL"], cc)[0] if cc else None
        d = abs(pct - w["lab_pct"])
        maxdiff = max(maxdiff, d)
        print(f"{w['nazwa']:>10} {w['masa_mg']:7.1f} {w['v_dodane_uL']:7.0f} "
              f"{w['ip_uA']:8.3f} {w['lab_pct']:8.4f} {pct:8.4f} {d:10.2e} "
              f"{(pct_cc if pct_cc is not None else float('nan')):9.4f}")
    print(f"\nMaksymalna bezwzględna różnica vs Excel lab: {maxdiff:.3e} p.p.")
    if maxdiff > 1e-10:
        raise SystemExit(1)
    if cc:
        print(f"Kalibracja CC: a={cc['a']:.4f} b={cc['b']:.4f} ({cc['zrodlo']})")
        print(f"Kalibracja lab: a={KALIBRACJA_LAB['a']:.4f} b={KALIBRACJA_LAB['b']:.4f}")
        print(f"Stosunek nachyleń a_lab/a_CC = {KALIBRACJA_LAB['a']/cc['a']:.3f} "
              f"→ % wg CC jest o tyle razy niższy.")


if __name__ == "__main__":
    main()
