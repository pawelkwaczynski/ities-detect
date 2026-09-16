// Shared between the browser worker and the Node parity test.
// The frozen module keeps the notebook's matplotlib imports; they are stubbed in the
// STRING before it runs, never in the file on disk.

export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_CDN_URLS = [
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  `https://cdn.jsdelivr.net/npm/pyodide@${PYODIDE_VERSION}/`,
];

// Keep in sync with MPL_STUB in tools/cpython_baseline.py (tools/check_stub_parity.py
// fails when the two drift apart).
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
cm = _MplStub()
`.trim();

export function stubMatplotlib(source) {
  let src = source.replace(/^import matplotlib\.pyplot as plt[^\n]*$/m, MPL_STUB);
  src = src.replace(/^import matplotlib\.cm as cm[^\n]*$/m, "");
  src = src.replace(/^import matplotlib[^\n]*$/m, "");
  if (/^import matplotlib/m.test(src)) {
    throw new Error("matplotlib import survived the stub");
  }
  return src;
}

// Serialisation helpers. They run once after the module is loaded and only touch the
// dictionary the module returns.
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

def dump_analyze(name, content, with_curve=True):
    result = analyze(name, content, with_curve=with_curve)
    return json.dumps(to_jsonable(result), ensure_ascii=False, default=str)

def dump_config():
    return json.dumps(to_jsonable(algo_config()), ensure_ascii=False, default=str)
`;
