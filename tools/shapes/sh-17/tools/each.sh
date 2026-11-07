#!/bin/sh
# each.sh <package-dir> <out-log>: run every test file of a package on its own (what run-tests.mjs would run), recording pass/fail.
cd "$1" || exit 1
for f in $(node -e "
const fs=require('fs');const s=fs.existsSync('test/suites.json')?JSON.parse(fs.readFileSync('test/suites.json','utf8')):{};
const skip=new Set([...(s.exclude??[]),...(s.include??[])]);
for(const f of fs.readdirSync('test').filter(f=>/\.mjs$/.test(f)&&!/-browser/.test(f)&&!skip.has(f)).sort())console.log(f)"); do
  case $f in *.test.mjs) cmd="node --test test/$f";; *) cmd="node test/$f";; esac
  if timeout 900 $cmd > /tmp/each-$$.log 2>&1; then echo "pass $f" >> "$2"; else echo "FAIL $f" >> "$2"; tail -15 /tmp/each-$$.log | sed 's/^/    /' | cut -c1-240 >> "$2"; fi
done
echo done >> "$2"
