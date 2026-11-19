"""
Hermidiate website – make a backup of the current version.

Run it in the VS Code terminal (Terminal → New Terminal), inside this folder:

    python make-backup.py                 → _backup-2026-11-18-1745.zip
    python make-backup.py before-new-hero → _backup-2026-11-18-1745-before-new-hero.zip

The zip contains every file of the site, except .git, node_modules and older backups.

To go back to a backup: unzip it into this folder and replace the files
(right-click the zip in Windows Explorer → Extract All…).
"""
import os
import sys
import zipfile
from datetime import datetime

SKIP_DIRS = {".git", "node_modules"}

folder = os.path.dirname(os.path.abspath(__file__))
label = "-" + "-".join(sys.argv[1:]).replace(" ", "-") if len(sys.argv) > 1 else ""
name = "_backup-" + datetime.now().strftime("%Y-%m-%d-%H%M") + label + ".zip"
target = os.path.join(folder, name)

count = 0
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.startswith("_backup"):
                continue
            path = os.path.join(root, f)
            z.write(path, os.path.relpath(path, folder))
            count += 1

print(f"Saved {name} ({count} files)")
