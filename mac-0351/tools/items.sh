#!/bin/zsh
# Sheets for the issue #1278 items: OPF 0.35.1 preview | Keynote on 0.34.0 | Keynote on 0.35.1
K=/Users/michael/opf-work/kn0351; P=$K/prev034/mac-034/final-fdd06ce40/keynote; O=$K/sheets/items; mkdir -p $O
pv() { local f=$1/slide-$2.png; [ -f $f ] || f=$(printf "%s/slide-%02d.png" $1 $2); echo $f; }
k() { printf '%s/slides/slides.%03d.png' $1 $2; }
one() { # id deck slide caption
  python3 $K/tools/sheet3.py $O/$1.png "$4" "OPF 0.35.1 preview=$(pv $K/c0351/preview/${2%%~*} $3)" "Keynote 15.1.1, OPF 0.34.0=$(k $P/$2 $3)" "Keynote 15.4, OPF 0.35.1=$(k $K/c0351/keynote/$2 $3)"
}
one negative-bar coverage-charts 15 "coverage-charts 15: negative-value bar chart category labels"
one radar-lines coverage-charts 5 "coverage-charts 5: lines-only radar"
one area-gap coverage-charts 13 "coverage-charts 13: area chart gap at Sep"
one secondary-axis coverage-charts 14 "coverage-charts 14: secondary axis labels"
one bg-alpha coverage-backgrounds 5 "coverage-backgrounds 5: solid background at 85% alpha"
one bg-gradient coverage-backgrounds 6 "coverage-backgrounds 6: three-stop gradient background"
one bg-tile coverage-backgrounds 11 "coverage-backgrounds 11: tiled picture background"
one connector-elbow coverage-overlays 4 "coverage-overlays 4: elbow connector route"
for s in 3 4 5; do one connectors-shape-overlays-$s shape-overlays $s "shape-overlays $s: curved and elbow connectors"; done
for s in 1 2 4; do one footer-slidenum-$s footers $s "footers $s: text beside the slide-number field"; done
one footer-static-1 footers~static 1 "footers~static 1: static slide numbers"
one footer-dsa-3 data-story-academy 3 "data-story-academy 3: footer / 16"
for d in digits-ar-SA digits-ar-SA-u-nu-latn digits-fa-IR; do
  python3 $K/tools/sheet3.py $O/rtl-table-$d.png "$d 4: right-to-left table" "OPF 0.35.1 preview=$K/digits/v0351/preview/$d/slide-4.png" "Keynote 15.1.1, OPF 0.34 RC=$K/prev034/digits-k/$d-4.png" "Keynote 15.4, OPF 0.35.1=$(k $K/digits/v0351/keynote/$d 4)"
  python3 $K/tools/sheet3.py $O/footer-$d-1.png "$d 1: footer slide number / count" "OPF 0.35.1 preview=$K/digits/v0351/preview/$d/slide-1.png" "Keynote 15.1.1, OPF 0.34 RC=$K/prev034/digits-k/$d-1.png" "Keynote 15.4, OPF 0.35.1=$(k $K/digits/v0351/keynote/$d 1)"
done
ls $O | wc -l
