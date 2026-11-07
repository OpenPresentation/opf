#!/usr/bin/env bash
# bash each.sh <package dir> <log>: run every test file of a package one by one (node, or node --test for *.test.mjs), logging pass/fail.
cd "$1" || exit 1
log=$2
: > "$log"
for f in test/*.mjs; do
  case "$f" in *helpers*|*support*) continue;; esac
  if [[ "$f" == *.test.mjs ]]; then out=$(timeout 600 node --test "$f" 2>&1); else out=$(timeout 600 node "$f" 2>&1); fi
  code=$?
  if [ $code -eq 0 ]; then echo "ok   $f" >> "$log"; else echo "FAIL $f ($code): $(echo "$out" | grep -m3 -E 'Error|✖|assert' | tr '\n' ' ' | cut -c1-300)" >> "$log"; fi
done
echo DONE >> "$log"
