# RR-45 CI speed (opf#368): evidence

## Item 2: metric-outline check, previous against new

`metric-outline-equivalence.mjs` runs the previous `scripts/test-metric-outline-browser.mjs` (from `origin/main` at
`23777616`) and the new one on all 96 cases, unmutated and under three mutations, and compares them:

- verdicts: every case's failure list, line for line;
- per part (276 visible parts): the previous pixel count and outside-pixel list against the new `ink` and `outside`;
- pixels: every previous per-part mask PNG against the same region of the new per-case screenshot (decoded RGB, byte
  for byte), for the unmutated run and the ink-shift run.

Mutations: `cell-inset-3px` shrinks the accepted cell by 3 px on every side; `ink-shift-40px` moves every mask's text
40 px right (real ink painted outside the cell); `ink-shift-down-200px` moves it 200 px down (the metric cells are tall
enough that this stays inside, in both versions).

Result (`metric-outline-equivalence.json`, macOS arm64, Node 26.7, Playwright 1.63.0 Chromium, renderer `1d2f3eb`):

| Run | Cases failing | Failure lines | Verdicts that differ | Part verdicts that differ | Parts pixel-compared, differing | Previous s | New s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| none | 0 | 0 | 0 | 0 of 276 | 276, 0 | 100.3 | 16.4 |
| cell-inset-3px | 42 | 88 | 0 | 0 of 276 | not compared | 101.6 | 16.2 |
| ink-shift-40px | 27 | 66 | 0 | 0 of 276 | 276, 0 | 101.0 | 16.5 |
| ink-shift-down-200px | 0 | 0 | 0 | 0 of 276 | not compared | 101.2 | 16.4 |

Both mutations that move ink outside the cell fail the new check on exactly the same cases and parts as the previous one.
`scripts/metric-outline-ink.test.mjs` keeps this as a permanent unit test (random masks and cells against the previous
per-pixel loop, and leaked-ink cases that must fail).

Reproduce from an opf checkout with built siblings next to it:

```sh
git show 23777616:scripts/test-metric-outline-browser.mjs > /tmp/old-metric-outline.mjs
node docs/evidence/rr-45-ci-speed-20261005/metric-outline-equivalence.mjs "$PWD" /tmp/old-metric-outline.mjs /tmp/equivalence
```
