#!/bin/sh
# redo.sh <kind> <id...>: export these sweep4 decks again (preview, live, native shapes), draw them in PowerPoint (COM), and merge the
# drawings and probe records into the sweep; then gate the kind again.
base=/c/opf-work/shapes/sh-19; k=$1; shift; d=$base/sweep4/$k; t=$base/redo/$k; CLI=/c/opf-work/sh-19-smartart-layouts/packages/cli/dist/index.js
mkdir -p "$t/pptx" "$t/pptx-shapes" "$t/ppt" "$t/ppt-shapes" "$d/pptx-shapes"
for id in "$@"; do
  node $CLI convert "$d/decks/$id.opf.json" "$d/preview/$id-1.png" --force > /dev/null
  node $CLI convert "$d/decks/$id.opf.json" "$t/pptx/$id.pptx" --force > /dev/null
  node $CLI convert "$d/decks/$id.opf.json" "$t/pptx-shapes/$id.pptx" --force --smart-art shapes > /dev/null
  cp "$t/pptx/$id.pptx" "$d/pptx/"; cp "$t/pptx-shapes/$id.pptx" "$d/pptx-shapes/"
done
w=$(cygpath -w "$t")
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\opf-work\shapes\sh-19\tools\com-probe.ps1' -Dir "$w\\pptx" -OutDir "$w\\ppt" > "$base/logs/redo-$k.log" 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\opf-work\shapes\sh-19\tools\com-probe.ps1' -Dir "$w\\pptx-shapes" -OutDir "$w\\ppt-shapes" >> "$base/logs/redo-$k.log" 2>&1
cp "$t/ppt/"*.png "$d/ppt/"; cp "$t/ppt-shapes/"*.png "$d/ppt-shapes/"
node -e "
const fs = require('fs'), read = f => [JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''))].flat();
const all = read('$d/ppt/probe.json'), fresh = read('$t/ppt/probe.json'), ids = new Set(fresh.map(x => x.file));
fs.writeFileSync('$d/ppt/probe.json', JSON.stringify([...all.filter(x => !ids.has(x.file)), ...fresh], null, 1));
const meta = JSON.parse(fs.readFileSync('$d/meta.json', 'utf8'));
for (const id of ids) { const r = JSON.parse(require('child_process').execFileSync('node', ['$CLI', 'convert', '$d/decks/' + id + '.opf.json', '$t/x.pptx', '--force'], { encoding: 'utf8' }));
  meta[id + '-1'] = { ...meta[id + '-1'], findings: [...new Set((r.findings ?? []).filter(f => !/typeface-not-office-safe/.test(f.ruleId)).map(f => f.ruleId + ': ' + f.message))] }; }
fs.writeFileSync('$d/meta.json', JSON.stringify(meta, null, 2));"
node "$base/tools/stats.mjs" "$d" > /dev/null 2>&1
node "$base/tools/gate.mjs" "$d" | head -1
