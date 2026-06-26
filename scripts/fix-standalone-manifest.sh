#!/bin/sh
# Fix: Next.js standalone fails to generate client-reference-manifest for route group layouts.
set -e

LAYOUT_DIR=".next/server/app/(dashboard)"
MANIFEST="${LAYOUT_DIR}/page_client-reference-manifest.js"
STANDALONE_DIR=".next/standalone/.next/server/app/(dashboard)"

if [ -f "${LAYOUT_DIR}/page.js" ] && [ ! -f "$MANIFEST" ]; then
  printf '%s' 'globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/(dashboard)/page"]={"moduleLoading":{"prefix":"/_next/"},"ssrModuleMapping":{},"edgeSSRModuleMapping":{},"clientModules":{},"entryCSSFiles":{},"rscModuleMapping":{}}' > "$MANIFEST"
fi

if [ -f "$MANIFEST" ] && [ -d "$STANDALONE_DIR" ]; then
  cp "$MANIFEST" "$STANDALONE_DIR/"
fi