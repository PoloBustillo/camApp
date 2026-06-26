#!/usr/bin/env bash
# Fix: Next.js standalone fails to generate client-reference-manifest for route group layouts.
set -e

LAYOUT_DIR=".next/server/app/(dashboard)"
MANIFEST="${LAYOUT_DIR}/page_client-reference-manifest.js"
STANDALONE_DIR=".next/standalone/.next/server/app/(dashboard)"

if [ -f "${LAYOUT_DIR}/page.js" ] && [ ! -f "$MANIFEST" ]; then
  echo "🔧 Creating missing client reference manifest for dashboard layout..."
  echo 'globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/(dashboard)/page"]={"moduleLoading":{"prefix":"/_next/"},"ssrModuleMapping":{},"edgeSSRModuleMapping":{},"clientModules":{},"entryCSSFiles":{},"rscModuleMapping":{}}' > "$MANIFEST"
  echo "✅ Manifest created"
fi

# Copy to standalone output (build step already tried and failed, we need to fill the gap)
if [ -f "$MANIFEST" ] && [ -d "$STANDALONE_DIR" ]; then
  cp "$MANIFEST" "$STANDALONE_DIR/"
  echo "✅ Copied manifest to standalone output"
fi
