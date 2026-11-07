#!/bin/sh
# probe-all.sh <kind...>: COM-probe every sweep directory's live and native exports, then gate it. SWEEP names the sweep folder
# (default sweep); SHAPES_FROM names an earlier sweep whose PowerPoint drawings of the native exports are reused (the native export
# does not change between the two, so it is not drawn again).
base=/c/opf-work/shapes/sh-19; sweep=${SWEEP:-sweep}
for k in "$@"; do
  d=$base/$sweep/$k; w=$(cygpath -w "$d"); log=$base/logs/$sweep-probe-$k.log
  powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\opf-work\shapes\sh-19\tools\com-probe.ps1' -Dir "$w\\pptx" -OutDir "$w\\ppt" > "$log" 2>&1
  if [ -n "$SHAPES_FROM" ]; then
    mkdir -p "$d/ppt-shapes" && cp "$base/$SHAPES_FROM/$k/ppt-shapes/"*.png "$d/ppt-shapes/"
  else
    powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\opf-work\shapes\sh-19\tools\com-probe.ps1' -Dir "$w\\pptx-shapes" -OutDir "$w\\ppt-shapes" >> "$log" 2>&1
  fi
  node "$base/tools/stats.mjs" "$d" > /dev/null 2>&1
  node "$base/tools/gate.mjs" "$d" > "$base/logs/$sweep-gate-$k.log" 2>&1
  echo "$k: $(head -1 "$base/logs/$sweep-gate-$k.log")"
done
