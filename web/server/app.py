"""Static host for the CV Analysers hub: ITIES Detect, PeakWise, plus /api/versions."""
from __future__ import annotations

import json
import mimetypes
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_file

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
ALGO = ROOT / "algo"
ASSETS = ROOT / "assets"
STATIC_ASSETS = STATIC / "assets"

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")

app = Flask(__name__)

LONG_CACHE = ("pyodide", "vendor")


def _guess_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    if path.suffix == ".wasm":
        return "application/wasm"
    if path.suffix == ".mjs":
        return "application/javascript"
    return guessed or "application/octet-stream"


def send_precompressed(path: Path, cache: str | None = None) -> Response:
    if not path.is_file():
        return Response("Not found", status=404)
    accept = request.headers.get("Accept-Encoding", "")
    payload = path
    encoding = None
    br = Path(str(path) + ".br")
    gz = Path(str(path) + ".gz")
    if "br" in accept and br.is_file():
        payload = br
        encoding = "br"
    elif "gzip" in accept and gz.is_file():
        payload = gz
        encoding = "gzip"
    resp = send_file(payload, mimetype=_guess_type(path), conditional=True)
    if encoding:
        resp.headers["Content-Encoding"] = encoding
        resp.headers["Vary"] = "Accept-Encoding"
    if cache:
        resp.headers["Cache-Control"] = cache
    return resp


def _cache_for(prefix: str) -> str:
    if prefix in LONG_CACHE:
        return "public, max-age=31536000, immutable"
    return "no-cache"


@app.get("/api/versions")
def api_versions():
    data = json.loads((ALGO / "versions.json").read_text(encoding="utf-8"))
    return jsonify(data)


@app.get("/")
def hub():
    return send_precompressed(STATIC / "index.html", cache="no-cache")


@app.get("/ities/")
def ities_index():
    return send_precompressed(STATIC / "ities" / "index.html", cache="no-cache")


@app.get("/peakwise/")
def peakwise_index():
    return send_precompressed(STATIC / "peakwise" / "index.html", cache="no-cache")


@app.get("/algo/<path:name>")
def algo_file(name: str):
    path = (ALGO / name).resolve()
    if not str(path).startswith(str(ALGO.resolve())) or not path.is_file():
        return Response("Not found", status=404)
    mime = "application/json" if path.suffix == ".json" else "text/plain"
    resp = send_file(path, mimetype=mime)
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/assets/<path:name>")
def assets(name: str):
    """Serve static/assets first (shipped with the app), then the source assets/ dir."""
    for root in (STATIC_ASSETS, ASSETS):
        path = (root / name).resolve()
        if str(path).startswith(str(root.resolve())) and path.is_file():
            return send_precompressed(path, cache="public, max-age=86400")
    return Response("Not found", status=404)


@app.get("/<path:name>")
def static_or_ities(name: str):
    if name.startswith("ities/"):
        path = STATIC / name
        return send_precompressed(path, cache="no-cache")
    prefix = name.split("/", 1)[0]
    path = STATIC / name
    if path.is_file() or Path(str(path) + ".br").is_file():
        return send_precompressed(path, cache=_cache_for(prefix))
    return Response("Not found", status=404)
