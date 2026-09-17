// Shared between the browser worker and the Node parity test.
// Stubs matplotlib so the frozen notebook-extracted module can import.

export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_CDN_URLS = [
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`,
];

const MPL_STUB = `
class _MplStub:
    def __init__(self, *a, **k):
        pass
    def __getattr__(self, name):
        return self
    def __call__(self, *a, **k):
        return self
    def __iter__(self):
        return iter(())
    def __bool__(self):
        return False
plt = _MplStub()
pe = _MplStub()
Line2D = _MplStub
FontProperties = _MplStub
`.trim();

export function stubMatplotlib(source) {
  let src = source.replace(/^import matplotlib\.pyplot as plt[^\n]*$/m, MPL_STUB);
  src = src.replace(/^import matplotlib\.patheffects as pe[^\n]*$/m, "");
  src = src.replace(/^from matplotlib\.lines import Line2D[^\n]*$/m, "");
  src = src.replace(/^from matplotlib\.font_manager import FontProperties[^\n]*$/m, "");
  src = src.replace(/^import matplotlib[^\n]*$/m, "");
  return src;
}

export const ANALYZE_HELPERS_PY = `
import json
import numpy as np

def to_jsonable(obj):
    if obj is None or isinstance(obj, (str, bool, int)):
        return obj
    if isinstance(obj, float):
        if obj != obj or obj in (float("inf"), float("-inf")):
            return None
        return obj
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return to_jsonable(obj.tolist())
    if isinstance(obj, (np.floating, np.integer, np.bool_)):
        return to_jsonable(obj.item())
    if hasattr(obj, "item") and callable(obj.item):
        try:
            return to_jsonable(obj.item())
        except Exception:
            pass
    return str(obj)

def attach_curve(result, content):
    try:
        E, I, _, _ = parse_file(content)
        E_use, I_use, n_cycles, cycle_used = detect_cycles_and_select(E, I)
        shift = result.get("shift") or 0.0
        try:
            fwd, bwd = split_cv(E_use)
        except Exception:
            n = len(E_use)
            fwd = np.arange(max(n // 2, 1))
            bwd = np.arange(n // 2, n)
        result["curve"] = {
            "E_raw": [float(x) for x in E_use],
            "E_cal": [float(x) + float(shift) for x in E_use],
            "I_uA": [float(x) * 1e6 for x in I_use],
            "fwd_idx": [int(i) for i in fwd],
            "bwd_idx": [int(i) for i in bwd],
        }
    except Exception:
        result["curve"] = None
    return result

def attach_point_prominence(result, content):
    """Prominence of the peak a manual point 1 to 4 stands on.

    The detector reports prominence for the peaks it finds itself. A point the
    technician indicated goes through nearest_on_branch, which carries none, so a
    place that is no peak at all looks exactly like one. Measured here on the same
    smoothed branch signal the detector uses: find every peak on that branch with no
    threshold, then take the strongest one within 20 mV of the indicated potential.
    Nothing inside the algorithm is touched and no verdict field is written, the
    value lands in its own key.
    """
    try:
        from scipy.signal import find_peaks
        points = result.get("points") or {}
        need = [
            k for k in ("1", "2", "3", "4")
            if isinstance(points.get(k), dict)
            and points[k].get("prom") is None
            and points[k].get("idx") is not None
        ]
        if not need:
            return result
        E, I, _, _ = parse_file(content)
        E_use, I_use, _, _ = detect_cycles_and_select(E, I)
        upper, lower = split_cv(E_use)
        out = {}
        for key in need:
            gi = int(points[key]["idx"])
            idx = lower if key in ("1", "3") else upper
            raw = I_use[idx] if key in ("2", "4") else -I_use[idx]
            y = smooth_signal(raw)
            Eb = E_use[idx]
            if len(y) < 5:
                continue
            local = int(np.argmin(np.abs(np.asarray(idx) - gi)))
            peaks, props = find_peaks(y, prominence=0)
            step = max(float(np.median(np.abs(np.diff(Eb)))), 1e-9)
            window = max(3, int(round(0.020 / step)))
            best = 0.0
            for j, position in enumerate(peaks):
                if abs(int(position) - local) <= window:
                    best = max(best, float(props["prominences"][j]))
            out[key] = best
        if out:
            result["manual_prominence"] = out
    except Exception:
        pass
    return result

def dump_analyze(name, content, manual=None):
    result = analyze(name, content, manual=manual)
    result = attach_curve(result, content)
    if manual:
        result = attach_point_prominence(result, content)
    try:
        result["result_row"] = to_jsonable(result_row(result))
    except Exception as exc:
        result["result_row"] = {"file_name": name, "result_row_error": str(exc)}
    return json.dumps(to_jsonable(result), ensure_ascii=False, default=str)

def algo_constants():
    names = (
        "TPRA_TARGET_V",
        "AMPHETAMINE_TARGET_DELTA_V",
        "DETECTION_TOLERANCE_V",
        "UNCERTAIN_TOLERANCE_V",
        "PEAK_PROMINENCE_A",
        "KALIBRACJA_AKTYWNA",
        "WEAK_PEAK_CANDIDATES",
        "ALGO_VERSION",
        "ALGO_CELL_SHA256",
        "WIN_TPRA_POS_RAW",
        "WIN_TPRA_NEG_RAW",
    )
    g = globals()
    out = {}
    for n in names:
        if n in g:
            out[n] = to_jsonable(g[n])
    kal_name = g.get("KALIBRACJA_AKTYWNA")
    kals = g.get("KALIBRACJE") or {}
    if kal_name in kals:
        out["KALIBRACJA"] = to_jsonable(kals[kal_name])
    return json.dumps(out, ensure_ascii=False, default=str)

_ANALYSIS_PARAM_NAMES = (
    "DETECTION_TOLERANCE_V",
    "UNCERTAIN_TOLERANCE_V",
    "AMPHETAMINE_TARGET_DELTA_V",
    "WIN_TPRA_POS_RAW",
    "WIN_TPRA_NEG_RAW",
)
_ORIGINAL_ANALYSIS_PARAMS = None

def remember_analysis_params():
    global _ORIGINAL_ANALYSIS_PARAMS
    g = globals()
    _ORIGINAL_ANALYSIS_PARAMS = {name: g[name] for name in _ANALYSIS_PARAM_NAMES}
    return algo_constants()

def apply_analysis_params(payload=None):
    if _ORIGINAL_ANALYSIS_PARAMS is None:
        remember_analysis_params()
    g = globals()
    for name, value in _ORIGINAL_ANALYSIS_PARAMS.items():
        g[name] = value
    overrides = json.loads(payload) if payload else None
    if overrides:
        unknown = set(overrides) - set(_ANALYSIS_PARAM_NAMES)
        if unknown:
            raise ValueError("Unknown analysis parameter: " + ", ".join(sorted(unknown)))
        for name, value in overrides.items():
            if name in ("WIN_TPRA_POS_RAW", "WIN_TPRA_NEG_RAW"):
                if not isinstance(value, list) or len(value) != 2:
                    raise ValueError(name + " must contain two values")
                g[name] = (float(value[0]), float(value[1]))
            else:
                g[name] = float(value)
    return algo_constants()
`;

export const CONSTANT_NAMES = [
  "TPRA_TARGET_V",
  "AMPHETAMINE_TARGET_DELTA_V",
  "DETECTION_TOLERANCE_V",
  "UNCERTAIN_TOLERANCE_V",
  "PEAK_PROMINENCE_A",
  "KALIBRACJA_AKTYWNA",
  "WEAK_PEAK_CANDIDATES",
  "WIN_TPRA_POS_RAW",
  "WIN_TPRA_NEG_RAW",
];
