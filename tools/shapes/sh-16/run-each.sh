#!/bin/bash
# Run each listed test command in a package directory; record failures.
dir=$1; list=$2; out=$3
cd "$dir"; : > "$out.fail"; : > "$out.log"
while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  if ! eval "$cmd" >> "$out.log" 2>&1; then echo "$cmd" >> "$out.fail"; fi
done < "$list"
echo "done: $(wc -l < "$out.fail") failed"
