# Installed physical font variants

This unpublished candidate increment combines core type commit `f30ae54134fb075749f228532b40df4b36a0770d`, renderer `de14528555974f270807bca51614d21762a0bbf3`, PPTX `2ce4a54429746ba4648534a653a2fd9c42d0b78f` and editor `6e0b7d2f1b4369fc0a228391cf36e913e05188f8`. Core's current coordinator changes add installed-variant assertions and preserve historical registry tests. The pack log records candidate tarball hashes; these temporary versions are not release versions.

Fresh consumers check all nine actual font faces, their preferred-family grouping and physical style links, using font metadata independently of the selection code. Seven payload slides check actual serialized native selectors, source preservation, deterministic export, heading/code reimport and provider fallback/error controls. The shared preparation workflow also runs pagination, editor geometry, edit/undo and SVG/PNG. Installed browser records cover seven suites, 230 assertions and eight trusted interaction scenarios with no page errors or remote requests. Node-specific logs and reports are retained in subdirectories.

The renderer retains the original three wrong weight selections and three native flag mismatches, corrected source probes, browser advance observations and seven visually inspected slide pairs in [its evidence](https://github.com/OpenPresentation/opf-render/tree/de14528555974f270807bca51614d21762a0bbf3/docs/evidence/font-variants). No new native Office paint, embedding, multilingual fidelity, registry package or deployment is claimed.

`windows-metric-independent-review.json` separately reviews historical evidence commit `e862a5f48bbb9e34aa6e5115922848292e23797f`: 96 complete native metric slides, 276 isolated masks, worker exits, raw tab arithmetic and 288 reported import hash bindings. The independent checks reproduce eight tab outliers and one portrait/right ink overflow on each runtime. These remain failures and concern their original runtime graph.

Reproduce the candidate checks from four named sibling repositories with locked dependencies:

```sh
pnpm build
node scripts/link-ecosystem.mjs --packages-only
pnpm pack:ecosystem
pnpm test:packed-ecosystem
pnpm test:packed-browser
```

Repeat fresh consumer installation and browser execution under Node 20 and 24. Independent PR review and exact-head CI must pass before merge; broader reliability/native gates and coordinated publication remain required.
