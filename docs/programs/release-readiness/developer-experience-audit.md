# RR-59: new-developer audit follow-up

The owner requested fixes on 2026-10-07 after a review with four clean GPT-6.1 developer contexts
(website, internal app, automation, platform evaluation), each exercising 30 scenarios. The ledger
recorded 94 passes, 17 partial outcomes, seven failed scenarios and two environment-blocked checks.
The failures include repeated discoveries of the same issue and documentation contradictions;
these numbers are not a reliability percentage. A separate 127-file public corpus passed schema
validation, not visual/native certification.

## Scope and acceptance

| Audit finding | Repository | Required outcome |
| --- | --- | --- |
| AUTO-26: silent image replacement | opf-pptx; CLI integration | Unresolved image emits one path-specific diagnostic; strict warning gate refuses output; local valid images still embed; no network fetch introduced. |
| AUTO-18: numeric table self-roundtrip | opf-pptx | Full provenance restores unchanged authored scalar types and styles, including number versus numeric string; native text/format edits are preserved. Narrow universal exactness claims. |
| WR-09: Arabic measured export | opf-pptx | Loaded script faces are used consistently for measurement; Arabic and mixed-script SVG/PPTX controls complete with the same handle; custom measurement remains supported. |
| AUTO-19: data helper declarations | opf | Literal table/chart imports compose into public Presentation types without casts; chart rows and columns are nonempty; general/table parsing still accepts header-only input. Packed consumer compilation covers both modes and a dynamic union. |
| WR-04: optional design parent | opf-editor | Catalog selection creates known missing parents atomically; one Undo restores their absence; invalid IDs leave no partial parent/history; DOM/React/Svelte bindings share the fix and surface errors. |
| AUTO-25: script fonts in standalone SVG | CLI | Default used-font SVG requests installed script bytes; none mode remains viewer-dependent; raster exports do not pay for unused script data URLs. |
| WR-02: repeated font payload | opf-render | Standalone output selects resolved used faces; explicit shared/external SSR modes preserve measurement and offline fidelity; unrelated Office faces are absent. |
| WR-03: browser delivery cost | opf-render; site | Measure compressed JavaScript separately from font requests; provide a usable pre-rendered/deferred path and explain exact-font requirements without promising an unmeasured size budget. |
| WR-05: exit focus | opf-render | Restore invoking/explicit target, with disconnected-target fallback; direct player behavior remains covered. |
| WR-01: literal HTML recipe | site | Copy-run website/editor/Node starters name their module-resolution/build prerequisites, use local decks and self-hosted fonts, compile and run against installed packages. |
| WR-06 / WR-07: stale FAQ / dataset copy | site; core docs | Visible and structured FAQ reflect the player; current CLI dataset recipe runs; current install pins and helper return names agree with packages. |
| Additional recovery friction | CLI; renderer; docs | Hyphenated catalog discovery, fill recovery hints, Node support text, JSON/text reporter guidance, source URL/HTML error context and practical font-worker guidance are accurate. |

WR-08 was rejected as a defect: the compatibility matrix explicitly labels historical evidence.
Do not rewrite dated measurements as current certification. Accessibility/screen-reader checks,
native PowerPoint, IME, collaboration, authenticated persistence and sustained-load certification
were not established by this audit; an environment-blocked probe is not evidence of a product bug.

## Delivery plan

Five focused PRs: core/CLI consumer contracts; PPTX integrity and provenance; renderer delivery and
focus; editor catalog controls; website onboarding. Each includes relevant regression checks and
changelog fragments where required. The supervisor owns cross-repository verification and the
burndown. Source, packed, published-package and native claims remain separate. These are fix PRs;
publishing follows the existing release gates after merge, not an ad hoc package release.

Initial verification targets are the audited core/render/PPTX/CLI 0.14.0 and editor 0.14.2 behavior.
Changes start from freshly fetched main. No golden tolerance, font license requirement, deterministic
runtime rule or no-network asset policy may be weakened to make the checks pass.

## Review artifacts and local verification

| Logical change | Pull request | Local verification |
| --- | --- | --- |
| Core / CLI contracts | [opf#449](https://github.com/OpenPresentation/opf/pull/449) | Full package and 28 root checks; packed TypeScript 5.9 / 7 consumers, NodeNext and Bundler. Tracker checks use the documented PR warning policy; default strict behavior remains. |
| Renderer delivery and focus | [opf-render#158](https://github.com/OpenPresentation/opf-render/pull/158) | 87 tests, 807 unchanged golden slides, packed consumer, browser focus/error recovery, offline and hydration pixel comparisons. |
| Editor catalog controls | [opf-editor#126](https://github.com/OpenPresentation/opf-editor/pull/126) | 61 tests, typecheck, packed/browser controls; DOM, React and Svelte catalog actions and undo/redo. |
| PPTX integrity | [opf-pptx#203](https://github.com/OpenPresentation/opf-pptx/pull/203) | 107 suites, packed consumer, browser flows, 127 packed examples Node-identical; native edit preservation controls and custom class-based measurement providers. |
| Executable onboarding | [openpresentation-site#91](https://github.com/Data-Advantage/openpresentation-site/pull/91) | Typecheck/test/build (729 pages), three archive regressions, clean installed Vite website/editor and Node five-format exports, current CLI dataset recipe. |

The supervisor independently reviewed the changes and replayed the starter in a real browser:
edit/commit, undo/redo, PowerPoint and PDF export statuses, and website slide navigation passed
with no console errors. A browser download-event tool stalled; the successful status flow is not
a downloaded-byte or native Office certification. Package and Node output tests cover file bytes.

A fresh installed consumer of all five candidates passed six actual CLI cases: Japanese SVG embeds
two pinned JP faces; Latin embeds only its two Roboto faces; no-font SVG has identical measured
geometry and no font bytes; unresolved remote images warn with a placeholder by default and refuse
output at the warning threshold; a valid embedded PNG exports native picture bytes with exact decoded
pixels. The remote image server received zero requests. These checks ran on Node 26.7.0; the PPTX and
site full suites ran on Node 24.21.0. Candidate hashes and exact commands are retained in the owner's
audit artifacts. PR CI is a separate batched gate; none of these PRs is merged, published or deployed.

Measured renderer delivery: the three-slide shared HTML is 229,080 bytes gzip versus 686,437 bytes
standalone. A two-face standalone SVG is 430,764 bytes; the Japanese CLI fixture remains 14,593,462
bytes because it embeds full CJK faces. Deferred bootstrap is 199 bytes gzip, with 581,272 bytes of
measurement JavaScript after interaction plus font requests. This is a measured delivery recipe,
not a claim that the engine or CJK fonts have become small.

## Rebase onto OPF 0.15 (2026-10-08)

The five PRs were opened against 0.14 and rebased onto 0.15 (core 0.15.1, renderer, PPTX, editor and CLI 0.15.0, plus
RR-60, RR-61, FA-28 and FA-29 on main) for the 0.16.0 lockstep train. What changed in each:

- Core / CLI: `importData` types `chart.type` and the `chartType` option as the 0.15 chart-type vocabulary
  (`ImportedChartType`), and the CLI checks `--chart-type` against `CHART_TYPES`; `opf catalog` keeps the hyphenated
  kind names on the 0.15 grouped catalog (records keyed by id). The packed-ecosystem harness changes are dropped: they
  only followed the renderer's former `embed: "used"` change, and main's harness installs local test helpers itself.
- Renderer: RR-61 already embeds only the faces each SVG draws (WR-02), so marking every Node handle face
  `embed: "used"` is dropped. Kept: `renderDeckHtml` `fontMode` (external now uses RR-61's `embedFonts: false`),
  per-style used-face selection, presentation focus (WR-05), fetch-error context and the delivery recipe and
  measurement (WR-03, re-measured on 0.15).
- PPTX: the unresolved-image diagnostic moves into the 0.15 image-block path; script-aware measurement passes the
  host catalogs to `resolveScriptFonts`; table provenance is unchanged in intent.
- Editor: the optional design parent fix is unchanged in intent; its regression registers the default catalog and uses
  0.15 string references.
- Site: openpresentation.org is still on 0.14 on its default branch, so the starters keep the site's advertised 0.14
  pins until FA-25 moves the site to 0.15.
