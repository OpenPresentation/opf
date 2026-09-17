# Node 24 maintenance verification

Local verification on macOS arm64 with Node **24.21.0** passed against the
product commits in `product-refs.json`. Later commits pin CI to this same graph.
`manifest.json` hashes the retained reports, lock/install output and check logs.
These are source and candidate results; hosted CI and new deployments are
separate acceptance steps.

- All eleven first-party package manifests require `24.x`; all seven checkouts
  have `.nvmrc` set to `24`, and every active setup-node step selects 24.
- Frozen installs pass in all seven repositories. Only direct Node type packages
  and their Undici types changed resolution; runtime dependency versions stayed
  locked. Transitive packages can retain their own Node type dependencies.
- Core lint, typecheck, build, tests, examples and breaking-change checks pass.
  The complete coordinated package suite passes with **805 unchanged raster
  hashes / 126 decks**, fresh tarball consumers, declaration checks, and all 70
  CLI commands in isolated global and npx-style installs.
- Installed browser suites pass **276 assertions and eight trusted interaction
  scenarios**. Additional offline checks cover 12 whitespace workflows, 48
  readability cases and 16 timeline workflows, including editing, undo/redo,
  source preservation and editable PPTX export/reimport.
- All three public-site source builds and audits pass. Their local production
  browser suites pass: website six, gallery five and pptx.dev ten workflows.
  pptx.dev also passes its app/SDK/CLI typechecks, tests and bundled CLI build.
- The Python wrapper invokes the actual bundled CLI successfully with Node 24;
  its updated source and the Homebrew formula pass syntax checks. This does not
  claim that a new wheel or Homebrew release has been published or installed.

Reproduce with Node 24 and the package-manager version pinned in each checkout.
Install the frozen graphs, build core and link the four coordinated checkouts
with `node scripts/link-ecosystem.mjs --packages-only`. Run `pnpm test:packages`
with `OPF_GOLDEN_BASELINE` pointing to the renderer's existing
`test/golden/opf-examples-png.timeline.sha256.json`. Then run the commands in
`checks/opf-browser/report.json`. In each site, run the build/check commands in
its `report.json`, followed by `pnpm test:e2e`. Recorded absolute paths identify
the original run; use your own sibling checkouts for reproduction.

No new Node 20 checks ran. Historical evidence and published version records
remain unchanged. The furniture draft is on separate branches and is excluded
from this runtime milestone. Native image/Office recovery, tab-position and
font-fidelity gates remain open, as do the broader font/layout, vector PDF,
SVG/Mermaid, new package release and public adoption objectives.
