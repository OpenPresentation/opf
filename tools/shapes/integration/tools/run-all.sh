#!/bin/sh
# run-all.sh <tree> <tag> [packages]: every package's node tests file by file, then the browser suites.
T=$1; TAG=$2; PKGS=${3:-"javascript render pptx editor gallery cli mcp integration"}; L=/c/opf-work/shapes/integration/logs/$TAG; TOOLS=/c/opf-work/shapes/integration/tools
export OPF_BROWSER_EXECUTABLE_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
mkdir -p $L
for p in $PKGS; do
  node $TOOLS/run-each.mjs $T/packages/$p $L/$p 4 > $L/summary-$p.txt 2>&1
done
echo finished > $L/DONE
