#!/bin/sh
# each.sh <package-dir> <log>: run every test file of a package on its own (node --test for *.test.mjs, node otherwise), one line per file.
cd "$1" || exit 1
exclude=$(node -e "try{const s=require('./test/suites.json');console.log([...(s.exclude||[])].join(' '))}catch{console.log('')}")
: > "$2"
for f in test/*.mjs; do
  b=$(basename "$f"); case " $exclude " in *" $b "*) continue;; esac
  case "$b" in *.test.mjs) cmd="node --test $f";; *) cmd="node $f";; esac
  if timeout 900 $cmd > "/c/opf-work/shapes/sh-19/logs/each/$(basename "$1")-$b.log" 2>&1; then echo "ok   $b" >> "$2"; else echo "FAIL $b" >> "$2"; fi
done
echo done >> "$2"
