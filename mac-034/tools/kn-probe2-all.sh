#!/bin/zsh
# Keynote probe pass (titles, fonts, layouts) over files; env C=<out dir>; pass absolute paths. Never saves. After an alert or a
# hang it closes every document unsaved and quits Keynote, so run it only when Keynote has no one else's documents open.
# Needs kalert (swiftc kalert.swift -o kalert) beside it. The screen must stay unlocked: Keynote's open times out while it is locked.
T=${0:a:h}
LOG=$C/keynote/_probe2-log.txt
mkdir -p $C/keynote
for f in "$@"; do
  b=${f:t:r}; o=$C/keynote/$b; mkdir -p $o
  osascript $T/kn-probe2.applescript $f > $o/_probe2.tsv 2>&1 &
  P=$!; t=0
  while kill -0 $P 2>/dev/null && [ $t -lt 180 ]; do sleep 2; t=$((t+2)); [ $t -ge 4 ] && [ -n "$($T/kalert)" ] && break; done
  if kill -0 $P 2>/dev/null; then
    kill $P; wait $P 2>/dev/null
    osascript -e 'tell application id "com.apple.Keynote" to close every document saving no' -e 'tell application id "com.apple.Keynote" to quit saving no' >/dev/null 2>&1 &
    Q=$!; sleep 12; kill $Q 2>/dev/null
    echo "$b PROBE FAILED after ${t}s" | tee -a $LOG
  else
    wait $P; st=$?
    echo "$b probe exit=$st $(grep -c '^slide' $o/_probe2.tsv) slides" | tee -a $LOG
  fi
done
