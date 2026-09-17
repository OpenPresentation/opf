# Copy/paste prompt for the next project owner

**Current pins (17 Sep 2026):** npm `@openpresentation/opf@0.10.1`,
`opf-render@0.8.1`, `opf-editor@0.7.1`, `opf-pptx@0.8.1`, `cli@0.8.1` on
Node 24. `furniture-flow-v2` is in that set. [PR 91](https://github.com/OpenPresentation/opf/pull/91)
is squashed and merged. Issue88 Inspector overlay/json-options, gallery
Playground+Editor links, and the Header & footer playground example are **live**
on `www.pptx.dev` / `www.pptx.gallery` / `www.openpresentation.org` (squash
`17de6da` / `c7d3754` / `ea0d032`). GitHub [issue 88](https://github.com/OpenPresentation/opf/issues/88)
stays **open**. Start from [handoff-2026-09-16](handoff-2026-09-16.md). The
developer-ready milestone is **not** complete. Do not implement `p:hf`. Do not
weaken issue 24.

Continue OpenPresentation as its primary project owner. Build on accepted work,
keep changes committed and pushed through focused PRs as you go, and carry the
next bounded developer-readiness milestone through validation and release.
Do not restart the ecosystem or redesign the published websites.

Read OpenPresentation/opf docs/handoff-2026-09-16.md, docs/status-2026-09-16.md,
docs/plans/developer-adoption-20260915.md,
docs/plans/deferred-shaping-20260915.md and
docs/plans/ecosystem-objective-2026-09-09.md. Inspect current defaults, PRs,
registry and deployments: these files are dated checkpoints, not assumptions
that nothing has changed. The 15 Sep handoff/status files remain historical.

Repositories: OpenPresentation/{opf,opf-render,opf-editor,opf-pptx} and
Data-Advantage/{openpresentation-site,pptx-gallery,pptx-dev}. Default branches
are main except pptx-dev/master. Local clones are under /Users/michael/Source;
use GitHub if those paths do not exist. Use Node24, pinned lockfiles/package
managers (pnpm10.33.2 core/site/gallery, pnpm11.1.3 pptx-dev, npm libraries),
each AGENTS.md and relevant OPF skills. Schemas/catalogs are authoritative, but
schema support does not certify editor, renderer or native export fidelity.

The 15 Sep checkpoint recorded npm @openpresentation/opf0.10.0,
opf-render0.8.0, opf-editor0.7.0, opf-pptx0.8.0 and cli0.8.0. Those pins are
outdated. Current published set is core 0.10.1, renderer/PPTX/CLI 0.8.1, editor
0.7.1. Home/playground have editable JSON, live previews, preview edits back to
JSON, contextual catalog choices and code-editor assistance. Preserve their
appearance. Lint and contextual design contracts exist. The CLI supports create,
validate, lint, revision-guarded JSON edits, data import, pagination,
schemas/catalogs and six-skill installation/update/status. Check actual help
before promising other commands; rendering/export is available through
documented library/UI APIs.

The cleanup accepted eleven dependency updates and four furniture increments
(core79, renderer20, editor17, PPTX34), and closed the Node26-types update.
Four shaping PRs (core83, renderer21, editor21, PPTX35) conclude with docs/
evidence only. Their prototypes are archived, not released. Furniture APIs
shipped in 0.10.1 / 0.8.1 / 0.7.1; do not cut another npm release for missing
furniture. PPTX furniture is tagged slide shapes (`OPF_FURNITURE_V1`), not
native Office Header/Footer objects (`p:hf` / notes master). That native
requirement is issue87 only — do not implement it as remaining developer-ready
package work. The public sites passed 41 production browser workflows at the
15 Sep handoff commits; retain evidence and rerun affected flows when changing
them.

[PR 91](https://github.com/OpenPresentation/opf/pull/91) merged the independent
registry-install quickstart and compatibility matrix onto main. Re-run
`pnpm test:developer-quickstart` against live npm, not unpublished local
tarballs. Production issue88 features above are live; leave GitHub issue88
**open** until its checklist is fully satisfied. Do not describe geometry
drafts or homepage-renderer as shipped. Do not mark the developer-ready
milestone complete. Issue24 stays deferred at the unchanged 0.1px gate. Do
not implement native `p:hf`. Do not publish npm from this docs checkpoint.

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

Native PowerPoint acceptance is split into core issue87 and its plan. Preserve
image opening, provenance edit/save/reopen, tabs, notes-master ordering and
physical font identity/embedding gaps. Compiling furniture into real Office
Header/Footer objects (`p:hf` / notes master) is that issue only; today's
export uses tagged slide shapes (`OPF_FURNITURE_V1`). Serialization/self-import
are not native acceptance. Do not retry Windows COM or kill Office processes until host recovery
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
