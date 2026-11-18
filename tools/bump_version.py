#!/usr/bin/env python3
"""Give the site's CSS and JavaScript a new version tag, so browsers download the new code right after an update.

    python tools/bump_version.py

GitHub Pages lets browsers keep files for 10 minutes. Without a new tag, a visitor can get
the new page together with old cached scripts, and things like the language button stop working.
Run this after changing anything in assets/css or assets/js, then commit and push.
Not needed for changes made from the admin dashboard: those only change data and images.

Every page (*.html) and every module in assets/js gets the same tag, so all pages share one
copy of each module.
"""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAG = re.compile(r"(\.(?:js|css))\?v=[\w.-]+")


def main():
    version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    files = sorted(ROOT.glob("*.html")) + sorted((ROOT / "assets" / "js").glob("*.js"))
    total = 0
    for path in files:
        with open(path, encoding="utf-8", newline="") as fh:  # keep the file's own line endings
            text = fh.read()
        updated, count = TAG.subn(rf"\g<1>?v={version}", text)
        if not count:
            continue
        with open(path, "w", encoding="utf-8", newline="") as fh:
            fh.write(updated)
        total += count
        print(f"{path.relative_to(ROOT).as_posix()}: {count} tag(s) -> v={version}")
    if not total:
        sys.exit("No ?v= tags found; expected links like app.js?v=123")


if __name__ == "__main__":
    main()
