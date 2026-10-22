---
type: changed
packages: []
---
MR-50 and MR-52: the repository documents describe the monorepo (`AGENTS.md`, `CONTRIBUTING.md`, `docs/release-process.md`, `docs/ecosystem-development.md`, `docs/default-catalog.md`, `README.md`), one `.github/dependabot.yml` covers the workspace (grouped minor and patch updates, a Playwright group that also needs the pinned image digest edited), and the gallery package owns every default record (records are authored by pull request in `packages/gallery`). After a stable release `.github/workflows/bump-sites.yml` opens a "bump to vX.Y.Z" pull request in each of the three site repositories (`scripts/bump-site.mjs`; a patch bump is labeled `auto-merge`, a minor or major bump `needs-review`); the site-side merge workflows are drafted in `docs/programs/monorepo/site-workflows/`.
