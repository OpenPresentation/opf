---
type: changed
---
RR-20 (release workflow only): publishing opf-render to npm now creates its GitHub Release. A `release` job in `npm-publish.yml` runs after the npm publish on a tag push, takes the notes from the version's `## X.Y.Z` section of `CHANGELOG.md` (the job fails if the section is missing), and creates the release `opf-render-vX.Y.Z` titled `@openpresentation/opf-render X.Y.Z`, marked as the latest release. Only that job holds `contents: write`; the publish job keeps `id-token: write`. GitHub Releases start at 0.18; older versions get none.
