#!/bin/zsh
# Second Keynote pass: object counts per slide and, for round-trip decks, a PPTX exported by Keynote. Never saves the document.
# usage: kn-probe-all.sh <corpus-dir> <roundtrip-stems...> -- <pptx files...>
C=$1; shift
S=${0:a:h}
typeset -a RT
while [ "$1" != "--" ]; do RT+=$1; shift; done; shift
for f in "$@"; do
  b=${f:t:r}; o=$C/keynote/$b; mkdir -p $o
  exp=no; (( ${RT[(Ie)$b]} )) && exp=yes
  osascript $S/kn-probe.applescript $f $o $exp > $o/_probe.txt 2>&1 &
  P=$!; t=0
  while kill -0 $P 2>/dev/null && [ $t -lt 120 ]; do sleep 2; t=$((t+2)); done
  if kill -0 $P 2>/dev/null; then
    kill $P; wait $P 2>/dev/null
    osascript -e 'tell application id "com.apple.Keynote" to close every document saving no' -e 'tell application id "com.apple.Keynote" to quit saving no' >/dev/null 2>&1 &
    Q=$!; sleep 12; kill $Q 2>/dev/null
    echo "$b PROBE HUNG" | tee -a $C/keynote/_probe-log.txt
  else
    echo "$b probe ok export=$exp $(wc -l < $o/_probe.txt) lines" | tee -a $C/keynote/_probe-log.txt
  fi
done
