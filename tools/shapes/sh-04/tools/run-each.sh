#!/usr/bin/env bash
# Run every test command of a package one by one (scripts/run-tests.mjs --list) and record pass/fail, so one failure does not hide the rest.
# usage: run-each.sh <package dir> <log>
pkg="$1"; log="$2"
cd "/c/opf-work/sh-04-overlays-connectors/$pkg" || exit 2
: > "$log"
node ../../scripts/run-tests.mjs --list > "$log.cmds"
while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  if out=$(eval "$cmd" 2>&1); then echo "PASS $cmd" >> "$log"; else echo "FAIL $cmd" >> "$log"; echo "$out" | tail -40 | sed 's/^/    /' >> "$log"; fi
done < "$log.cmds"
echo "done $(grep -c '^PASS' "$log") passed, $(grep -c '^FAIL' "$log") failed" >> "$log"
