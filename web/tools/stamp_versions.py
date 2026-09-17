#!/usr/bin/env python3
"""Stamp every first-party module and stylesheet reference with a content hash.

Why: the public host sits behind Cloudflare, which caches .js/.css at the edge and
tells browsers to keep them for four hours, ignoring the origin's Cache-Control.
After a deploy, a browser would run a cached app.js against the new index.html and
crash. A ?v=<hash> suffix makes every changed file a new URL, so caches cannot mix
versions. This runs on a staging copy at bundle time; the source tree stays plain.

Usage: stamp_versions.py <staging static dir> [version]
Prints the stamp it used. Vendor and Pyodide paths are left alone (immutable cache).
"""
import hashlib
import re
import sys
from pathlib import Path

SKIP = ("/vendor/", "/pyodide/")
TEXT_SUFFIXES = {".js", ".mjs", ".html", ".css"}


def content_stamp(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if path.suffix in TEXT_SUFFIXES and path.is_file() and not any(s.strip("/") in path.parts for s in SKIP):
            digest.update(path.relative_to(root).as_posix().encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()[:10]


def stamp_url(url: str, stamp: str) -> str:
    if "?" in url or any(url.startswith(s) or s in url for s in SKIP):
        return url
    if not (url.startswith("/") or url.startswith("./") or url.startswith("../")):
        return url
    if not re.search(r"\.(js|mjs|css)$", url):
        return url
    return f"{url}?v={stamp}"


def rewrite(text: str, stamp: str) -> tuple[str, int]:
    count = 0

    def sub_attr(m):
        nonlocal count
        new = stamp_url(m.group(3), stamp)
        if new != m.group(3):
            count += 1
        return f"{m.group(1)}={m.group(2)}{new}{m.group(2)}"

    def sub_import(m):
        nonlocal count
        new = stamp_url(m.group(2), stamp)
        if new != m.group(2):
            count += 1
        return f"{m.group(1)}{new}{m.group(1)}"

    text = re.sub(r'\b(src|href)=(["\'])([^"\']+\.(?:js|mjs|css))\2', sub_attr, text)
    # import ... from "x.js", import "x.js", new URL("x.js", import.meta.url)
    text = re.sub(
        r'(?<=\bfrom\s)\s*(["\'])([^"\']+\.(?:js|mjs))\1'
        r'|(?<=\bimport\s)\s*(["\'])([^"\']+\.(?:js|mjs))\3',
        lambda m: sub_import(type("M", (), {"group": lambda self, i, m=m: (m.group(1) or m.group(3)) if i == 1 else (m.group(2) or m.group(4))})()),
        text,
    )
    text = re.sub(r'new URL\((["\'])([^"\']+\.(?:js|mjs))\1', lambda m: f"new URL({m.group(1)}{stamp_url(m.group(2), stamp)}{m.group(1)}", text)
    return text, count


def main() -> int:
    root = Path(sys.argv[1]).resolve()
    stamp = sys.argv[2] if len(sys.argv) > 2 else content_stamp(root)
    total = 0
    for path in sorted(root.rglob("*")):
        if path.suffix not in TEXT_SUFFIXES or not path.is_file():
            continue
        if any(s.strip("/") in path.parts for s in SKIP):
            continue
        text = path.read_text(encoding="utf-8")
        new, n = rewrite(text, stamp)
        if new != text:
            path.write_text(new, encoding="utf-8")
            total += max(n, 1)
    print(f"stamp {stamp}: {total} references rewritten under {root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
