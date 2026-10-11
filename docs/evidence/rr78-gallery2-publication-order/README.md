# Gallery 2 bootstrap audit

Read-only audit of gallery e0a7eee2dfe996e680b34a907cabfe41905e6d99. No GitHub API calls, publication, source changes or pin changes.

## Published-package control

Source extracted with git archive into /private/tmp/rr78-gallery-registry-bootstrap; npm ci followed by npm install --no-save --package-lock=false --ignore-scripts @openpresentation/opf@0.18.3 @openpresentation/opf-render@0.18.1. Both package directories are real registry installations, not symlinks; renderer resolves the same root core. Manifest and lock are byte-identical to committed sources (SHA256 cf2d68c86ae85d53ca5626b0ec5544a4639a9798c4ac045296b542444ea22681 and 346d210e5b05ed9f37b2fd4ed28fd5f80f9d340fd901b4647be64b503c235f58).

Build, typecheck, catalog verify, license, pack dry-run pass. Build contains 215 content records and 28 layout previews. Test: 63 pass, 10 fail, 73 total; records test cannot import isLayoutTemplate from published core/composition, snapshot validation rejects v2 layout schema, stability mutation tests fail. check:previews fails OPF validation. check:stability succeeds against published prior gallery with 226 renders, but a major schema release allows changes; this does not substitute for the failed v2 preview gate. First non-escalated network stability attempt failed DNS; authorized network rerun passed. First pack attempt hit default-cache permission; explicit scratch-cache rerun passed.

Logs: /private/tmp/rr78-registry-{build,test,typecheck,verify,previews,license,pack}.log and /private/tmp/rr78-registry-stability-network.log.

## Order and blockers

Gallery publishes static data and has no runtime dependencies or peers; no published core/renderer runtime floor is needed to publish it. Its ordinary locked dev floors are core0.18.1/renderer0.18.0. Even published core0.18.3/renderer0.18.1 cannot meet all v2 release gates. No currently published pair has been proven to supply the required v2 schema/composition/render contract.

Existing one-release bootstrap solves publication ordering by installing tarballs built from immutable MERGED source commits without changing gallery manifest/lock. It checks each pin is an ancestor of the remote default branch, frozen-installs/builds core, frozen-installs renderer and replaces core with the packed core, builds/packs renderer, installs both tarballs into gallery, verifies single-core ESM/CJS resolution and package digests, and rechecks manifests/engine resolution after all gates. Current pins are core fe9fe3fa2c3ad0130e271b73d9853f66e920c1d5 and renderer 9fbddcb78dbebcb87355922ca92af7d26c24c48d. Neither is an ancestor of locally known main d12ad7e26aa0edfb52e4280dfe527053fe76f98e / d4259333a1105ce54d136ced0635f086d0f750ee; no remote refresh/API was performed.

Before that sequence can run, required source CI needs an explicit candidate-gallery path: current v2 core root/runtime dependency remains ^1.0.0, frozen install materializes registry v1, OPF CI directly runs tests/typecheck/packed install with it. Existing coordinated refs names only core/renderer/PPTX/editor; --packages-only omits pptx-gallery. Renderer requiresUnreleasedCore0.19.0 skips only published-core packed tests; linked source checks still inherit core gallery1. Depends-On engine trailers alone do not inject gallery2. Golden workflow candidate-gallery support is generation-only, not a fix to required source CI.

Concrete order: qualify a scoped candidate-gallery bootstrap in required core/linked CI without fake registry lock entries; merge reviewed v2 core and renderer source changes (including their approved qualification/golden gates); refresh gallery bootstrap pins to exact final reviewed merged engine commits; run every gallery gate against those tarballs; merge/tag/publish gallery2 through its trusted workflow; verify registry/provenance; update core root/runtime gallery range and real registry lock to ^2; complete core0.19 release-prep and publish; then renderer/PPTX/editor in prescribed dependency order. No old-registry preview workaround or validation weakening is warranted.
