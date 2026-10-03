---
type: changed
---
RR-50 (repository tooling; no package output changes): CI reads the commits of the other OpenPresentation repositories and the golden baseline from core's bot-owned `ecosystem.lock.json` through `OpenPresentation/opf/.github/actions/ecosystem-refs@main` instead of hand-edited SHA pins (`ci.yml`, `flake-repeat.yml`).
