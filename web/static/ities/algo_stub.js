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

def dump_analyze(name, content, manual=None):
    result = analyze(name, content, manual=manual)
    result = attach_curve(result, content)
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
`;

export const CONSTANT_NAMES = [
  "TPRA_TARGET_V",
  "AMPHETAMINE_TARGET_DELTA_V",
  "DETECTION_TOLERANCE_V",
  "UNCERTAIN_TOLERANCE_V",
  "PEAK_PROMINENCE_A",
  "KALIBRACJA_AKTYWNA",
  "WEAK_PEAK_CANDIDATES",
];
