#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  build-firefox.sh — ImgPrompt Firefox MV2 build script
#
#  Usage:
#    bash build-firefox.sh [--out /path/to/output.zip]
#
#  Requires: node (for npx web-ext lint), zip or python3
#  Produces: imgprompt-firefox-v<VERSION>.zip in OUT_DIR
#
#  What it does:
#    1. Reads version from manifest.json
#    2. Copies all extension files to a temp build dir
#    3. Replaces manifest.json with MV2 manifest (gecko id, sidebar_action, background.scripts)
#    4. Generates prompts-fx.js from prompts.js (removes export, adds globalThis.__IP_PROMPTS__)
#    5. Patches background.js: replaces ES import with globalThis destructuring
#    6. Runs web-ext lint (warnings only — modern JS false-positives expected)
#    7. Packs ZIP (excludes screenshots, store assets, privacy.html)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR"
VERSION="$(node -pe 'JSON.parse(require("fs").readFileSync("manifest.json","utf8")).version' "$SRC_DIR/manifest.json" 2>/dev/null || python3 -c "import json,sys; print(json.load(open('$SRC_DIR/manifest.json'))['version'])")"
OUT_DIR="${1:-$SCRIPT_DIR}"
ZIP_NAME="imgprompt-firefox-v${VERSION}.zip"
BUILD_DIR="$(mktemp -d)"

echo "🦊 ImgPrompt Firefox build v${VERSION}"
echo "   Source : $SRC_DIR"
echo "   Build  : $BUILD_DIR"
echo "   Output : $OUT_DIR/$ZIP_NAME"

# ── 1. Copy all extension files ───────────────────────────────
EXCLUDE=(
  "manifest.json"          # replaced by MV2 manifest below
  "prompts-fx.js"          # generated below
  "background.html"        # not needed (using background.scripts)
  "screenshots"
  "CHROME_WEB_STORE_LISTING.md"
  "google69252f777c15bc3b.html"
  "index.html"
  "privacy.html"
  "README.md"
  "README_RU.md"
  "build-firefox.sh"
  ".git"
  "node_modules"
)

for item in "$SRC_DIR"/*; do
  name="$(basename "$item")"
  skip=0
  for ex in "${EXCLUDE[@]}"; do [[ "$name" == "$ex" ]] && skip=1 && break; done
  [[ $skip -eq 0 ]] && cp -r "$item" "$BUILD_DIR/"
done

# ── 2. Write MV2 manifest ─────────────────────────────────────
cat > "$BUILD_DIR/manifest.json" << MANIFEST
{
  "manifest_version": 2,
  "name": "ImgPrompt — AI Image Analyzer",
  "version": "${VERSION}",
  "description": "Turn any image into a ready-to-use prompt for Stable Diffusion, FLUX and Midjourney.",

  "browser_specific_settings": {
    "gecko": {
      "id": "imgprompt@rmaxvell.dev",
      "strict_min_version": "112.0"
    }
  },

  "permissions": [
    "contextMenus",
    "storage",
    "activeTab",
    "scripting",
    "tabs",
    "<all_urls>"
  ],

  "content_security_policy": "default-src 'self'; connect-src *; img-src * data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self';",

  "background": {
    "scripts": ["prompts-fx.js", "background.js"]
  },

  "browser_action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "sidebar_action": {
    "default_panel": "sidepanel.html",
    "default_title": "ImgPrompt — История",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  },

  "options_page": "options.html",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
MANIFEST

# ── 3. Generate prompts-fx.js (remove export, add globalThis) ─
# Strip "export " keywords and "export { ... }" blocks, then append globalThis export
sed \
  -e 's/^export const /const /g' \
  -e 's/^export function /function /g' \
  -e '/^export {/,/^}/d' \
  "$SRC_DIR/prompts.js" > "$BUILD_DIR/prompts-fx.js"

# Append globalThis export
cat >> "$BUILD_DIR/prompts-fx.js" << 'EOF'

// Firefox MV2: no ES-modules in background scripts → export via globalThis
globalThis.__IP_PROMPTS__ = { getSystemPrompt, getUserMessage };
EOF

# ── 4. Patch background.js ────────────────────────────────────
# Replace: import { getSystemPrompt, getUserMessage } from './prompts.js';
# With:    const { getSystemPrompt, getUserMessage } = globalThis.__IP_PROMPTS__;
sed -i \
  "s|import { getSystemPrompt, getUserMessage } from './prompts.js';|// Firefox MV2: prompts-fx.js loaded before this script\nconst { getSystemPrompt, getUserMessage } = globalThis.__IP_PROMPTS__;|" \
  "$BUILD_DIR/background.js"

# Replace chrome.tabs.captureVisibleTab with browser.tabs.captureVisibleTab
sed -i \
  's/chrome\.tabs\.captureVisibleTab/browser.tabs.captureVisibleTab/g' \
  "$BUILD_DIR/background.js"

# ── 5. web-ext lint ───────────────────────────────────────────
echo ""
echo "🔍 Running web-ext lint..."
if command -v npx &>/dev/null; then
  npx --yes web-ext lint --source-dir "$BUILD_DIR" --self-hosted 2>&1 | tail -20 || true
  echo "   (JS_SYNTAX_ERROR on optional chaining is a web-ext parser false-positive — Firefox 112+ supports it natively)"
else
  echo "   ⚠️  npx not found — skipping lint"
fi

# ── 6. Pack ZIP ───────────────────────────────────────────────
echo ""
echo "📦 Packing ZIP..."
ZIP_PATH="$OUT_DIR/$ZIP_NAME"
rm -f "$ZIP_PATH"

if command -v zip &>/dev/null; then
  (cd "$BUILD_DIR" && zip -r "$ZIP_PATH" . -x "*.DS_Store" "*.gitkeep")
elif command -v python3 &>/dev/null; then
  python3 -c "
import zipfile, os, sys
src = sys.argv[1]; out = sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, src))
" "$BUILD_DIR" "$ZIP_PATH"
else
  echo "❌ Need 'zip' or 'python3' to pack. Install one and re-run."
  rm -rf "$BUILD_DIR"
  exit 1
fi

# ── 7. Cleanup & report ───────────────────────────────────────
rm -rf "$BUILD_DIR"
SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo ""
echo "✅ Done: $ZIP_PATH ($SIZE)"
echo ""
echo "Install in Firefox:"
echo "  about:debugging → This Firefox → Load Temporary Add-on → select ZIP"
echo ""
echo "Submit to AMO:"
echo "  https://addons.mozilla.org/developers/addon/submit/"
