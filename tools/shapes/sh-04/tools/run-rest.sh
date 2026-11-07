#!/usr/bin/env bash
# Run the test commands of a package that are not yet PASS in a previous log (run-each.sh), appending to a new log.
# usage: run-rest.sh <package dir> <previous log> <log>
pkg="$1"; prev="$2"; log="$3"
cd "/c/opf-work/sh-04-overlays-connectors/$pkg" || exit 2
: > "$log"
node ../../scripts/run-tests.mjs --list > "$log.cmds"
while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  if [ -f "$prev" ] && grep -qxF "PASS $cmd" "$prev"; then echo "PASS $cmd (earlier)" >> "$log"; continue; fi
  if out=$(eval "$cmd" 2>&1); then echo "PASS $cmd" >> "$log"; else echo "FAIL $cmd" >> "$log"; echo "$out" | tail -40 | sed 's/^/    /' >> "$log"; fi
done < "$log.cmds"
echo "done $(grep -c '^PASS' "$log") passed, $(grep -c '^FAIL' "$log") failed" >> "$log"
