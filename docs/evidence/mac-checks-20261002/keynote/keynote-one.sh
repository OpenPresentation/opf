#!/bin/bash
# Supervisor-only Keynote run for one deck: open, export PDF + PPTX, close WITHOUT saving (no .key is ever written).
# Usage: keynote-one.sh <deck-id>   (runs in the keynote-set directory; 90 s deadline enforced by perl alarm)
set -u
cd "$(dirname "$0")"
id="$1"
src="$PWD/decks/$id.pptx"; pdf="$PWD/out/$id.pdf"; ppt="$PWD/out/$id.pptx"
rm -f "$pdf" "$ppt"
perl -e 'alarm 90; exec @ARGV' osascript <<EOF 2>"out/$id.osascript.err"
with timeout of 85 seconds
  tell application id "com.apple.Keynote"
    set d to open (POSIX file "$src")
    delay 1
    export d to (POSIX file "$pdf") as PDF with properties {PDF image quality:Best}
    export d to (POSIX file "$ppt") as Microsoft PowerPoint
    close d saving no
  end tell
end timeout
EOF
rc=$?
[ -s "out/$id.osascript.err" ] || rm -f "out/$id.osascript.err"
echo "$id rc=$rc pdf=$([ -s "$pdf" ] && echo yes || echo no) pptx=$([ -s "$ppt" ] && echo yes || echo no)"
