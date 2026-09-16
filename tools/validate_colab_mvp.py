from __future__ import annotations

import argparse
import csv
import json
import sys
import types
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = ROOT / "ITIES_Detect_Colab_MVP.ipynb"
DATA_DIR = ROOT.parent / "03_dane_laboratoryjne" / "odczyty_laboratoryjne"   # lab files, 272 TXT (moved from ~/Desktop/ITIES_DETECT in July 2026)
SAMPLE_PATH = ROOT / "samples" / "ities_synthetic_amphetamine.csv"
REAL_SAMPLE_PATH = DATA_DIR / "TPrA.txt"
REGRESSION_SAMPLE_PATH = DATA_DIR / "155_100ul_TPrA(1).txt"
INCONCLUSIVE_SAMPLE_PATH = DATA_DIR / "160_2b_100ul_TPrA(12).txt"
INCONCLUSIVE_SAMPLE_PATH_2 = DATA_DIR / "160_2b_100ul_TPrA(1).txt"


def install_local_stubs() -> None:
    try:
        import scipy.signal  # noqa: F401
    except Exception:
        scipy_module = types.ModuleType("scipy")
        signal_module = types.ModuleType("scipy.signal")

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
                candidates = candidates[keep]
                prominences = prominences[keep]

            if distance and candidates.size:
                order = np.argsort(y[candidates])[::-1]
                selected = []
                selected_prom = []
                for order_idx in order:
                    idx = int(candidates[order_idx])
                    if all(abs(idx - prev) >= distance for prev in selected):
                        selected.append(idx)
                        selected_prom.append(float(prominences[order_idx]))
                sort_order = np.argsort(selected)
                candidates = np.asarray(selected, dtype=int)[sort_order]
                prominences = np.asarray(selected_prom, dtype=float)[sort_order]

            return candidates, {"prominences": prominences}

        def peak_widths(y, peaks, rel_height=0.5):
            return np.ones(len(peaks), dtype=float), None, None, None

        signal_module.find_peaks = find_peaks
        signal_module.peak_widths = peak_widths
        scipy_module.signal = signal_module
        sys.modules["scipy"] = scipy_module
        sys.modules["scipy.signal"] = signal_module

    try:
        import matplotlib.pyplot  # noqa: F401
        import matplotlib.font_manager  # noqa: F401
    except Exception:
        matplotlib_module = types.ModuleType("matplotlib")
        pyplot_module = types.ModuleType("matplotlib.pyplot")
        font_manager_module = types.ModuleType("matplotlib.font_manager")

        class FakeFontProperties:
            def __init__(self, *args, **kwargs):
                pass

        class FakeRenderer:
            def get_text_width_height_descent(self, text, prop, ismath=False):
                return float(len(str(text)) * 8), 14.0, 2.0

        class FakeCanvas:
            def draw(self):
                return None

            def get_renderer(self):
                return FakeRenderer()

        class FakeTransform:
            def inverted(self):
                return self

            def transform(self, point):
                x, y = point
                return x / 1000.0, y / 800.0

        class FakeBbox:
            x0 = 100.0
            x1 = 900.0
            y1 = 720.0

        class FakeFig:
            def __init__(self):
                self.canvas = FakeCanvas()
                self.transFigure = FakeTransform()
                self.patch = types.SimpleNamespace(set_facecolor=lambda *args, **kwargs: None)

            def text(self, *args, **kwargs):
                return None

            def tight_layout(self, *args, **kwargs):
                return None

            def subplots_adjust(self, *args, **kwargs):
                return None

        class FakeAx:
            def __init__(self, fig):
                self.figure = fig
                self.xaxis = types.SimpleNamespace(label=types.SimpleNamespace(set_color=lambda *args, **kwargs: None))
                self.yaxis = types.SimpleNamespace(label=types.SimpleNamespace(set_color=lambda *args, **kwargs: None))
                self.spines = {
                    "left": types.SimpleNamespace(set_color=lambda *args, **kwargs: None),
                    "right": types.SimpleNamespace(set_color=lambda *args, **kwargs: None),
                    "top": types.SimpleNamespace(set_color=lambda *args, **kwargs: None),
                    "bottom": types.SimpleNamespace(set_color=lambda *args, **kwargs: None),
                }

            def plot(self, *args, **kwargs):
                return None

            def scatter(self, *args, **kwargs):
                return None

            def text(self, *args, **kwargs):
                return None

            def axvline(self, *args, **kwargs):
                return None

            def set_title(self, *args, **kwargs):
                return None

            def set_facecolor(self, *args, **kwargs):
                return None

            def tick_params(self, *args, **kwargs):
                return None

            def set_xlabel(self, *args, **kwargs):
                return None

            def set_ylabel(self, *args, **kwargs):
                return None

            def grid(self, *args, **kwargs):
                return None

            def legend(self, *args, **kwargs):
                return types.SimpleNamespace(get_texts=lambda: [])

            def get_window_extent(self, renderer=None):
                return FakeBbox()

            def annotate(self, *args, **kwargs):
                return None

        def noop(*args, **kwargs):
            return None

        for name in ("figure", "plot", "scatter", "text", "axvline", "title", "xlabel", "ylabel", "grid", "legend", "tight_layout", "show"):
            setattr(pyplot_module, name, noop)
        def fake_subplots(*args, **kwargs):
            fig = FakeFig()
            return fig, FakeAx(fig)

        pyplot_module.subplots = fake_subplots
        font_manager_module.FontProperties = FakeFontProperties
        matplotlib_module.pyplot = pyplot_module
        matplotlib_module.font_manager = font_manager_module
        sys.modules["matplotlib"] = matplotlib_module
        sys.modules["matplotlib.pyplot"] = pyplot_module
        sys.modules["matplotlib.font_manager"] = font_manager_module

    import os
    os.environ.setdefault("MPLBACKEND", "Agg")

    try:
        import matplotlib as _mpl
        _mpl.use("Agg")
    except Exception:
        pass

    try:
        import IPython.display  # noqa: F401
        import IPython as _ipy
        if not hasattr(_ipy, "get_ipython"):
            _ipy.get_ipython = lambda: None
    except Exception:
        ipython_module = types.ModuleType("IPython")
        display_module = types.ModuleType("IPython.display")
        display_module.display = lambda *args, **kwargs: None
        display_module.HTML = lambda value="": value
        ipython_module.display = display_module
        ipython_module.get_ipython = lambda: None
        ipython_module.version_info = (8, 24, 0)
        sys.modules["IPython"] = ipython_module
        sys.modules["IPython.display"] = display_module


def notebook_cells() -> list[dict]:
    return json.loads(NOTEBOOK_PATH.read_text(encoding="utf-8"))["cells"]


def cell_source(cell: dict) -> str:
    source = cell.get("source", "")
    return "".join(source) if isinstance(source, list) else str(source)


def execute_run_definitions(namespace: dict) -> None:
    marker = 'print("Wybierz jeden albo kilka plików TXT/CSV z pomiarami.")'
    for cell in notebook_cells():
        tags = cell.get("metadata", {}).get("tags", [])
        if cell["cell_type"] == "code" and "run" in tags:
            source = cell_source(cell)
            src = source.split(marker)[0]
            # headless: the venv has no IPython, display() becomes a no-op
            src = src.replace("from IPython.display import display", "def display(*a, **k): pass")
            src = src.replace("import matplotlib.pyplot as plt",
                              "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt")
            exec(src, namespace)
            return
    raise AssertionError("Brak komórki kodu z tagiem run.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--stubs",
        action="store_true",
        help="Install local scipy/matplotlib stubs when imports are unavailable.",
    )
    args = parser.parse_args()
    if not NOTEBOOK_PATH.exists():
        raise FileNotFoundError(NOTEBOOK_PATH)
    if not SAMPLE_PATH.exists():
        raise FileNotFoundError(SAMPLE_PATH)
    data_dir = REAL_SAMPLE_PATH.parent
    if not data_dir.is_dir():
        raise SystemExit(f"Brak katalogu danych: {data_dir}")

    cells = notebook_cells()
    assert len(cells) == 5, f"Notebook powinien mieć 5 komórek, ma {len(cells)}."
    joined = "\n".join(cell_source(cell) for cell in cells)
    assert "SHA-256" not in joined and "sha256" not in joined.lower(), "Notebook nadal zawiera SHA-256."
    assert "_result.json" not in joined and "Zapisano eksporty" not in joined, "Notebook nadal wygląda jak wersja JSON/per-file."

    if args.stubs:
        install_local_stubs()
    namespace: dict = {}
    execute_run_definitions(namespace)

    assert namespace["decision"](0.350)[0] == "detected"
    assert namespace["decision"](0.341)[0] == "detected"
    assert namespace["decision"](0.360)[0] == "detected"
    assert namespace["decision"](0.365)[0] == "uncertain"
    assert namespace["decision"](0.390)[0] == "not_detected"

    sample_content = SAMPLE_PATH.read_bytes()
    namespace["RESULTS"].clear()
    result = namespace["analyze"](SAMPLE_PATH.name, sample_content)

    assert result["status"] == "detected", result
    assert abs(result["E5"] - (-0.091)) <= 1e-9, result
    assert abs(result["delta_Es"] - 0.350) <= 0.004, result
    assert abs(result["E1_raw"] - 0.280) <= 0.010, result
    assert abs(result["E2_raw"] - 0.362) <= 0.010, result
    assert abs(result["E3_raw"] - 0.630) <= 0.010, result
    assert abs(result["E4_raw"] - 0.712) <= 0.010, result

    points = result["points"]
    assert points["1"]["branch"] == "powrotna_dolna" and points["1"]["kind"] == "min", result
    assert points["3"]["branch"] == "powrotna_dolna" and points["3"]["kind"] == "min", result
    assert points["2"]["branch"] == "pierwsza_gorna" and points["2"]["kind"] == "max", result
    assert points["4"]["branch"] == "pierwsza_gorna" and points["4"]["kind"] == "max", result
    assert points["1"]["I"] < 0 and points["3"]["I"] < 0, result
    assert points["2"]["I"] > 0 and points["4"]["I"] > 0, result

    manual = namespace["analyze"](
        SAMPLE_PATH.name,
        sample_content,
        manual={"E1": 0.280, "E2": 0.362, "E3": 0.630, "E4": 0.712},
    )
    assert manual["status"] == "detected", manual
    assert abs(manual["shift"] - (-0.412)) <= 0.001, manual
    assert abs(manual["E6"] - 0.259) <= 0.001, manual

    tmp_csv = Path("/tmp/ities_validate_zbiorcze.csv")
    namespace["save_summary_csv"](str(tmp_csv), download=False)
    with tmp_csv.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1 and rows[0]["file_name"] == SAMPLE_PATH.name, rows
    tmp_csv.unlink(missing_ok=True)

    checked_data_files = 0
    if REAL_SAMPLE_PATH.exists():
        checked_data_files += 1
        E, I, e_col, i_col = namespace["parse_file"](REAL_SAMPLE_PATH.read_bytes())
        assert e_col == "Potential applied (V)", e_col
        assert i_col == "WE(1).Current (A)", i_col
        assert len(E) > 100 and len(I) == len(E), len(E)
        real_result = namespace["analyze"](REAL_SAMPLE_PATH.name, REAL_SAMPLE_PATH.read_bytes())
        assert real_result["status"] == "detected", real_result
        assert real_result["binary_result"] == 1, real_result
        assert 0.349 <= real_result["delta_Es"] <= 0.358, real_result
        assert namespace["outcome_info"](real_result)[0] == "positive", real_result
        assert real_result["points"]["1"]["branch"] == "powrotna_dolna", real_result
        assert real_result["points"]["2"]["branch"] == "pierwsza_gorna", real_result

    if REGRESSION_SAMPLE_PATH.exists():
        checked_data_files += 1
        regression = namespace["analyze"](REGRESSION_SAMPLE_PATH.name, REGRESSION_SAMPLE_PATH.read_bytes())
        assert regression["status"] == "detected", regression
        assert abs(regression["E1_raw"] - 0.236664) <= 0.003, regression
        assert regression["points"]["1"]["branch"] == "powrotna_dolna", regression
        assert abs(regression["delta_Es"] - 0.356445) <= 0.003, regression

        namespace["FILE_STORE"].clear()
        namespace["RESULTS"].clear()
        content = REGRESSION_SAMPLE_PATH.read_bytes()
        key, note = namespace["unique_upload_key"](REGRESSION_SAMPLE_PATH.name, content)
        assert key == REGRESSION_SAMPLE_PATH.name and note is None, (key, note)
        namespace["FILE_STORE"][key] = content
        key, note = namespace["unique_upload_key"](REGRESSION_SAMPLE_PATH.name, content)
        assert key is None and "duplikat" in note, (key, note)
        key, note = namespace["unique_upload_key"]("kopia.txt", content)
        assert key is None and "duplikat" in note, (key, note)
        key, note = namespace["unique_upload_key"](REGRESSION_SAMPLE_PATH.name, content + b"x")
        assert key.endswith("__2.txt") and "Nazwa" in note, (key, note)

    if INCONCLUSIVE_SAMPLE_PATH.exists():
        checked_data_files += 1
        inconclusive = namespace["analyze"](INCONCLUSIVE_SAMPLE_PATH.name, INCONCLUSIVE_SAMPLE_PATH.read_bytes())
        assert inconclusive["status"] == "MEASUREMENT_QUALITY_FAIL", inconclusive
        assert namespace["outcome_info"](inconclusive)[0] == "measurement_fail", inconclusive

    if INCONCLUSIVE_SAMPLE_PATH_2.exists():
        checked_data_files += 1
        inconclusive_2 = namespace["analyze"](INCONCLUSIVE_SAMPLE_PATH_2.name, INCONCLUSIVE_SAMPLE_PATH_2.read_bytes())
        assert inconclusive_2["status"] == "MEASUREMENT_QUALITY_FAIL", inconclusive_2
        assert namespace["outcome_info"](inconclusive_2)[0] == "measurement_fail", inconclusive_2

    print(f"Pokrycie danych: sprawdzono {checked_data_files}/4 plików referencyjnych.")
    print("Walidacja OK: notebook ma 5 komórek, bez SHA/JSON, punkty 1-4 są z właściwych gałęzi, CSV zbiorczy działa.")


if __name__ == "__main__":
    main()
