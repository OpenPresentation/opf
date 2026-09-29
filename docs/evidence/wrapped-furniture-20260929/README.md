# Wrapped furniture acceptance receipt

This derived [receipt](acceptance.json) binds the reviewed local candidate to
accepted core, renderer, editor and PPTX sources and names the original evidence
manifests. Full original logs, ZIPs, screenshots, tarballs and source inventories
are retained in the private durable archive. First failures are preserved.

The unchanged browser fixture fails with accepted PPTX357 because a wrapped
current date has no fallback diagnostic and loses generated intent on import.
With accepted [PPTX84](https://github.com/OpenPresentation/opf-pptx/pull/84), four
installed browser cases, eight exported PPTX files and nineteen installed date
mutation controls pass. All four screenshots were reviewed. The original
41 other files and 19 directory entries are unchanged by the repair; the
existing PPTX date remains static. Generated OPF intent is recovered only for unchanged,
supported full-provenance dates. Edited and cleared current content wins.

The first package check overlapped a core build that cleaned its generated
output and failed importing a missing chunk. Both logs and timestamps remain;
the unchanged package command passed when run sequentially. The exact missing
file instant was not instrumented. This is separate from the expected old
exporter regression and from original GitHub CI outcomes.

Accepted [core152](https://github.com/OpenPresentation/opf/pull/152) passed its
original and accepted-main workflows. PPTX84 passed its original Linux/Windows
workflow and its separate accepted-main run on that workflow's older pinned
graph. Both original outcomes and artifact bindings are retained. The new coordinated core candidate uses the current graph;
its associated pull request records fresh exact-head CI and review after these
local checks. Historical registry fixtures remain unchanged.

Official npm latest metadata still reports core0.11.0, CLI/render0.9.0,
PPTX0.9.1 and editor0.8.0. No package or site release is established here.
Compatible published dependency floors, full registry-set acceptance and the
separate native/font/refresh/save/reopen gates remain required. No Office
operation, tolerance relaxation or arbitrary native-format reconstruction is
claimed. See the [current handoff](../../handoff-runtime-2026-09-29.md).
