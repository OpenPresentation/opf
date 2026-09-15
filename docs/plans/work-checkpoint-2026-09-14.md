# Work and publication checkpoint — September 14, 2026

The user requested focused commits, pushed branches and maintained PRs as work
progresses. Commit each coherent implementation or evidence milestone, push it
promptly, and update its existing PR. Preserve incomplete work in a clearly
documented draft with its failing checks; merge and publish only after its
acceptance requirements pass. Do not accumulate an unrecorded working tree
while moving on to another feature.

## Merged and deployed

- Website: [PR29](https://github.com/Data-Advantage/openpresentation-site/pull/29)
  adds editable homepage JSON;
  [PR30](https://github.com/Data-Advantage/openpresentation-site/pull/30)
  adds JSON/preview editing in both directions on `/` and `/playground`;
  [PR32](https://github.com/Data-Advantage/openpresentation-site/pull/32)
  adds contextual catalog dropdowns; and
  [PR33](https://github.com/Data-Advantage/openpresentation-site/pull/33)
  adds code-editor behavior. All are merged. Local `main` and remote `main`
  match at `8d8fc5ec30b3c61f7602b8ec6d5928981bc07efc`; its Vercel deployment
  status was freshly verified successful.
- Partner demo: [core PR80](https://github.com/OpenPresentation/opf/pull/80)
  is merged at `19e1a7f41ae4e687cdf347e4350109394d81eb5a`, with the demo and
  offline fallback preserved. The 12 untracked local demo copies on the
  furniture branch match `origin/main` byte for byte; they are not unpublished
  work and are retained without duplication.

## Pushed draft work

- [Core PR79](https://github.com/OpenPresentation/opf/pull/79): measured shared
  headers/footers, layout, pagination, source preservation and evidence.
- [Renderer PR20](https://github.com/OpenPresentation/opf-render/pull/20):
  rendering from shared accepted furniture geometry.
- [Editor PR17](https://github.com/OpenPresentation/opf-editor/pull/17):
  source-aware furniture editing and undo.
- [PPTX PR34](https://github.com/OpenPresentation/opf-pptx/pull/34): furniture
  provenance and export, including corrected slide-master declarations.
- [Renderer PR21](https://github.com/OpenPresentation/opf-render/pull/21),
  stacked on PR20: prepared source-preserving shaping, compressed-font and
  collection handling, DFont extraction, and fixed variable instances.

Fresh GitHub inspection confirms successful checks on core PR79 at `f6d4434`,
renderer PR20 at `3d4fa8c`, editor PR17 at `40023fb` and PPTX PR34 at `1363a65`.
Renderer PR21's completed `a5f3ec6` CI passes Mac/Windows shaping and all earlier
Linux checks, including the 805-slide regression and coordinated packages.
Both Linux source and fresh installed variable browser gates then fail the
unchanged 0.1px advance tolerance. The complete reports remain preserved; pixel
comparisons match within each platform. Passing diagnostics do not establish
native font fidelity.

Renderer `1b17e70` separates browser versions and kerning settings in the native
diagnostic. The later implementation commit `489273e` corrects fixed-point
coordinate normalization, axis endpoint defaults and exact tags; evidence
commit `e293b55` preserves its independent reference, source and installed
results. Both commits are pushed. All 188 FreeType instance coordinates,
143,207 CFF2 glyph diagnostics and the unchanged 805-slide regression pass.
Fresh packages verify 37 shipped hashes and TypeScript consumers. The September
15 follow-up `1b3da21` corrects CFF2 advances before positioning; `41311de` adds
reviewed glyph-paint diagnostics and complete retained evidence. Both are
pushed. All 356 default Fontkit Mac browser cases now pass; five optional
HarfBuzz TrueType width comparisons still fail. New-head CI remains separate. See
[font-shaping.md](font-shaping.md) for exact evidence and remaining font/native
acceptance requirements.

Implementation fixes, test/evidence improvements and integration documentation
are recorded as separate focused commits. All 22 local branch tips across the
seven repositories were compared directly with GitHub with no unpushed commits;
the subsequent renderer checkpoint was also pushed. The only retained untracked
files are the 12 demo copies already merged into core `origin/main`.

## Still outstanding

The website JSON control has not yet been extracted into the reusable
`opf-editor` package. OPF has strict document validation and composition
diagnostics, but no unified agent-facing `opf lint` contract/repair command.
The shared furniture and font drafts have not been published as new package
versions or adopted by the production sites. Native Office compatibility
remains a separate gate under its existing recovery constraints.

`pptx-gallery` and `pptx-dev` had no local changes and matched their remote
default branches (`main` and `master` respectively). Every existing local
branch tip in the seven repositories was compared directly with GitHub before
the new checkpoint commits, with no unpushed commits found.
