cd /c/opf-work/sh-03-effects/packages/pptx
tail -n +78 /c/opf-work/shapes/sh-03/work/pptx-tests.txt | while read -r cmd; do
  if eval "$cmd" > /c/opf-work/shapes/sh-03/work/last-test.log 2>&1; then echo "PASS $cmd"; else echo "FAIL $cmd"; tail -n 8 /c/opf-work/shapes/sh-03/work/last-test.log | sed 's/^/    /'; fi
done
echo DONE
