# Windows supervisor update — September 21, 2026

Source: the user relayed this current status directly from the Windows PowerPoint supervisor. The merged PRs and active PR identity were independently read from GitHub. The additional findings below are supervisor-reported while their evidence publication remains in progress; this public-app task did not repeat Office tests.

- Merged [PPTX46](https://github.com/OpenPresentation/opf-pptx/pull/46), `647159ac886a3e472c4d5f028aa19aaea3257b60`: bounded native picture lifecycle harness, per-call logs, registry bindings/comparisons and non-Office Windows controls. Linux/Windows pre/postmerge CI passed.
- Merged [core103](https://github.com/OpenPresentation/opf/pull/103), `009ba028e74c512a80eadd9b4c623d01cd43402c`: two recovered-host picture controls with hash-verified evidence, registry checks, native renders, cleanup and preserved failures.
- Open [PPTX47](https://github.com/OpenPresentation/opf-pptx/pull/47), reported head `08850fc372e32cb41ea63e50d418cd3a17b497a8`: actual picture/furniture editing workers, fixtures, validated action plans and non-Office Windows safety checks. CI was running at the supplied update; see the separate timestamped PR receipt for observed check state.

Three native picture edit cases and ten furniture lifecycles completed. Nine furniture semantic cases pass, including clearing/deletion, inheritance, empty/false, reordering, damaged tags and metadata conflicts. UI Change Picture retained current image bytes, cleared alt, shape identity and tag payload, but changed geometry. Longer edited text can clip.

Production notes ordering passed; controlled reordered copies were refused, including a control for ZIP order. Production is unchanged. Refreshed native tabs still exceed the unchanged **0.02pt** gate, with maximum approximately **0.02265625pt**. Raw lifecycle evidence is retained; two harness defects were isolated and corrected.

Further evidence publication, tab harness and permitted-font editing tests continue and were not yet additional PRs at the supplied update. These findings do not establish overall native compatibility. No packages were published, sites deployed or tolerances relaxed.

The Windows supervisor retains **sole desktop Office control**. Coordinate before touching its active branches or testing Office. Keep public-app issue88, shared runtime fixes, geometry drafts and p:hf roadmap work separate.
