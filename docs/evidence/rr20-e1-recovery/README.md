# E1 fixed-comparison recovery — evidence only

This branch is `codex/rr-20-e1-recovery`. Never merge it. It preserves read-only inputs and controls for a later current-after refresh; it changes no product, public artifact, registry, renderer, native output or site. No historical builder, approximate Claude renderer or font URL was executed.

[Full sealed recovery map](payload/recovery.json), [packet seal](payload/seal.json), [readable batch index](inventories/summary.json), [43-slide pilot map](inventories/pilot.json), [brief and transport provenance](brief-provenance.json).

The 18 local batches contain 844 ordered OPF slides. Their two manifest files and all 18 corpus/corpus-v2 deck pairs are byte-identical. Every raw deck, authored-slide hash, neutral ID, tag, Claude project/order and fixed image hash is recorded. There are 841 fixed before panels and all 844 fixed Claude panels. The missing before panels are batch-11/s27, batch-13/s29 and batch-17/s04; they are not replaced or fabricated. The eleven explicitly listed published batches (01–08 and 14–16) have all 550 before/Claude pairs. The original task's broader01–16 wording and the full18-local-batch scope remain distinct.

The pilot has all 43 before and 43 Claude panels, with the exact neutral-ID→OPF-ID map. Both genuine 43-slide source candidates are immutable Git references:

- febec90dfb9eff624b8625f4eaaf5db90869ed6f, SHA256 f9c4f4834c36e373f7f997a140654e9c54c0b85af91d86f29ea3e07909833027.
- c3e7196aca3c3f18242b405ff870b8bace768fd8, SHA256 e4a6bca4405ffc24bb6dd404f18cb85675e47e7e047ade1b9428044aa401fab8.

Their authored slide objects/order are identical; four embedded layout variant fields differ. The exact old before-image engine/catalog/font producer remains unrecovered, so neither candidate is asserted as its producer. This does not block refreshing the current after from the preserved source while retaining the fixed before/Claude hashes. The old before label is 2026-11-01 from the original task, not independently recovered engine provenance.

The original/local corpus briefs are byte-identical. The pilot's original Claude brief differs only in 13 dynamic subtitles: “Illustrative example” replaces “Dynamic composition”. Both raw briefs are retained, and every differing line is listed. The fixed Claude panels and source projects remain historical controls; no claim of current Claude-runtime/font parity is made.

Only three public artifact IDs are recovered: overview KMaetkTJ9D9HUcen1SZ1iu, pilot VKdZMT6xh8wyyhN95SWJTY and an unmapped batch exemplar X9283LmzzkyqTU91ELn82M. The exact eleven-batch public ID/version roster remains unrecovered. No ID is invented or assigned to an arbitrary batch.

Twenty-one ZIP packets retain 2,882 new raw assets (92,313,008 bytes total; largest 5,797,246 bytes), with content bytes checked after ZIP round trip. Nineteen assets reuse exact existing Git commit/path/blob references, including 14 fixed Claude PNGs; no content is duplicated merely to imply a new observation. All 2,901 assets are verified against SHA256 and Git-blob identity. The exact executed collector is retained as `capture-executed.mjs.gz`; `capture.mjs` has only BOM/line-ending normalization for Git transport.

Source-only sampler snapshots are pinned too: main afac3f7fc07539667fe9298f8efc08c967aacb0d has 49 slides, and accepted preparation d98725a8574f9c6a1655f343ab082dda8f59e12a has 53. All43 fixed pilot IDs retain their relative order. The six/ten additional current IDs have no invented historical comparison panels. These are source counts, not published-package or rendered-output receipts.

Verification reads archives in memory and uses immutable Git references; it writes no extracted source or image:

```powershell
node docs/evidence/rr20-e1-recovery/verify.mjs docs/evidence/rr20-e1-recovery/payload C:/opf-work/installed-opf-checkout
```

The last argument supplies the repository's pinned installed fflate dependency, not an alternative renderer. Final current-after rendering will use the maintained shipped route selected by the coordinator after actual publication. The missing corpus renderer command in the original inventory is not invented here. Registry queries, rendering, UI publication and native work remain unrun.
