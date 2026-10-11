# Main-site combined source and remaining registry adoption

Read-only review of `7d91d3c2264288da5fbaa95fe0d6e92b648a1a5c`, 2026-10-11. PR 103 ab0b0da532e553416a05d7164a331d994e312ef4 is an exact ancestor of PR 104 506a38bd8a3b6a86065199c74c09069581aa67a2. The new candidate differs from 104 only by its evidence README. Therefore all reviewed v2 catalog/snippet/UI changes and the browser-only download/server externalization/image assertion corrections are preserved byte-for-byte. No additional source defect found in this composition. This is a self-review of the composition, not independent replication of its execution evidence.

## Required separation

The patch registry adoption map is for the default v1 sites and real patch graph: core 0.18.4, renderer/PPTX/editor 0.18.2, CLI 0.18.1. It cannot make this v2 source branch ordinarily installable: this branch directly imports unpublished gallery 2 and expects v2 schemas/regions. Do not bump this branch to patch versions and declare its ordinary registry gates green. Complete final 0.19 publication remains a prerequisite for its final adoption.

## Concrete final 0.19 edits and commands

- `package.json` and real `pnpm-lock.yaml`: declare direct gallery ^2.0.0 and adopt the actual released core/renderer/PPTX/editor/CLI 0.19 graph in their existing dependency sections. Resolve optional Expo font peers from the selected actual renderer manifest, not a copied old list. Install in a fresh tree with `pnpm install --frozen-lockfile`; require no local/file candidate package overrides and shared core/gallery resolution.
- `starters/{website,editor,node}/package.json`: replace existing core 0.18.1/engines 0.18.0/CLI 0.18.0 with that same real graph; declare gallery where source imports it. `node scripts/prepare-developer-starters.mjs` creates deterministic public starter ZIPs; `node scripts/test-developer-starters.mjs` must pass strict installed core agreement and real starter/export checks.
- `data/releases.json`: update five current versions and actual npm dates, and coreHistory from actual publications only (burned unpublished 0.18.2 excluded). Rebuild `public/showcase/{example.opf.json,example.svg,example.pptx,manifest.json}` via core `pnpm build:showcase:registry` after its reviewed release-plan/verificationRefs reflect that registry graph. Review changed output rather than adding a blanket showcaseVersion exception.
- `pnpm sync:opf` must obtain source for the real installed core tag without OPF_LOCAL_SOURCE; `pnpm prepare:fonts` and `pnpm verify:fonts` must materialize/verify actual renderer bytes. These generated resources cannot retain local candidate source identities.
- Run ordinary `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm verify:registry`, `node scripts/test-get-started-snippets.mjs`, `node scripts/test-developer-starters.mjs`, and full `pnpm test:e2e` on localhost. Preserve real J5 registry CLI installation/conversion and catalog detail/schema/menu checks. Repeat existing picture export and Markdown/YAML route cases. If Worker packaging is qualified, use existing build/limit/local-preview commands only, with no deployment.

Acceptance: ordinary prebuild and all source/registry/browser contracts pass without temporary manifest edits; all 28 gallery layout pages and schema/catalog payloads match real gallery 2; real starter/CLI registry install works; showcase/version/date/hash contracts agree; actual image/media/font bytes remain valid in browser and packaged host. Current bounded source checks are useful but do not meet these criteria. Present ordinary regression failure remains actual core 0.18.4 versus committed starter 0.18.1.

## Patch map and editor example reference correction

The old map's unresolved renderer/PPTX publication identities are now historical; verified refs are renderer de0a5034f49dbacfe190946ec7416a976981cf45 and PPTX 1954c9ce3d2c54a69666b54acdc9fcc87dcb9ca2. Editor main is 36d61ea27dd4677724dfec22006759139b7136ff, but its publication remains pending supervisor verification. Do not edit adoption f107 or real dependency/lock records before that verification.

For patch gallery artifact examples, editor 36d61ea is suitable once independently published: its examples tree is exactly `9bb08a6459940c7d2fbc48fbbbb80b4f6c7d9220`, identical to reviewed f35326ac and earlier39e62. Changes f353→36d61 are only CHANGELOG, consumed fragment, package and lock metadata. Thus reviewed immutable f35326ac remains a valid exampleRefs pin; 36d61 is an equally exact immutable example source with truthful 0.18.2 metadata. The chosen exampleRef must remain distinct from verified registry package gitHead and must never use v2 editor156/c141 for patch artifacts. The map's old 39e62 suggestion should be superseded by this proof, not silently treated as a new source qualification.

No dependencies, f107, source branch, assets or locks were modified in this audit. No tests, APIs, deployment or release actions were run.
