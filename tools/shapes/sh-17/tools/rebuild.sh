#!/bin/sh
# rebuild.sh [core] [render] [pptx] [gallery]
export npm_config_store_dir='C:\opf-work\.pnpm-store'
W=/c/opf-work/sh-17-linear-smartart/packages
for p in "$@"; do
  case $p in core) d=javascript;; *) d=$p;; esac
  (cd $W/$d && if [ $p = gallery ]; then node scripts/build.mjs; else pnpm run build; fi) > /c/opf-work/shapes/sh-17/build-$p.log 2>&1 || { echo "build $p failed"; tail -20 /c/opf-work/shapes/sh-17/build-$p.log; exit 1; }
done
echo built "$@"
