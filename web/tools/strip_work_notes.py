#!/usr/bin/env python3
"""Remove working notes from the staged site: HTML comments and spec references in comments.

Runs on the deployment copy only; the sources keep their notes.
"""
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])
SKIP = {"pyodide", "vendor"}
HTML_COMMENT = re.compile(r"[ \t]*<!--.*?-->[ \t]*\n?", re.S)
REFERENCE = re.compile(r" ?\((?:brief [^()]*|addendum [^()]*)\)")
count = 0
for path in ROOT.rglob("*"):
    if not path.is_file() or SKIP.intersection(path.relative_to(ROOT).parts):
        continue
    if path.suffix == ".html":
        pattern = HTML_COMMENT
    elif path.suffix in (".js", ".css"):
        pattern = REFERENCE
    else:
        continue
    source = path.read_text(encoding="utf-8")
    cleaned = pattern.sub("", source)
    if cleaned != source:
        path.write_text(cleaned, encoding="utf-8")
        count += 1
print(f"work notes removed from {count} files")
