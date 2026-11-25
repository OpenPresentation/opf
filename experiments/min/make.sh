#!/bin/sh
# Minimal decks of grades/reopen-list.txt (plus RT-01, RT-02 and two LY-05 separator controls) -> build/<ver>/x-min/<id>/
W=/Users/michael/opf-work/keynote-036
{
  cut -f1,2 $W/grades/reopen-list.txt | sed 's/^/036\t/'
  printf '036\t%s\tRT-01\n036\t%s\tRT-02\n' $W/grades/roundtrip/min/RT-01.opf.json $W/grades/roundtrip/min/RT-02.opf.json
  printf '036\t%s\tLY-05-dash\n036\t%s\tLY-05-space\n' $W/experiments/min/LY-05-dash.opf.json $W/experiments/min/LY-05-space.opf.json
  for id in MX-01 MX-03 SW-01 RT-01; do awk -F"\t" -v id=$id '$2==id' $W/grades/reopen-list.txt | cut -f1 | sed "s/^/0351\t/;s/\$/\t$id/"; done
  printf '0351\t%s\tRT-01\n' $W/grades/roundtrip/min/RT-01.opf.json
} | sort -u | awk -F'\t' 'NF==3' > $W/experiments/min/jobs.tsv
cat $W/experiments/min/jobs.tsv | xargs -P 4 -L 1 sh -c '$0/bin/build-deck --force "$1" x-min "$2" "$3"' $W
