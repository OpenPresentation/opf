# Candidate golden workflow qualification

This separate opt-in workflow leaves the existing example-only regeneration unchanged. It accepts only core and gallery source inputs needed by generation. The renderer is an explicit immutable candidate commit on a same-repository branch; tooling is the separately reviewed dispatched revision. Generation uses the same digest-pinned Playwright image and exact hash gates, and holds read permissions only. The push job installs/builds no candidate packages and writes only selected golden paths after immutable-head, count, keyset and comparison-metadata checks. Dry run is the default.

Actual local replay used fresh candidate trees from core `7c0bf9ef7476563dbd4872634d3dab7051a8d9b7`, gallery `e0a7eee2dfe996e680b34a907cabfe41905e6d99` and renderer `2377a136aebfb68559ef202dcb8f75d3fad6d0ad`. Locked installs and gallery build ran before source links; gallery materialization and core/renderer builds passed. The new helper verified checkout HEADs and package identities, installed candidate links, and verified generated manifests.

```sh
node scripts/candidate-goldens.mjs link --workspace "$PWD/.." --core 7c0bf9ef7476563dbd4872634d3dab7051a8d9b7 --gallery e0a7eee2dfe996e680b34a907cabfe41905e6d99 --name rr-83-v2-layouts --selection both
npm run build
OPF_GOLDEN_ARTIFACTS=changed node test/golden.mjs --update
node test/layout-template-goldens.mjs --update
node scripts/candidate-goldens.mjs verify --workspace "$PWD/.." --core 7c0bf9ef7476563dbd4872634d3dab7051a8d9b7 --gallery e0a7eee2dfe996e680b34a907cabfe41905e6d99 --name rr-83-v2-layouts --selection both
```

All 807 example entries and 498 template entries exactly match the preserved supervisor-reviewed local manifests. The templates have 26 intended imageFit changes; examples retain the reviewed 171 migrations including 20 chart corrections. Local replay validates helper/source setup and candidate identity; only a later supervisor-dispatched pinned CI run may commit golden hashes. No apply/promotion or dispatch ran here. Existing baseline files remain unchanged.

Required generation sequence: dispatch this separately reviewed tooling revision with a separate complete renderer candidate branch/SHA and the complete frozen core/gallery SHAs, new baseline name `rr-83-v2-layouts`, selection `both`, and `dry-run=true`. Review pinned artifacts before the same immutable inputs are used for a write run. Review note belongs in `test/golden/notes/`; source and baseline selection for normal v2 CI remain an explicit separate qualification change. Published 0.18 baseline and release lanes remain unchanged.

Hardening regressions reject invalid source digests/deck counts, nonpositive bytes, graph mismatches, nonregular/aliased artifact files, nested baseline symlinks and stale heads. The write job checks a clean candidate checkout before any write and executes only tooling from its separate checkout. An isolated unchanged-main control compares the entire generated manifest against its committed baseline before candidate generation.

Actual unchanged-main replay: renderer `d425933` and core `d12ad7e2`, independently built with their compatible locked dependencies, generated all 807 entries and passed full-manifest equality against the unchanged committed renderer baseline. Candidate and guard dependency trees were separate. No apply/promotion ran. Main-based `npm test` passes all 111 tests; package metadata and 246-file syntax checks pass.

Source metadata is independently recomputed from selected core example JSON and selected gallery record JSON (index order, stripped record metadata), with the renderer fixture gallery SHA marker checked as data. The push job repeats this computation from separately checked-out source data without executing candidate code. Template comparison metadata/keyset is pinned to the byte SHA256 of the reviewed PR215 baseline (`a6102dd12a26594eb101ac6344ab4af45e71f247decaa663f3bf3be6e207ee98`). New example baseline targets must not exist, so historical baselines cannot be overwritten; any later rerun into an existing target requires a separately reviewed policy change. Dangling symlink rejection uses lstat before writes.
