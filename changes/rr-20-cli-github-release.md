---
type: changed
packages: [cli]
---
RR-20 (release workflow only): publishing `@openpresentation/cli` to npm now creates its GitHub Release. A `release` job in `cli-publish.yml` runs after the npm publish on a `cli-v*` tag push, takes the notes from this changelog's `## X.Y.Z` section (the job fails if the section is missing), and creates the release `cli-vX.Y.Z` titled `@openpresentation/cli X.Y.Z` with `--latest=false`, because the core release owns "Latest" in this repository. Only that job holds `contents: write`; the publish job keeps `id-token: write`. GitHub Releases start at 0.18; older versions get none.
