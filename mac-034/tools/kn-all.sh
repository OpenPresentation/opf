#!/bin/zsh
C=${C:-/Users/michael/opf-work/mac-034-corpus}
S=${0:a:h}
LOG=$C/keynote/_log.txt
for f in "$@"; do
  b=${f:t:r}; o=$C/keynote/$b; rm -rf $o; mkdir -p $o
  shasum -a 256 $f > $o/_input-sha-before.txt
  osascript $S/kn-one.applescript $f $o > $o/_osascript.txt 2>&1 &
  P=$!; t=0
  while kill -0 $P 2>/dev/null && [ $t -lt 90 ]; do sleep 2; t=$((t+2)); [ $t -ge 4 ] && [ -n "$($S/kalert)" ] && break; done
  if kill -0 $P 2>/dev/null; then
    i=0; for w in $($S/kwinids); do screencapture -x -o -l $w $o/_hang-window-$i.png; i=$((i+1)); done
    kill $P; wait $P 2>/dev/null
    osascript -e 'tell application id "com.apple.Keynote" to close every document saving no' -e 'tell application id "com.apple.Keynote" to quit saving no' >/dev/null 2>&1 &
    Q=$!; sleep 12; kill $Q 2>/dev/null
    echo "$b FAILED-ALERT after ${t}s (windows captured: $i)" | tee -a $LOG
  else
    wait $P; st=$?
    if [ $st -ne 0 ]; then
      i=0; for w in $($S/kwinids); do screencapture -x -o -l $w $o/_error-window-$i.png; i=$((i+1)); done
      osascript -e 'tell application id "com.apple.Keynote" to close every document saving no' -e 'tell application id "com.apple.Keynote" to quit saving no' >/dev/null 2>&1 &
      Q=$!; sleep 12; kill $Q 2>/dev/null
    fi
    echo "$b exit=$st $(tr '\n' ' ' < $o/_osascript.txt | cut -c1-160)" | tee -a $LOG
  fi
  shasum -a 256 $f > $o/_input-sha-after.txt
done
