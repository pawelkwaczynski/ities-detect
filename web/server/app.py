"""Authenticated static host for the CV Analysers hub and both analysers."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import threading
import time
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from flask import Flask, Response, jsonify, redirect, render_template, request, send_file, session, url_for
from flask.sessions import SecureCookieSessionInterface
from werkzeug.security import check_password_hash

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
ALGO = ROOT / "algo"
ASSETS = ROOT / "assets"
STATIC_ASSETS = STATIC / "assets"
DEFAULT_AUTH_FILE = Path(__file__).with_name("auth.local.json")

LOGIN_KEYS = (
    "login.pageTitle",
    "login.title",
    "login.username",
    "login.password",
    "login.submit",
    "login.invalid",
    "login.rateLimited",
    "login.by",
)

PUBLIC_PATHS = {
    "/login",
    "/logout",
    "/healthz",
    "/robots.txt",
    "/shared/tokens.css",
    "/shared/ui.css",
    "/assets/ities_icon_256.png",
    # The login page picks its icon by device pixel ratio, so both sources have to be
    # reachable without a session as well.
    "/assets/ities_icon_512.png",
    "/assets/cv_icon_256.png",
    "/assets/cv_icon_512.png",
    "/assets/partners/focusframe-logo.svg",
}
PROTECTED_PREFIXES = (
    "/ities/",
    "/peakwise/",
    "/algo/",
    "/api/",
    "/shared/",
    "/assets/",
    "/vendor/",
    "/pyodide/",
)
RATE_LIMIT_ATTEMPTS = 5
RATE_LIMIT_SECONDS = 60

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")

def _load_auth_config() -> tuple[Path, dict]:
    path = Path(os.environ.get("ITIES_AUTH_FILE", DEFAULT_AUTH_FILE)).expanduser().resolve()
    if not path.is_file():
        raise RuntimeError(f"Authentication configuration is missing: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Authentication configuration cannot be read: {path}") from exc
    users = data.get("users")
    secret = data.get("secret_key")
    if not isinstance(users, dict) or not users or not all(
        isinstance(name, str) and name and isinstance(value, str) and value
        for name, value in users.items()
    ):
        raise RuntimeError(f"Authentication configuration has no valid users map: {path}")
    if not isinstance(secret, str) or len(secret) < 32:
        raise RuntimeError(f"Authentication configuration has no valid secret_key: {path}")
    return path, data


def _dictionary_section(source: str, name: str) -> str:
    start = source.find(f"const {name} = {{")
    end = source.find("\n};", start)
    if start < 0 or end < 0:
        raise RuntimeError(f"UI dictionary {name} is unavailable")
    return source[start:end]


def _login_copy() -> dict[str, dict[str, str]]:
    """Read login strings from the same dictionary used by the browser UI."""
    source = (STATIC / "shared" / "i18n.js").read_text(encoding="utf-8")
    copy: dict[str, dict[str, str]] = {}
    for lang, section_name in (("en", "EN"), ("pl", "PL")):
        section = _dictionary_section(source, section_name)
        translated: dict[str, str] = {}
        for key in LOGIN_KEYS:
            match = re.search(
                rf'^\s*"{re.escape(key)}"\s*:\s*("(?:\\.|[^"\\])*")\s*,?\s*$',
                section,
                flags=re.MULTILINE,
            )
            if not match:
                raise RuntimeError(f"Login translation {key!r} is missing for {lang}")
            translated[key] = json.loads(match.group(1))
        copy[lang] = translated
    return copy


class ProxyAwareSessionInterface(SecureCookieSessionInterface):
    """Mark the session Secure only when the original request used HTTPS."""

    def get_cookie_secure(self, app: Flask) -> bool:
        forwarded = request.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip().lower()
        return request.is_secure or forwarded == "https"


AUTH_FILE, AUTH_CONFIG = _load_auth_config()
LOGIN_COPY = _login_copy()

app = Flask(__name__, template_folder="templates")
app.config.update(
    SECRET_KEY=AUTH_CONFIG["secret_key"],
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    SESSION_REFRESH_EACH_REQUEST=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
app.session_interface = ProxyAwareSessionInterface()

_login_attempts: dict[str, dict[str, float | int]] = {}
_login_attempts_lock = threading.Lock()

LONG_CACHE = ("pyodide", "vendor")
ASSET_CACHE = "public, max-age=2592000"


def _client_address() -> str:
    return request.remote_addr or "unknown"


def _rate_state(address: str, now: float) -> tuple[int, float]:
    with _login_attempts_lock:
        record = _login_attempts.get(address)
        if not record:
            return 0, 0.0
        blocked_until = float(record.get("blocked_until", 0.0))
        if blocked_until and now >= blocked_until:
            _login_attempts.pop(address, None)
            return 0, 0.0
        return int(record.get("failures", 0)), blocked_until


def _record_login_failure(address: str, now: float) -> tuple[int, float]:
    with _login_attempts_lock:
        record = _login_attempts.setdefault(address, {"failures": 0, "blocked_until": 0.0})
        record["failures"] = int(record["failures"]) + 1
        if int(record["failures"]) >= RATE_LIMIT_ATTEMPTS:
            record["blocked_until"] = now + RATE_LIMIT_SECONDS
        return int(record["failures"]), float(record["blocked_until"])


def _clear_login_failures(address: str) -> None:
    with _login_attempts_lock:
        _login_attempts.pop(address, None)


def _language() -> str:
    requested = request.args.get("lang", "").lower()
    if requested in LOGIN_COPY:
        return requested
    saved = request.cookies.get("analizatory-lang", "").lower()
    if saved in LOGIN_COPY:
        return saved
    # The lab works in Polish; the browser locale must not override that on the door.
    return "pl"


def _safe_next(value: str | None) -> str:
    if not value:
        return "/"
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path.startswith("/") or parsed.path.startswith("//"):
        return "/"
    return parsed.path + (("?" + parsed.query) if parsed.query else "")


def _login_response(lang: str, error_key: str | None = None, status: int = 200) -> Response:
    # The cookie is written only when this request carried an explicit ?lang=, so a
    # sign-in never resets the language the operator picked inside the application.
    explicit = request.args.get("lang", "").lower() in LOGIN_COPY
    response = app.make_response(
        (
            render_template(
                "login.html",
                copy=LOGIN_COPY[lang],
                lang=lang,
                error_key=error_key,
                next_path=_safe_next(request.values.get("next")),
            ),
            status,
        )
    )
    if explicit:
        response.set_cookie(
            "analizatory-lang",
            lang,
            max_age=31536000,
            httponly=False,
            samesite="Lax",
            secure=request.is_secure
            or request.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip().lower() == "https",
        )
    if status == 429:
        response.headers["Retry-After"] = str(RATE_LIMIT_SECONDS)
    return response


def _is_protected(path: str) -> bool:
    return path == "/" or any(path.startswith(prefix) for prefix in PROTECTED_PREFIXES)


@app.before_request
def require_login():
    if request.path in PUBLIC_PATHS or not _is_protected(request.path):
        return None
    if session.get("user") in AUTH_CONFIG["users"]:
        session.permanent = True
        return None
    return redirect(url_for("login", next=request.full_path.rstrip("?")))


@app.route("/login", methods=("GET", "POST"))
def login():
    lang = _language()
    if request.method == "GET":
        return _login_response(lang)

    address = _client_address()
    now = time.monotonic()
    failures, blocked_until = _rate_state(address, now)
    if failures >= RATE_LIMIT_ATTEMPTS and blocked_until > now:
        app.logger.warning("Login rate limit active for client %s", address)
        return _login_response(lang, "login.rateLimited", 429)

    username = request.form.get("username", "")
    password = request.form.get("password", "")
    stored_hash = AUTH_CONFIG["users"].get(username)
    valid = bool(stored_hash) and check_password_hash(stored_hash, password)
    if not valid:
        failures, blocked_until = _record_login_failure(address, now)
        app.logger.warning("Failed login for client %s", address)
        if failures >= RATE_LIMIT_ATTEMPTS and blocked_until > now:
            return _login_response(lang, "login.rateLimited", 429)
        return _login_response(lang, "login.invalid", 200)

    _clear_login_failures(address)
    session.clear()
    session["user"] = username
    session.permanent = True
    return redirect(_safe_next(request.form.get("next")))


@app.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.get("/healthz")
def healthz():
    return Response(status=200)


# A lab tool behind a password has nothing to gain from a search engine, and a leaked
# link should not turn into a cached copy. The header travels on every response, the
# file answers the crawlers that read it before anything else.
@app.after_request
def no_indexing(response: Response) -> Response:
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return response


@app.get("/robots.txt")
def robots():
    return Response("User-agent: *\nDisallow: /\n", mimetype="text/plain")


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
    """Serve static/assets first (shipped with the app), then the source assets/ dir.

    Partner logos live in assets/partners/ and never change inside a release, so they
    get the same long cache as the rest of the images.
    """
    for root in (STATIC_ASSETS, ASSETS):
        path = (root / name).resolve()
        if str(path).startswith(str(root.resolve())) and path.is_file():
            return send_precompressed(path, cache=ASSET_CACHE)
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
