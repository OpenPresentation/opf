---
type: changed
packages: []
---
RR-57 (CI only, no published package changes): a pull request runs fewer jobs. OPF CI and Coordinated public packages no longer run again on push to main (the merge queue already tested that exact commit); the Node 22 and Node 26 engines-range legs moved to `.github/workflows/engines-range.yml`, and the CLI portability, published-matrix and installed-parity macOS and Windows legs run in the merge queue, on the weekly schedule and on manual runs instead of on every pull request. The label `full-ci` runs them on a pull request. Every job has a `timeout-minutes`. `pnpm check:ci-diet` guards the shape.
