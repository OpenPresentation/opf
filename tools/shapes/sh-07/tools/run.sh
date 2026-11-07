#!/usr/bin/env bash
# bash run.sh <mode> [ids...]: build the pptx package, export the corpus with diagrams: <mode>, render it in PowerPoint (COM) and score it.
set -e
cd /c/opf-work/sh-07-native-diagrams && pnpm --filter @openpresentation/opf-pptx build > /c/opf-work/shapes/sh-07-build-pptx.log 2>&1
cd /c/opf-work/shapes/sh-07/tools
mode=$1; shift
node build.mjs "$mode" "$@" | grep -v "^ok [a-z0-9-]* $" | grep -v "text-overflow" || true
node list.mjs "$mode" "$@"
powershell.exe -NoProfile -File 'C:\opf-work\shapes\sh-07\tools\ppt-batch.ps1' -listFile "C:\\opf-work\\shapes\\sh-07\\$mode\\list.txt" -outRoot "C:\\opf-work\\shapes\\sh-07\\$mode\\ppt" -logFile "C:\\opf-work\\shapes\\sh-07\\$mode\\ppt-log.json" | grep -v "open=True slides=1 exported=1 rt= err=$" || true
node compare.mjs "$mode" "$@"
