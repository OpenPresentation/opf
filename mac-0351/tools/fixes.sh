#!/bin/zsh
# Sheets for the 0.35.1 layout fixes and the extra comparisons: 0.35.0 preview | Keynote 15.4 on 0.35.0 | 0.35.1 preview | Keynote 15.4 on 0.35.1
K=/Users/michael/opf-work/kn0351; cd $K; O=sheets/fixes; mkdir -p $O; P=prev034/mac-034/final-fdd06ce40/keynote
k() { printf '%s/slides/slides.%03d.png' $1 $2; }
four() { # out caption deck-suffix preview-subdir slide
  python3 tools/sheet3.py $O/$1.png "$2" "OPF 0.35.0 preview=fixes/v0350/$4/slide-$5.png" "Keynote 15.4, OPF 0.35.0=$(k fixes/keynote/fixes-0351$3.v0350 $5)" "OPF 0.35.1 preview=fixes/v0351/$4/slide-$5.png" "Keynote 15.4, OPF 0.35.1=$(k fixes/keynote/fixes-0351$3.v0351 $5)"; }
for i in 1 2 3 4 5 6; do four fixes-$i "fixes-0351 slide $i" "" preview $i; done
for i in 1 2 3; do four nocard-$i "fixes-0351-nocard slide $i (no content boxes)" -nocard preview-nocard $i; done
for i in 1 2; do four twocol-$i "fixes-0351-twocol slide $i" -twocol preview-twocol $i; done
for s in 10 11; do python3 tools/sheet3.py $O/layout-sampler-$s.png "layout-sampler $s: column layout record (anchor)" "OPF 0.35.1 preview=$(printf 'c0351/preview/layout-sampler/slide-%02d.png' $s)" "Keynote 15.1.1, OPF 0.34.0=$(k $P/layout-sampler $s)" "Keynote 15.4, OPF 0.35.1=$(k c0351/keynote/layout-sampler $s)"; done
for s in 2 4 5; do python3 tools/sheet3.py sheets/items/languages-$s.png "coverage-languages $s: fonts Keynote picks" "OPF 0.35.1 preview=$(printf 'c0351/preview/coverage-languages/slide-%02d.png' $s)" "Keynote 15.1.1, OPF 0.34.0=$(k $P/coverage-languages $s)" "Keynote 15.4, OPF 0.35.1=$(k c0351/keynote/coverage-languages $s)"; done
python3 tools/sheet3.py sheets/items/connector-elbow-control.png "coverage-overlays 4: is the new route OPF or Keynote?" "0.34.0 file, Keynote 15.1.1=$(k $P/coverage-overlays 4)" "same 0.34.0 file, Keynote 15.4=$(k ctl034/keynote/coverage-overlays.v0340 4)" "0.35.1 file, Keynote 15.4=$(k c0351/keynote/coverage-overlays 4)"
