#!/usr/bin/env bash
# bash run-design.sh <design> '<design json>' [lang] [corpus file]: the shapes comparison in one design, under ../designs/<design>.
set -e
design=$1; json=$2; lang=${3:-en-US}; corpus=${4:-C:/opf-work/shapes/sh-07/sources/corpus.txt}
export SH07_ROOT="C:/opf-work/shapes/sh-07/designs/$design" SH07_DESIGN="$json" SH07_LANG="$lang"
mkdir -p "$SH07_ROOT/sources" && cp "$corpus" "$SH07_ROOT/sources/corpus.txt"
cd /c/opf-work/shapes/sh-07/tools
node build.mjs shapes | grep -v "^ok [a-z0-9-]* $" | grep -v "text-overflow" || true
node list.mjs shapes
win=$(echo "$SH07_ROOT" | sed 's#/#\\#g')
powershell.exe -NoProfile -File 'C:\opf-work\shapes\sh-07\tools\ppt-batch.ps1' -listFile "$win\\shapes\\list.txt" -outRoot "$win\\shapes\\ppt" -logFile "$win\\shapes\\ppt-log.json" | grep -v "open=True slides=1 exported=1 rt= err=$" || true
node compare.mjs shapes > "$SH07_ROOT/scores.txt"
node geom.mjs shapes > "$SH07_ROOT/geometry.txt"
node textpos.mjs shapes > "$SH07_ROOT/textpos.txt"
echo "done $design"
