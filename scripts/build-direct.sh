#!/bin/bash
set -e

cd "$(dirname "$0")/.."

TARGET_DIR="${CARGO_TARGET_DIR:-$PWD/.build/tauri-target}"
OUTPUT_DIR="$PWD/release"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build unsigned app + dmg, and skip updater signature artifacts.
CARGO_TARGET_DIR="$TARGET_DIR" ./node_modules/.bin/tauri build --no-sign --config '{"bundle":{"createUpdaterArtifacts":false}}' "$@"

APP_PATH="$TARGET_DIR/release/bundle/macos/Usage.app"
DMG_PATH="$(ls -1 "$TARGET_DIR"/release/bundle/dmg/Usage_*.dmg | head -n 1)"

cp -R "$APP_PATH" "$OUTPUT_DIR/Usage.app"
cp "$DMG_PATH" "$OUTPUT_DIR/"

echo ""
echo "✓ Direct distribution build complete:"
echo "  App: $OUTPUT_DIR/Usage.app"
echo "  DMG: $OUTPUT_DIR/$(basename "$DMG_PATH")"
