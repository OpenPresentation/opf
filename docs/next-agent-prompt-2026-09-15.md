# Copy/paste prompt for the next project owner

**Current pins (16 Sep 2026):** npm `@openpresentation/opf@0.10.1`,
`opf-render@0.8.1`, `opf-editor@0.7.1`, `opf-pptx@0.8.1`, `cli@0.8.1` on
Node 24. Furniture is in that set. Start from
[handoff-2026-09-16](handoff-2026-09-16.md), the
[developer quickstart](quickstart.md) and the
[compatibility matrix](compatibility-matrix.md). The 15 Sep files below are
dated checkpoints.

Continue OpenPresentation as its primary project owner. Build on accepted work,
keep changes committed and pushed through focused PRs as you go, and carry the
next bounded developer-readiness milestone through validation and release.
Do not restart the ecosystem or redesign the published websites.

Read OpenPresentation/opf docs/handoff-2026-09-15.md, docs/status-2026-09-15.md,
docs/plans/developer-adoption-20260915.md,
docs/plans/deferred-shaping-20260915.md and
docs/plans/ecosystem-objective-2026-09-09.md. Inspect current defaults, PRs,
registry and deployments: these files are dated checkpoints, not assumptions
that nothing has changed.

Repositories: OpenPresentation/{opf,opf-render,opf-editor,opf-pptx} and
Data-Advantage/{openpresentation-site,pptx-gallery,pptx-dev}. Default branches
are main except pptx-dev/master. Local clones are under /Users/michael/Source;
use GitHub if those paths do not exist. Use Node24, pinned lockfiles/package
managers (pnpm10.33.2 core/site/gallery, pnpm11.1.3 pptx-dev, npm libraries),
each AGENTS.md and relevant OPF skills. Schemas/catalogs are authoritative, but
schema support does not certify editor, renderer or native export fidelity.

At this checkpoint npm versions are @openpresentation/opf0.10.0,
opf-render0.8.0, opf-editor0.7.0, opf-pptx0.8.0 and cli0.8.0. Home/playground
have editable JSON, live previews, preview edits back to JSON, contextual
catalog choices and code-editor assistance. Preserve their appearance. Lint
and contextual design contracts exist. The CLI supports create, validate,
lint, revision-guarded JSON edits, data import, pagination, schemas/catalogs and
six-skill installation/update/status. Check actual help before promising other
commands; rendering/export is available through documented library/UI APIs.

The cleanup accepted eleven dependency updates and four furniture increments
(core79, renderer20, editor17, PPTX34), and closed the Node26-types update.
Four shaping PRs (core83, renderer21, editor21, PPTX35) conclude with docs/
evidence only. Their prototypes are archived, not released. Check final PR/CI
states. Portable furniture geometry is in the published 0.10.1 / 0.8.1 set as
tagged PPTX shapes, not native Office Header/Footer objects.
The public sites passed 41 production browser workflows at the handoff commits;
retain evidence and rerun affected flows when changing them.

First deliver a clear starting path from real published packages: release the
accepted furniture increment in dependency order, then an independently
installable example that authors JSON, validates/lints, resolves offline fonts,
composes/paginates, edits with undo, previews and exports supported formats.
Correct stale API/version guidance in docs/skills, publish a truthful feature
matrix, and verify browser/Node boundaries without hidden sibling imports.
Update release-plan and immutable verification refs; never overwrite versions.
Inspect actual tarballs, fresh installs and intended predecessor compatibility.
Adopt features across the existing sites under core issue88 and verify canonical
production routes, not only dependency manifests.

Preserve each library's remote codex/archive-shaping-20260915 branch. Immutable
checkpoints: core 36ff66b3d62b39d7d27dcda022b7e79e541bd603;
renderer 343fb84223f4383ffe546157c6989ccc505c0acb;
editor ae4cc6426b04c7ca428c1b4acacea2e11d99fa84;
PPTX fbe9a73d012dbd51d65a39251e405e488651a70b.
They retain HarfBuzz/prepared glyphs, rich-source groups, variable/CFF work,
carets/graphemes/navigation/selection and tab/export experiments with evidence.
Resume from current main and port bounded changes; do not merge archives
wholesale. Renderer issue24 tracks the Linux native-width contract failure:
334.06213682353496px measured vs Chromium334.193115234375px at the unchanged
0.1px gate. Rounding fixes Linux but breaks macOS; some platform widths cannot
fit a common prediction within that tolerance. Define supported geometry/
painting behavior and retain failures. No offsets, platform guesses, relaxed
assertions or golden rewrites. The archived editor separately expects ten packed
rich-input checks while thirteen pass: repair and rerun that harness on resume.

Native PowerPoint acceptance is split into core issue87 and its plan. OPF
shared headers/footers **must** compile into native Header/Footer objects
(Insert → Header & Footer, notes master, `p:hf` date/slide-number/footer).
Published PPTX 0.8.1 paints `OPF_FURNITURE_V1` slide shapes and leaves `p:hf`
off; that is not the intended end state. Also preserve image opening,
provenance edit/save/reopen, tabs, notes-master ordering and physical font
identity/embedding gaps. Serialization/self-import/tagged furniture are not
native acceptance. Do not retry Windows COM or kill Office processes until host recovery
is confirmed. Do not use/distribute restricted Aptos4.40 without compatible
explicit permission. Broader fonts/IME/bidi/fallback, layout repair and complete
visual editor interactions remain planned. Current PDF is raster-backed;
selectable vector PDF, general SVG and semantic Mermaid follow font reliability.

Keep the ecosystem open, provider-neutral and locally usable without an account
or model call. No mandatory embedded AI design agent. Preserve text, images,
Unicode, whitespace, formatting, source mappings, reading order, intent and
undo. Bound layout repair and emit actionable diagnostics rather than dropping
content. Review complete rendered slides, not only metrics or hashes. Separate
source, packed consumer, registry, browser, deployment and native acceptance.

Use accurate progress updates and proceed with authorized reversible work
without repeated permission questions. Preserve existing work, use codex/
branches and focused PRs, and merge only validated scope. Store incomplete work
and failures in durable roadmap issues with evidence. Report what is committed,
merged, released, deployed, deferred and next. The broad ecosystem objective is
not complete merely because the PR queue is empty. Finish with an updated handoff.
