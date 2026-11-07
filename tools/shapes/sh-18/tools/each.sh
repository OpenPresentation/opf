#!/bin/sh
# each.sh <package-dir> <out-log>: run every test command of a package (run-tests.mjs --list) on its own, recording pass/fail.
cd "$1" || exit 1
: > "$2"
node ../../scripts/run-tests.mjs --list | while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  if timeout 1200 sh -c "$cmd" > /tmp/each-$$.log 2>&1; then echo "pass $cmd" >> "$2"; else echo "FAIL $cmd" >> "$2"; tail -12 /tmp/each-$$.log | sed 's/^/    /' | cut -c1-260 >> "$2"; fi
done
echo done >> "$2"
