# Durable packet06 offline subset

This snapshot retains 167 original files byte-for-byte, plus the unchanged packet metadata and seals. It omits 68 SVG/PNG preview files from the full 235-file inventory; their exact paths, sizes and SHA256 values remain in `packet.json`, with the omission partition in `storage-index.json`. Omitted bytes are not claimed present or native proof. No font binaries, engine tarballs or node_modules are duplicated. Pinned face/license identities and actual verification status remain in the original packet metadata.

Frozen packet SHA256: `be69008fd401b435c29696e8393b7aed1a1030ed11bd8b050600c2e83f80a945`; offline-result SHA256: `bc40577eeca576af0d9b1a37e3ce71b2cfa03f2587a7801a1a011b8f000a74bd`. Original packet05 remains historical and unchanged. The original README and tooling are retained unchanged. `node verify-storage.mjs` validates only this subset and explicitly reports `fullPacketVerified:false`; the original full inspector requires the omitted files and must reject this subset.

Packet06 records 29 successful exports and one explicit multi-series native Pareto refusal without an output file. Auto/fallback preserves all three series/four columns as editable column fallback, including provenance-stripped import. The separately authored single-series positive control does not replace the negative case. Original all-seven succeeds with seven chartEx parts and remains ineligible for the generic native worker. Nine original fallback archives remain strict, with nine reviewed pairs/18 archives byte-identical. Existing world/geodata, waterfall and furniture adaptation limitations remain explicit.

Native worker caps remain 3 slides, 30 shapes, 20 actions, 45-second default/60-second maximum. No Windows/Office execution or font installation occurred. Native acceptance, issue246 closure, registry/preliminary metadata and checkpoint completion are pending. No checkpoint/count changes.

`independent-tests.log` and `independent-review.md` retain the frozen full-packet review, two read-only runs and five scratch refusal cases. The three `superseded-*-failure.log` files preserve incorrect earlier oracle assumptions (supplemental control lacks historical baseline; chart may import into blocks; original all-seven Pareto is single-series). They are failed attempts, not acceptance evidence.

## Reconstructing the full packet

Supply the exact local source/tar/installed graph in `tooling/expected-graph.json`. Core `bf59164c` has authorization-only overlay `ed107a20`; renderer `12766980`, editor `d6481068`, PPTX `1fae5a9d` and gallery `e0a7eee2` are explicitly bound. These local qualification inputs are not guaranteed remotely available or registry-installable. [Draft core #620](https://github.com/OpenPresentation/opf/pull/620) retains the refreshed staged graph's original/staged manifests, tar identities and five serial consumer logs; it is separate source/staged evidence. If exact inputs are unavailable, reconstruction is blocked rather than replaced by current packages.

Use Node 24.21.0. Set `EVIDENCE` to this snapshot's absolute path; `CONSUMER`, `CORE_GRAPH` and `PPTX_SOURCE` to the exact staged installed consumer/core/PPTX checkouts; `NEW_PACKET` to a nonexistent path; `EXPECTED_GRAPH` to `$EVIDENCE/tooling/expected-graph.json`. These are preparation commands, never Office execution:

```sh
export CANDIDATE_GALLERY_REF=e0a7eee2dfe996e680b34a907cabfe41905e6d99
node "$EVIDENCE/tooling/generate.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node "$EVIDENCE/tooling/fonts.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node "$EVIDENCE/tooling/chart-modes.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node "$EVIDENCE/tooling/rich-title-probe.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node "$EVIDENCE/tooling/pareto-single-control.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH"
node "$EVIDENCE/tooling/native-table-colors-staged.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH" generate
cp -R "$EVIDENCE/tooling/." "$NEW_PACKET/tooling/"
cp "$EVIDENCE/README.md" "$NEW_PACKET/README.md"
node "$EVIDENCE/tooling/finish.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$EXPECTED_GRAPH" "$EVIDENCE/reviewed-archive-pairs"
node "$NEW_PACKET/tooling/inspect.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$NEW_PACKET/tooling/expected-graph.json"
node "$NEW_PACKET/tooling/test.mjs" "$CONSUMER" "$NEW_PACKET" "$CORE_GRAPH" "$PPTX_SOURCE" "$NEW_PACKET/tooling/expected-graph.json"
```

Compare every reconstructed file/hash against the unchanged full manifest. Preserve mismatches as a new attempt; do not reseal this accepted identity. `finish` receives the explicit sixth archive-directory argument; copying tooling contents avoids nested directories. The explicit rich-title probe above produces the retained supplemental inspection.
