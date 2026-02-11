#!/bin/bash
# Build the signal-notification Unraid plugin package
set -e
cd "$(dirname "$0")"

VERSION=$(date +%Y.%m.%d)
PKG="signal-notification"
OUT="release"

mkdir -p "$OUT"

# Build .txz package from source tree
echo "Building ${PKG}.txz (version ${VERSION})..."
cd src
# macOS tar doesn't support --owner/--group, use gtar if available
if command -v gtar &>/dev/null; then
  gtar cJf "../${OUT}/${PKG}.txz" --owner=root --group=root usr/
else
  tar cJf "../${OUT}/${PKG}.txz" usr/
fi
cd ..

# Calculate MD5
MD5=$(md5 -q "${OUT}/${PKG}.txz" 2>/dev/null || md5sum "${OUT}/${PKG}.txz" | cut -d' ' -f1)
echo "MD5: ${MD5}"

# Update MD5 in .plg file
if [[ -f "${PKG}.plg" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/<!ENTITY MD5 \".*\">/<!ENTITY MD5 \"${MD5}\">/" "${PKG}.plg"
    sed -i '' "s/<!ENTITY version \".*\">/<!ENTITY version \"${VERSION}\">/" "${PKG}.plg"
  else
    sed -i "s/<!ENTITY MD5 \".*\">/<!ENTITY MD5 \"${MD5}\">/" "${PKG}.plg"
    sed -i "s/<!ENTITY version \".*\">/<!ENTITY version \"${VERSION}\">/" "${PKG}.plg"
  fi
  echo "Updated .plg with MD5=${MD5} version=${VERSION}"
fi

echo "Done. Package: ${OUT}/${PKG}.txz"
