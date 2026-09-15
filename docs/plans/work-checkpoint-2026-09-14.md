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

All five PRs had successful CI on their preceding pushed heads. The new
renderer checkpoint `28bd820286e0bf28b2efcaca3610d56988b1079e` retains a known
failure: 10 of 712 variable-instance browser advance comparisons exceed the
unchanged 0.1px tolerance, although all pixel comparisons match. Its Node matrix
and the existing full 805-slide regression pass. CI now includes the failing
browser gate; its new results must be checked separately from the preceding
green DFont run. See [font-shaping.md](font-shaping.md) for exact evidence and
remaining installed-package, payload, font and native acceptance requirements.

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
