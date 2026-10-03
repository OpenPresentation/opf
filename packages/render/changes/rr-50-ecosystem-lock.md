---
type: changed
---
RR-50 (repository tooling; no package output changes): CI reads the commits of opf, opf-pptx and opf-editor and the golden baseline from core's bot-owned `ecosystem.lock.json` through `OpenPresentation/opf/.github/actions/ecosystem-refs@main` instead of hand-edited SHA pins (`ci.yml`, `regenerate-goldens.yml`, `flake-repeat.yml`, `platform-residual.yml`); `scripts/ecosystem-pins.mjs` reads the same lock, and `ci.yml`'s `golden-override` input is the renderer's own golden selection.
