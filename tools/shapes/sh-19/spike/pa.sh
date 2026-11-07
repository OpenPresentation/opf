#!/bin/sh
# pa.sh <glob...>: open each file and say whether it is live SmartArt
list=$(for f in "$@"; do cygpath -w "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"; done | tr '\n' ';')
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\opf-work\shapes\sh-19\spike\probeall.ps1' -List "$list"
