#!/usr/bin/env bash
# Packages the extension for the Chrome Web Store.
# Allowlist, not exclude-list: anything not named here never reaches the zip.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

VERSION="$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')"
STAGE="$(mktemp -d)"
OUT="$ROOT/dist"
ZIP="$OUT/baitblocker-$VERSION.zip"

FILES=(
  manifest.json
  config.js
  background.js
  content.js
  overlay.css
  brand.css
  popup.html popup.js popup.css
  control.html control.js control.css
)

trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$OUT"
rm -f "$ZIP"

for file in "${FILES[@]}"; do
  [ -f "$file" ] || { echo "missing: $file" >&2; exit 1; }
  cp "$file" "$STAGE/"
done

# Named, not globbed: concept art and working files live in these directories too.
mkdir -p "$STAGE/icons" "$STAGE/fonts"
for size in 16 32 48 128; do
  cp "icons/baitblocker-$size.png" "$STAGE/icons/"
done
cp fonts/*.ttf fonts/OFL-*.txt "$STAGE/fonts/"

# Store review rejects archives carrying macOS metadata.
find "$STAGE" -name '.DS_Store' -delete
find "$STAGE" -name '._*' -delete

python3 -c "import json,sys; json.load(open('$STAGE/manifest.json'))"

( cd "$STAGE" && zip -qrX "$ZIP" . )

echo "built $ZIP"
unzip -l "$ZIP" | tail -n 3
python3 - "$ZIP" <<'PY'
import sys, zipfile

expected = {
    'manifest.json', 'config.js', 'background.js', 'content.js',
    'overlay.css', 'brand.css',
    'popup.html', 'popup.js', 'popup.css',
    'control.html', 'control.js', 'control.css',
    'icons/baitblocker-16.png', 'icons/baitblocker-32.png',
    'icons/baitblocker-48.png', 'icons/baitblocker-128.png',
    'fonts/besley-400.ttf', 'fonts/besley-600.ttf', 'fonts/besley-italic-400.ttf',
    'fonts/chivo-mono-400.ttf', 'fonts/chivo-mono-500.ttf', 'fonts/chivo-mono-700.ttf',
    'fonts/righteous-400.ttf',
    'fonts/OFL-Besley.txt', 'fonts/OFL-Chivo-Mono.txt', 'fonts/OFL-Righteous.txt',
}

names = {n for n in zipfile.ZipFile(sys.argv[1]).namelist() if not n.endswith('/')}
extra = sorted(names - expected)
missing = sorted(expected - names)
assert not extra, f"unexpected entries: {extra}"
assert not missing, f"missing entries: {missing}"
print(f"{len(names)} files, exactly the expected manifest")
PY
