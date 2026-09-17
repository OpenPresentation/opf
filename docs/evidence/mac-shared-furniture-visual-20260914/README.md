# Furniture visual and CI continuation

The initial source/installed checkpoint remains immutable in
`../mac-shared-furniture-resume-20260914`. The visual review now completes the
previously pending 657-slide comparison.

Renderer commit `d0ff86abe6e67436a5674778605bc8562314ad1c` contains
`docs/evidence/furniture-corpus-review`: 83 paired contact sheets covering every
changed slide, seven original-size before/after controls, source/runtime file
hashes, reproducible generation, review observations, and the original local/CI
raster failures. The predecessor reproduced all 805 accepted timeline entries;
the candidate uses the same 126-deck source digest. A separate furniture baseline
was promoted after review, leaving the timeline baseline unchanged. The full
local renderer suite then passed, including its 805-slide gate.

Drafts: [core #79](https://github.com/OpenPresentation/opf/pull/79),
[renderer #20](https://github.com/OpenPresentation/opf-render/pull/20),
[editor #17](https://github.com/OpenPresentation/opf-editor/pull/17),
[PPTX #34](https://github.com/OpenPresentation/opf-pptx/pull/34).

First-pass results before visual promotion:

- Core package verification and Mac/Windows CLI passed.
- Editor CI passed, including installed offline workflows.
- PPTX CI passed on Linux and Windows, including current-native provenance
  conversion controls and installed workflows. These are not Office COM tests.
- Core ecosystem and renderer CI stopped at the expected 657-slide baseline
  difference. The reviewed renderer pin now allows fresh runs to reach the
  remaining checks; acceptance requires those current-head runs.

The latest Windows handoff remains
[the Node 24 follow-up](https://github.com/OpenPresentation/opf/pull/71#issuecomment-5627652201).
No native Office calls or process cleanup were attempted. Native image opening,
tab tolerance, physical-font/glyph fidelity and the Akasia mark finding remain
separate unresolved gates. No restricted Aptos package was used. New registry
versions and furniture adoption by the three public sites are still pending.

The homepage JSON editor was independently merged in
[website #29](https://github.com/Data-Advantage/openpresentation-site/pull/29)
at `31aa4d574a08ef3c514a04ae06feaf6356a9e41a`. Production Vercel deployment
`dpl_DTYr72zCQCJsr6ePgxgRt1icmE5E` is READY and aliases both public domains.
All nine browser tests passed against `https://www.openpresentation.org`, and
live JSON-to-slide editing was visually verified. That deployed change uses the
published core validator; it did not release the furniture packages.
