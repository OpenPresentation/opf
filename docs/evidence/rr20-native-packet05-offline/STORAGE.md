# Durable offline packet05 subset

This is an evidence snapshot, not native PowerPoint acceptance. No Office execution, font registration, release publication or deployment occurred. All original source and staged tarball identities remain in packet.json/tooling/expected-graph.json; original metadata is not registry installability. Editor remains569a834, distinct from later macOS test-only follow-up.

The original packet05 is frozen at packetSHA `7e7baaf52c217317898423ebc62095f858e59a3cc6f1305f537e30299bffedcf` and resultSHA `edd6e4c3caa8f5d5dcbf99ab461cf3093427b5c0c1d5e110405cf7817202f2c6`. Its metadata and every retained file are copied byte-for-byte. Repository conventions retain native input PPTX and diagnostic JSON; this bounded snapshot retains164 files (sources, inputs, actions, inspections, chart modes,9 archive pairs (18 archives), table control and original tooling). It omits68 renderer SVG/PNG previews (~29MiB), whose exact hashes remain in the unchanged full232-file manifest. No font binaries are duplicated. Omitted preview bytes are not native proof.

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

After the four generation commands above, copy the retained tooling (including expected-graph.json and the seven byte-identical harness files) and original README into the new packet, then seal using the retained archive directory explicitly:

```
cp -R "$EVIDENCE/tooling/." "$NEW_PACKET/tooling/"
cp "$EVIDENCE/README.md" "$NEW_PACKET/README.md"
node "$EVIDENCE/tooling/finish.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH" "$EVIDENCE/reviewed-archive-pairs"
node "$NEW_PACKET/tooling/inspect.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$NEW_PACKET/tooling/expected-graph.json"
node "$NEW_PACKET/tooling/test.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$NEW_PACKET/tooling/expected-graph.json"
```

`EVIDENCE` is this snapshot's absolute directory; `EXPECTED_GRAPH` is `$EVIDENCE/tooling/expected-graph.json`. `CONSUMER` is the exact six-package installed staged consumer; `CORE_GRAPH` and `PPTX_SOURCE` are the exact bound source checkouts. `NEW_PACKET` must not exist before generate; copy into it only after generation. CANDIDATE_GALLERY_REF above applies to every command. No step opens Office. Compare the generated complete232-file inventory and every byte hash with the original packet.json. Reconstruction failures must be retained as a new attempt, not promoted over this identity.

The actual original/staged manifests, tarball identities, overlays and serial consumer logs are retained in [core PR608](https://github.com/OpenPresentation/opf/pull/608), `docs/evidence/rr20-complete-graph-serial/`. That evidence is stacked and not part of this main-based snapshot. Complete source branches and disposable d20895f2 are local, unpushed qualification inputs, not guaranteed remotely fetchable release commits. The exact tarballs/source graph must be preserved and supplied independently; this snapshot does not bundle engine packages or promise a registry-only reconstruction. If those inputs are unavailable, verification/reconstruction is blocked rather than substituted with another graph. Scripts bind their actual commits and bytes. Rebuilding the graph at a different commit requires separate review and must not silently change expected-graph.json.

The original README identifies every limitation, including Pareto extra-series loss (#246), world geodata fallback and manual-only native operations. Native outputs require separate supervisor-owned evidence and a fresh bounded Windows attempt; none exists here.

Validation: all164 retained original files independently byte-equal packet05; subset verifier passes; `node --test verify-storage.test.mjs` passes actual tamper/duplicate/omission controls ([log](storage-regression.log)); `pnpm check:changed --base HEAD` passes Biome, fragment and text checks. The evidence-only delta changes no package runtime, schema, dependency/version/lock, golden or program status. Final main-based `pnpm test` passes:2262 core tests,169 CLI unit tests,95 command checks,77 drawing checks and35 root checks. This checks the evidence branch repository, not a replacement final0.19 graph qualification; the independently qualified graph and its limits remain the exact prior record.
