# Superseded changelog draft cleanup — 2026-09-21

Closed the three drafts explicitly identified by the user after reviewing their exact diffs and current release documentation on live GitHub main. No branches were deleted and no comments were posted.

| Repository | Closed PR | Old draft | Current main release | Reviewed main |
| --- | --- | --- | --- | --- |
| OpenPresentation/opf-editor | [#24](https://github.com/OpenPresentation/opf-editor/pull/24) | 0.7.1 | 0.8.0 | `476191e28e6f5f5ec32146aeb416f5286b4d0570` |
| OpenPresentation/opf-render | [#26](https://github.com/OpenPresentation/opf-render/pull/26) | 0.8.1 | 0.9.0 | `114bf596e9034c0b80a8c92df6a956a04ef18bef` |
| OpenPresentation/opf-pptx | [#40](https://github.com/OpenPresentation/opf-pptx/pull/40) | 0.8.1 | 0.9.1 | `fcc006a6887c549a96a3bc8bbdb957cc54fe67dd` |

## Preserved details

All three main READMEs and changelogs already identify the current release train. The historical changelog entries proposed by these drafts were never merged:

- Editor 0.7.1: missing layout placeholders are populated while retaining existing content, including zero values/subtitles, with one undoable edit. Main README already describes the layout behavior.
- Renderer 0.8.1: shared header/footer rendering consumes accepted `furniture-flow-v2` geometry. Source and furniture tests are present in main.
- PPTX 0.8.1: shared header/footer provenance participates in export/import. `src/index.js` and `src/furniture-provenance.js` are present in main.

The parent task confirmed before closure that OPF #93's current compatibility matrix explicitly retains published `furniture-flow-v2` and `OPF_FURNITURE_V1` provenance. Exact old proposed prose remains in the saved `.diff` files and closed GitHub drafts; branch heads are preserved. The old 0.8.0 changelog exclusion sentences remain historical and were not rewritten.

Native PowerPoint fidelity and renderer issue 24's 0.1px Linux width gate remain separate and unresolved; this cleanup makes no new compatibility claims. Geometry and native Header/Footer drafts were not changed.

## Evidence

`summary.json` records main/head SHAs, version checks, closure timestamps, retained branch validation, and SHA-256 hashes of the reviewed main documentation. Each PR has full before/after JSON, exact diff, command receipt and branch-ref receipt. No runtime tests were run for this GitHub lifecycle-only cleanup.
