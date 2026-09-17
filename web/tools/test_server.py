#!/usr/bin/env python3
"""Server, authentication, MIME and manifest checks for the local Flask app."""
from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import tempfile
from pathlib import Path

from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parent.parent
TEST_USER = "generated-test-user"
TEST_PASSWORD = secrets.token_urlsafe(24)
AUTH_DIR = tempfile.TemporaryDirectory(prefix=".auth-test-", dir=ROOT / "tools")
AUTH_FILE = Path(AUTH_DIR.name) / "auth.local.json"
AUTH_FILE.write_text(
    json.dumps(
        {
            "users": {TEST_USER: generate_password_hash(TEST_PASSWORD)},
            "secret_key": secrets.token_hex(32),
        }
    ),
    encoding="utf-8",
)
os.environ["ITIES_AUTH_FILE"] = str(AUTH_FILE)
sys.path.insert(0, str(ROOT / "server"))

from app import app  # noqa: E402


def session_cookie(headers: list[str]) -> str | None:
    return next((value for value in headers if value.startswith("session=")), None)


def authenticated_client():
    client = app.test_client()
    response = client.post(
        "/login",
        data={"username": TEST_USER, "password": TEST_PASSWORD, "next": "/"},
        environ_base={"REMOTE_ADDR": "127.0.0.20"},
    )
    if response.status_code != 302:
        raise AssertionError(f"generated test login returned {response.status_code}")
    return client


def main() -> int:
    fails: list[str] = []

    # Missing configuration must stop import rather than expose an open server.
    missing = Path(AUTH_DIR.name) / "missing-auth.local.json"
    fail_closed_env = os.environ.copy()
    fail_closed_env["ITIES_AUTH_FILE"] = str(missing)
    probe = subprocess.run(
        [sys.executable, "-c", "import sys; sys.path.insert(0, 'server'); import app"],
        cwd=ROOT,
        env=fail_closed_env,
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    fail_closed_text = probe.stdout + probe.stderr
    if probe.returncode == 0 or "Authentication configuration is missing" not in fail_closed_text:
        fails.append("missing auth configuration does not fail closed with a clear message")
    else:
        print("auth fail-closed: PASS")

    anonymous = app.test_client()
    protected = anonymous.get("/ities/")
    if protected.status_code != 302 or not protected.headers.get("Location", "").startswith("/login"):
        fails.append(f"anonymous /ities/ expected login redirect, got {protected.status_code}")
    else:
        print("anonymous /ities/: 302 to login")

    wrong = anonymous.post(
        "/login?lang=pl",
        data={"username": TEST_USER, "password": TEST_PASSWORD + "x", "next": "/"},
        environ_base={"REMOTE_ADDR": "127.0.0.21"},
    )
    wrong_cookies = wrong.headers.getlist("Set-Cookie")
    if wrong.status_code != 200 or "Zły login albo hasło" not in wrong.get_data(as_text=True):
        fails.append(f"wrong credentials response {wrong.status_code} or generic error missing")
    if session_cookie(wrong_cookies):
        fails.append("wrong credentials issued a session cookie")
    else:
        print("wrong credentials: generic error, no session cookie")

    good_client = app.test_client()
    good = good_client.post(
        "/login?lang=pl",
        data={"username": TEST_USER, "password": TEST_PASSWORD, "next": "/"},
        environ_base={"REMOTE_ADDR": "127.0.0.22"},
    )
    if good.status_code != 302 or good.headers.get("Location") != "/":
        fails.append(f"good credentials expected 302 to /, got {good.status_code} {good.headers.get('Location')!r}")
    cookie = session_cookie(good.headers.getlist("Set-Cookie"))
    if not cookie or "HttpOnly" not in cookie or "SameSite=Lax" not in cookie:
        fails.append("session cookie lacks HttpOnly or SameSite=Lax")
    else:
        print("good credentials: 302 to /, HttpOnly, SameSite=Lax")

    secure_client = app.test_client()
    secure = secure_client.post(
        "/login",
        data={"username": TEST_USER, "password": TEST_PASSWORD, "next": "/"},
        headers={"X-Forwarded-Proto": "https"},
        environ_base={"REMOTE_ADDR": "127.0.0.23"},
    )
    secure_cookie = session_cookie(secure.headers.getlist("Set-Cookie"))
    if not secure_cookie or "Secure" not in secure_cookie:
        fails.append("HTTPS proxy login did not mark the session cookie Secure")
    else:
        print("proxy HTTPS session cookie: Secure")

    limited = app.test_client()
    rate_statuses = []
    for _ in range(5):
        response = limited.post(
            "/login",
            data={"username": TEST_USER, "password": TEST_PASSWORD + "x"},
            environ_base={"REMOTE_ADDR": "127.0.0.24"},
        )
        rate_statuses.append(response.status_code)
    if rate_statuses != [200, 200, 200, 200, 429]:
        fails.append(f"rate limit statuses {rate_statuses!r}, expected four 200 then 429")
    else:
        print("rate limit: fifth failure returns 429")

    # GET /login has to render, not explode: werkzeug 3 dropped default_match.
    form = anonymous.get("/login?lang=pl")
    if form.status_code != 200 or b'name="password"' not in form.data:
        fails.append(f"GET /login status {form.status_code}, form missing")
    else:
        print("GET /login: 200 with the form")

    # LL: the login page carries the CV mark, so both of its sources have to be
    # reachable before anybody signs in.
    for icon in ("cv_icon_256.png", "cv_icon_512.png"):
        response = anonymous.get("/assets/" + icon)
        if response.status_code != 200:
            fails.append(f"/assets/{icon} without a session: {response.status_code}")
    if b"cv_icon_256.png" not in form.data:
        fails.append("the login page does not use the CV icon")
    if not any("cv_icon" in failure or "CV icon" in failure for failure in fails):
        print("login icon: cv_icon_256.png and cv_icon_512.png, 200 without a session")

    negotiated = anonymous.get("/login", headers={"Accept-Language": "de-DE,de;q=0.9"})
    if negotiated.status_code != 200:
        fails.append(f"GET /login with an unknown Accept-Language returned {negotiated.status_code}")
    else:
        print("GET /login, unknown Accept-Language: 200")

    # M: nothing here is for a search engine.
    robots = anonymous.get("/robots.txt")
    robots_text = robots.get_data(as_text=True)
    if robots.status_code != 200 or "Disallow: /" not in robots_text or "User-agent: *" not in robots_text:
        fails.append(f"/robots.txt status {robots.status_code}, body {robots_text!r}")
    else:
        print("/robots.txt: 200 with Disallow: /")

    WANT_TAG = "noindex, nofollow, noarchive"
    for path_, response in (("/login", anonymous.get("/login")), ("/ities/", anonymous.get("/ities/"))):
        tag = response.headers.get("X-Robots-Tag", "")
        if tag != WANT_TAG:
            fails.append(f"{path_} X-Robots-Tag {tag!r}, expected {WANT_TAG!r}")
    if not any("X-Robots-Tag" in failure for failure in fails):
        print("X-Robots-Tag on /login and /ities/:", WANT_TAG)

    health = anonymous.get("/healthz")
    if health.status_code != 200 or health.data:
        fails.append(f"/healthz expected empty 200, got {health.status_code} and {len(health.data)} bytes")
    else:
        print("/healthz: empty 200 without login")

    c = authenticated_client()
    versions = c.get("/api/versions")
    if versions.status_code != 200:
        fails.append(f"/api/versions status {versions.status_code}")
    else:
        data = versions.get_json()
        defaults = [entry for entry in data if entry.get("default")] if isinstance(data, list) else []
        if len(defaults) != 1:
            fails.append("/api/versions needs exactly one default version")
        else:
            print("ITIES default:", defaults[0]["version"])

    wasm = c.get("/pyodide/pyodide.asm.wasm")
    ctype = wasm.headers.get("Content-Type", "")
    if wasm.status_code != 200 or "application/wasm" not in ctype:
        fails.append(f"wasm status/MIME {wasm.status_code} {ctype!r}")
    else:
        print("wasm MIME:", ctype)

    br = c.get("/pyodide/pyodide.asm.wasm", headers={"Accept-Encoding": "br"})
    if br.headers.get("Content-Encoding") != "br":
        fails.append(f"expected Content-Encoding br, got {br.headers.get('Content-Encoding')!r}")
    else:
        print("wasm precompression: br")

    hub = c.get("/")
    if hub.status_code != 200 or b'data-i18n="hub.title"' not in hub.data:
        fails.append(f"hub page status {hub.status_code}")
    if b'href="/peakwise/"' not in hub.data or b"hub.soon" in hub.data:
        fails.append("hub PeakWise tile is unavailable or still marked soon")

    i18n = c.get("/shared/i18n.js")
    if i18n.status_code != 200:
        fails.append(f"/shared/i18n.js status {i18n.status_code}")
    else:
        for key in (b'"hub.title"', b'"hub.ities.desc"', b'"hub.peakwise.desc"'):
            if i18n.data.count(key) != 2:
                fails.append(f"i18n key {key.decode()} not present in both languages")

    ities = c.get("/ities/")
    if ities.status_code != 200 or b"ITIES Detect" not in ities.data:
        fails.append("authenticated ITIES page")

    algo = c.get("/algo/ities_algo_v1.1.py")
    if algo.status_code != 200 or algo.headers.get("Cache-Control") != "no-cache":
        fails.append("authenticated algorithm route/cache")

    for page in ("/", "/ities/", "/peakwise/", "/ities/versions.html"):
        body = c.get(page).get_data()
        if b'name="robots" content="noindex, nofollow"' not in body:
            fails.append(f"{page} has no noindex meta tag")
    if not any("noindex meta" in failure for failure in fails):
        print("noindex meta tag: hub, ITIES, PeakWise, versions")

    # J: the partner logos are served from assets/partners with a long cache.
    for logo in ("ul-logo.png", "ahe-logo-pl.png", "airon-logo.png"):
        response = c.get("/assets/partners/" + logo)
        cache = response.headers.get("Cache-Control", "")
        if response.status_code != 200 or "max-age=" not in cache:
            fails.append(f"/assets/partners/{logo} status {response.status_code} cache {cache!r}")
    if not any("assets/partners" in failure for failure in fails):
        print("partner logos: 3 files, long cache")

    peakwise = c.get("/peakwise/")
    if peakwise.status_code != 200 or b"PeakWise" not in peakwise.data:
        fails.append(f"/peakwise/ status {peakwise.status_code}")
    else:
        print("/peakwise/ served, bytes:", len(peakwise.data))

    pw_asset = c.get("/peakwise/app.js")
    if pw_asset.status_code != 200 or pw_asset.headers.get("Cache-Control") != "no-cache":
        fails.append(
            f"/peakwise/app.js status {pw_asset.status_code} cache {pw_asset.headers.get('Cache-Control')!r}"
        )

    pwv = c.get("/algo/peakwise_versions.json")
    if pwv.status_code != 200 or "application/json" not in pwv.headers.get("Content-Type", ""):
        fails.append(f"PeakWise manifest status/MIME {pwv.status_code} {pwv.headers.get('Content-Type')!r}")
    else:
        data = pwv.get_json()
        defaults = [entry for entry in data if entry.get("default")] if isinstance(data, list) else []
        if len(defaults) != 1:
            fails.append("PeakWise manifest needs exactly one default entry")
        else:
            entry = defaults[0]
            print("PeakWise default:", entry["version"], entry["file"])
            if c.get("/algo/" + entry["file"]).status_code != 200:
                fails.append(f"/algo/{entry['file']} status is not 200")

    if fails:
        print(f"FAIL server: {len(fails)} failure(s)")
        for failure in fails:
            print(" -", failure)
        return 1
    print("PASS server: 23 checks, authentication, no indexing and protected assets")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    finally:
        AUTH_DIR.cleanup()
