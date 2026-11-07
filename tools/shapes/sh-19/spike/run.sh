#!/bin/sh
# run.sh <dir> [frames] [counts] : measure every pptx of <dir> into <dir>/m.json
d=$(cygpath -w "$1"); list=$(ls "$(cd "$1" && pwd)"/*.pptx | xargs -n1 cygpath -w | tr '\n' ';')
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\opf-work\shapes\sh-19\spike\measure.ps1' -List "$list" -Out "$d\m.json" ${2:+-Frames "$2"} ${3:+-Counts "$3"} -Png
