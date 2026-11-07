#!/bin/sh
# widths.sh <dir>: measure every pptx of a directory (spike measure.ps1) and print each shape's box.
/c/opf-work/shapes/sh-19/spike/run.sh "$1" >/dev/null
node -e " "$(cygpath -w "$1")"
const m=JSON.parse(require('fs').readFileSync(require('path').join(process.argv[1]||'','m.json'),'utf8').replace(/^\uFEFF/,''));
for(const d of [m].flat()){const s=[d.diagrams].flat().find(x=>x.hasSmartArt===-1); if(!s){console.log(d.file,'no smartart',d.error||'');continue;} console.log(d.file, s.layoutName, [s.shapes].flat().map(g=>g.type+':'+g.l.toFixed(2)+','+g.w.toFixed(2)).join(' '));}" "$(cygpath -w "$1")"
