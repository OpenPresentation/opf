---
type: changed
packages: []
---
RR-101: the registry lane binds opf-editor's published `dist/` to its `gitHead` by a reproducible build instead of the committed `dist/`, which the editor repository does not keep current (the 0.25.1 release commit carries a `dist/` older than its sources while the tarball, built at prepack, matches them). `scripts/rebuilt-release-files.mjs` exports the commit, runs the editor's own `npm ci --ignore-scripts` and `scripts/build.mjs`, caches the result per `gitHead` under `artifacts/immutable-builds/`, and `test-installed-code.mjs` compares every installed `dist/*` file byte for byte with it (replacing the `dist/styles.css`-only rebuild); every other file is still compared with the commit. A difference fails with the file, the `gitHead` and both digests.
