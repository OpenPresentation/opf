---
type: fixed
packages: [opf, cli]
---
RR-20 (install fix, no API or output change): `engines.node` is now the open-ended `>=22` instead of `24.x`. npm's install picker skips a version whose `engines.node` does not match the running Node and silently installs the newest one that does, so on Node 26 (current) or Node 22 `npm i @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx` installed the CLI, renderer and PPTX 0.7.0 with core 0.9.0 (no `export` or `render` command) instead of the latest release. The test suite and the packed installs pass on Node 22, 24 and 26, and CI now runs them on Node 22 and 26 next to Node 24 (the development runtime). A new check, `pnpm check:engines-range`, fails on a closed `engines.node` in any package.json, on a lockfile entry (the published-matrix consumer included) for a release after this fix that still declares one, and on a workflow Node version below the range.
