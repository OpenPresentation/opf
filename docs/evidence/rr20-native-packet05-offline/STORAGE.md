# Durable offline packet05 subset

This is an evidence snapshot, not native PowerPoint acceptance. No Office execution, font registration, release publication or deployment occurred. All original source and staged tarball identities remain in packet.json/tooling/expected-graph.json; original metadata is not registry installability. Editor remains569a834, distinct from later macOS test-only follow-up.

The original packet05 is frozen at packetSHA `7e7baaf52c217317898423ebc62095f858e59a3cc6f1305f537e30299bffedcf` and resultSHA `edd6e4c3caa8f5d5dcbf99ab461cf3093427b5c0c1d5e110405cf7817202f2c6`. Its metadata and every retained file are copied byte-for-byte. Repository conventions retain native input PPTX and diagnostic JSON; this bounded snapshot retains164 files (sources, inputs, actions, inspections, chart modes,18 archive pairs, table control and original tooling). It omits68 renderer SVG/PNG previews (~29MiB), whose exact hashes remain in the unchanged full232-file manifest. No font binaries are duplicated. Omitted preview bytes are not native proof.

`node verify-storage.mjs` verifies the committed subset against the original full manifest and seals, with alias/duplicate/tampering rejection. It explicitly does NOT verify the omitted files or imply the full packet is present. The original `tooling/inspect.mjs` remains unchanged and requires a complete packet; it must reject this subset. `independent-tests.log` records the independent frozen full-packet read-only replay and five actual negative controls. `superseded-reseal-overlap.log` records a failed earlier snapshot caused by the disclosed authorized README reseal overlap; it is not acceptance or a verifier-write finding.

## Reconstructing the complete packet

Use the exact source/tar closure in tooling/expected-graph.json (six tar hashes/sizes and source commits), original vs staged manifest differences in packet.json, and reviewed604/606 overlays. Build a fresh staged closure with the reviewed candidate helpers; never fabricate registry locks or substitute current packages. The staged core is d20895f2 and selected gallery is e0a7eee2. Verify actual source, artifact and installed runtime identity before executing packet tooling. All commands use Node24.21.0; caller supplies five explicit absolute paths:

```
export CANDIDATE_GALLERY_REF=e0a7eee2dfe996e680b34a907cabfe41905e6d99
node tooling/generate.mjs "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node tooling/fonts.mjs "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node tooling/chart-modes.mjs "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node tooling/native-table-colors-staged.mjs "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH" generate
```

Copy the seven unmodified harness files from the retained tooling into the fresh packet tooling folder and the original packet README before final sealing. `finish.mjs` takes a sixth argument: the retained reviewed-archive-pairs directory. Preserve the expected graph and all tooling exactly; compare the generated complete232-file inventory and every byte hash with the original packet.json, then execute original inspect/test with the same five arguments. Reconstruction failures must be retained as a new attempt, not promoted over this identity. The source record in the original README identifies every limitation, including Pareto extra-series loss (#246), world geodata fallback and manual-only native operations. Native outputs require separate supervisor-owned evidence and a fresh bounded Windows attempt; none exists here.

Validation: all164 retained original files independently byte-equal packet05; subset verifier passes; `node --test verify-storage.test.mjs` passes actual tamper/duplicate/omission controls ([log](storage-regression.log)); `pnpm check:changed --base HEAD` passes Biome, fragment and text checks. The evidence-only delta changes no package runtime, schema, dependency/version/lock, golden or program status. Full source tests are not rerun for this storage-only change; the independently qualified graph and its limits remain the exact prior record.
