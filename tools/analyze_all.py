"""
Analiza wsadowa wszystkich plików z folderu odczyty_laboratoryjne/.

Przetwarza każdy plik przez algorytm ITIES i sortuje kopie do podfolderów:
  positive/          — wykryto amphetaminę (detected)
  negative/          — nie wykryto (not_detected)
  tpra_only/         — znaleziono TPrA, brak pików analitu (TPrA_ONLY)
  brak_pary_analitu/ — TPrA OK, brak poprawnej pary analitu (NO_VALID_ANALYTE_PAIR)
  blad_pomiaru/      — zakłócenie aparaturowe (MEASUREMENT_QUALITY_FAIL)
  za_malo_punktow/   — za mało punktów pomiarowych (too_few_points)
  niepewne/          — wynik niepewny (uncertain)
  inny_blad/         — nieoczekiwany błąd parsowania/analizy

Generuje wyniki_zbiorcze.csv w folderze wyjściowym.
"""

from __future__ import annotations

import csv
import json
import os
import shutil
import sys
import time
import types
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = ROOT / "ITIES_Detect_Colab_MVP.ipynb"
LAB_DIR = ROOT / "odczyty_laboratoryjne"
OUT_DIR = ROOT / "wyniki_analizy"

SUBFOLDER = {
    "detected":                 "positive",
    "not_detected":             "negative",
    "TPrA_ONLY":                "tpra_only",
    "NO_VALID_ANALYTE_PAIR":    "brak_pary_analitu",
    "MEASUREMENT_QUALITY_FAIL": "blad_pomiaru",
    "too_few_points":           "za_malo_punktow",
    "uncertain":                "niepewne",
    "invalid":                  "inny_blad",
}

POMIJAJ = {".md", ".py", ".ipynb", ".csv", ".json"}

CSV_KOLUMNY = [
    "file_name", "status", "status_pl", "binary_result",
    "delta_Es", "error_mV", "shift",
    "E1_raw", "E2_raw", "E3_raw", "E4_raw",
    "n_points_total", "n_cycles_detected",
    "warning", "subfolder",
]


def install_stubs() -> None:
    os.environ.setdefault("MPLBACKEND", "Agg")
    try:
        import matplotlib as _mpl
        _mpl.use("Agg")
    except Exception:
        pass

    try:
        import scipy.signal  # noqa: F401
    except Exception:
        scipy_m = types.ModuleType("scipy")
        signal_m = types.ModuleType("scipy.signal")

        def find_peaks(y, prominence=None, distance=None):
            y = np.asarray(y, dtype=float)
            if y.size < 3:
                return np.array([], dtype=int), {"prominences": np.array([], dtype=float)}
            candidates = np.where((y[1:-1] > y[:-2]) & (y[1:-1] >= y[2:]))[0] + 1
            window = max(int((distance or 10) * 2), 10)
            prominences = []
            for idx in candidates:
                left = np.min(y[max(0, idx - window):idx + 1])
                right = np.min(y[idx:min(y.size, idx + window + 1)])
                prominences.append(y[idx] - max(left, right))
            prominences = np.asarray(prominences, dtype=float)
            if prominence is not None:
                keep = prominences >= float(prominence)
                candidates, prominences = candidates[keep], prominences[keep]
            return candidates, {"prominences": prominences}

        def savgol_filter(y, window_length, polyorder, mode="interp"):
            w = max(5, min(31, (len(y) // 45) * 2 + 1))
            if w % 2 == 0:
                w += 1
            kernel = np.ones(w, dtype=float) / w
            return np.convolve(np.asarray(y, dtype=float), kernel, mode="same")

        def peak_widths(y, peaks, rel_height=0.5):
            return np.ones(len(peaks), dtype=float), None, None, None

        signal_m.find_peaks = find_peaks
        signal_m.savgol_filter = savgol_filter
        signal_m.peak_widths = peak_widths
        scipy_m.signal = signal_m
        sys.modules["scipy"] = scipy_m
        sys.modules["scipy.signal"] = signal_m

    try:
        import matplotlib.pyplot  # noqa: F401
    except Exception:
        mpl_m = types.ModuleType("matplotlib")
        plt_m = types.ModuleType("matplotlib.pyplot")
        fm_m = types.ModuleType("matplotlib.font_manager")

        class FakeFig:
            canvas = types.SimpleNamespace(draw=lambda self: None)
            transFigure = types.SimpleNamespace(
                inverted=lambda self: types.SimpleNamespace(transform=lambda p: p),
                transform=lambda self, p: p,
            )
            patch = types.SimpleNamespace(set_facecolor=lambda *a, **kw: None)
            def text(self, *a, **kw): return None
            def tight_layout(self, *a, **kw): return None
            def subplots_adjust(self, *a, **kw): return None

        class FakeAx:
            def __init__(self, fig):
                self.figure = fig
                self.xaxis = types.SimpleNamespace(label=types.SimpleNamespace(set_color=lambda *a, **kw: None))
                self.yaxis = types.SimpleNamespace(label=types.SimpleNamespace(set_color=lambda *a, **kw: None))
                self.spines = {s: types.SimpleNamespace(set_color=lambda *a, **kw: None) for s in ("left","right","top","bottom")}
            def plot(self, *a, **kw): return None
            def scatter(self, *a, **kw): return None
            def text(self, *a, **kw): return None
            def axvline(self, *a, **kw): return None
            def set_title(self, *a, **kw): return None
            def set_facecolor(self, *a, **kw): return None
            def tick_params(self, *a, **kw): return None
            def set_xlabel(self, *a, **kw): return None
            def set_ylabel(self, *a, **kw): return None
            def grid(self, *a, **kw): return None
            def legend(self, *a, **kw): return types.SimpleNamespace(get_texts=lambda: [])
            def get_window_extent(self, renderer=None):
                return types.SimpleNamespace(x0=100.0, x1=900.0, y1=720.0)
            def annotate(self, *a, **kw): return None

        def fake_subplots(*a, **kw):
            fig = FakeFig()
            return fig, FakeAx(fig)

        for name in ("figure", "plot", "scatter", "text", "axvline", "title",
                     "xlabel", "ylabel", "grid", "legend", "tight_layout", "show"):
            setattr(plt_m, name, lambda *a, **kw: None)
        plt_m.subplots = fake_subplots
        fm_m.FontProperties = lambda *a, **kw: None
        mpl_m.pyplot = plt_m
        mpl_m.font_manager = fm_m
        sys.modules["matplotlib"] = mpl_m
        sys.modules["matplotlib.pyplot"] = plt_m
        sys.modules["matplotlib.font_manager"] = fm_m

    try:
        import IPython.display  # noqa: F401
        import IPython as _ipy
        if not hasattr(_ipy, "get_ipython"):
            _ipy.get_ipython = lambda: None
        if not hasattr(_ipy, "version_info"):
            _ipy.version_info = (8, 24, 0)
    except Exception:
        ipy_m = types.ModuleType("IPython")
        disp_m = types.ModuleType("IPython.display")
        disp_m.display = lambda *a, **kw: None
        disp_m.HTML = lambda value="": value
        ipy_m.display = disp_m
        ipy_m.get_ipython = lambda: None
        ipy_m.version_info = (8, 24, 0)
        sys.modules["IPython"] = ipy_m
        sys.modules["IPython.display"] = disp_m


def load_algorithm() -> dict:
    nb = json.loads(NOTEBOOK_PATH.read_text(encoding="utf-8"))
    marker = 'print("Wybierz jeden albo kilka plików TXT/CSV z pomiarami.")'
    for cell in nb["cells"]:
        tags = cell.get("metadata", {}).get("tags", [])
        if cell["cell_type"] == "code" and "run" in tags:
            source = "".join(cell.get("source", ""))
            ns: dict = {}
            exec(source.split(marker)[0], ns)
            return ns
    raise RuntimeError("Brak komórki kodu z tagiem 'run' w notebooku.")


def subfolder_for(status: str) -> str:
    return SUBFOLDER.get(status, "inny_blad")


def fmt(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:.6f}"
    return str(v)


def main() -> None:
    install_stubs()

    print(f"Wczytuję algorytm z {NOTEBOOK_PATH.name}...")
    ns = load_algorithm()
    analyze = ns["analyze"]
    build_invalid = ns["build_invalid_result"]

    pliki = sorted(
        p for p in LAB_DIR.iterdir()
        if p.is_file() and p.suffix.lower() not in POMIJAJ
    )
    print(f"Znaleziono {len(pliki)} plików do analizy.\n")

    # Czyścimy poprzednie wyniki — inaczej plik przeklasyfikowany między
    # uruchomieniami zostałby skopiowany do kilku podfolderów naraz.
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir()
    for folder in SUBFOLDER.values():
        (OUT_DIR / folder).mkdir()

    wyniki = []
    t0 = time.time()

    for i, plik in enumerate(pliki, 1):
        ns["RESULTS"].clear()
        try:
            content = plik.read_bytes()
            result = analyze(plik.name, content)
        except Exception as exc:
            result = build_invalid(plik.name, str(exc))

        status = result.get("status", "invalid")
        folder = subfolder_for(status)
        cel = OUT_DIR / folder / plik.name
        shutil.copy2(plik, cel)

        wiersz = {k: fmt(result.get(k)) for k in CSV_KOLUMNY}
        wiersz["subfolder"] = folder
        wiersz["file_name"] = plik.name
        wyniki.append(wiersz)

        delta = fmt(result.get("delta_Es"))
        blad = fmt(result.get("error_mV"))
        print(f"[{i:3d}/{len(pliki)}] {plik.name:<55} → {folder:<22}  ΔE_s={delta or 'N/A':>10}  błąd={blad or 'N/A':>8} mV")

    csv_path = OUT_DIR / "wyniki_zbiorcze.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_KOLUMNY)
        writer.writeheader()
        writer.writerows(wyniki)

    czas = time.time() - t0
    print(f"\nGotowe! Czas analizy: {czas:.1f} s")
    print(f"Wyniki CSV: {csv_path}")
    print(f"\nPodsumowanie:")

    zlicz: dict[str, int] = {}
    for w in wyniki:
        zlicz[w["subfolder"]] = zlicz.get(w["subfolder"], 0) + 1
    for folder, n in sorted(zlicz.items(), key=lambda x: -x[1]):
        print(f"  {folder:<24}: {n:3d} plików")


if __name__ == "__main__":
    main()
