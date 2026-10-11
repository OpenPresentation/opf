# Held font-policy and raster source integration

Supervisor-confirmed core [#585](https://github.com/OpenPresentation/opf/pull/585) merged at `4387b0273aa64d4705910222c91298c1139c594e`. Its policy/test/fragment scope and [historical native evidence](../ff-46-sizeadjust-native-20261010/README.md) were independently reviewed; source full/mapped checks passed.

The combined renderer [#219](https://github.com/OpenPresentation/opf-render/pull/219) merged at `dd6b520404d423fd4ddd59e81a9b47971e906be3` after prescribed gate 55383 completed with exit 0 and eight checks. Reviewed combined head `84f4bea42917f2389ca70102b50d2e7a2b1043ea` preserves original #219/#217/#222/#229/#230 scopes. [Per-path provenance](renderer-path-proof.json) records every original exact head and changed path; only the host browser-suite file differs to retain current-main registrations. Original PRs are not claimed individually merged.

Independent source qualification passed 249 typechecked files, all 113 renderer test suites, 391 face samples, 140 corpus titles/217 runs, 1,440 script-name host runs, raster cluster/context regressions, four forced-color cases and strict subset pixel controls. Recorded fontkit/Korean punctuation limitations remain; no golden or tolerance changed. These facts satisfy T15 source review/merge and T17 raster review/merge; only those two checkpoints close here, progress 15/40 including verified CLI T12.

T16 remains pending the editor/gallery/core host-fixture integrations and final reruns. The supervisor's ecosystem roller session 20697 is qualifying a new lock after renderer merge; completion is not claimed. The old locked renderer rejects the new policy in its Arabic-only test, so a generated, qualified lock PR must land before core #616/#618 can pass the complete linked gate. No hand pin or skip.

Actual core 0.18.4 and renderer/PPTX/editor 0.18.2 publication, real registry floors/locks, site adoption and native acceptance remain pending. This records source integration only. Unmerged #616 geometry records are not imported by this branch.
