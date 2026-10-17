# First-use tests, 2026-10-16: findings and plan

Two agents ran a cold first-use test from https://www.openpresentation.org and each delivered a ZIP (kept locally in `artifacts/`, which git ignores):

- **Ben**: Windows 25H2, Node 24, CLI 0.20.0, core 0.20.3, renderer 0.20.2, PPTX 0.20.3. Six-slide game pitch with a dark theme. No PowerPoint or Keynote.
- **Matt**: macOS 26.4, Node 24, CLI 0.20.0, core 0.20.1, renderer 0.20.0, PPTX 0.20.2. Six-slide status deck with a custom colour scheme and Arial, compared in Keynote 14.4. No PowerPoint.

Both decks validated and exported with zero findings. Line breaks in Keynote matched the preview exactly. The problems are in PPTX editability, colour and type defaults, and diagnostics.

Every finding below was checked against `main` of core (`c9677634`), opf-render (`e179673`, 0.20.4) and opf-pptx (`f06c3c6`, 0.20.4) on 2026-10-17. Only the `create --from` documentation item is already fixed. Draft [PPTX #277](https://github.com/OpenPresentation/opf-pptx/pull/277) (RR-86) is noted where it overlaps.

## Findings by status

| Finding | Testers | Severity | Status on main | Where |
| --- | --- | --- | --- | --- |
| One PPTX text box per wrapped line; edits overlap | Matt P1 | High | Open; #277 adds opt-in `bodyText: "native"` for one simple body per slide, with no CLI flag | opf-pptx `src/index.js:2378-2422`, `:2989-3035` |
| Wrapped title is not the title placeholder | Matt P2 | High | Open; #277 leaves titles unchanged | opf-pptx `src/index.js:2171` (`lines.length === 1`) |
| Chart series ignore `design.colorScheme` | Matt P3 | Medium | Open | Fixed palette copied three times: opf-render `src/charts.js:12-20`, core `rule-design.ts:399`, opf-pptx `src/index.js:202` |
| Footer zones fixed at 26% width and 7% inset | Matt P4 | Medium | Open | core `composition.ts:893` |
| Slide number `N / total` shows only `N` in Keynote | Matt P7 | Medium | Open | opf-pptx `native-furniture.js:39-64`, `furniture-fields.js:158-208` |
| Table and chart text at 12 pt next to 24 pt bullets | Ben P1 | Medium | Open | core `composition.ts:2218` (table asks for 15 px); opf-render `charts.js:194` (14 px) |
| Native chart axis has no max or major unit | Ben P3, Matt P8 | Low | Open | opf-pptx `index.js:2776-2781`; the preview scale is `niceScale` in opf-render only |
| Tag follows `contentAlignment`, not `titleAlignment` | Matt P5 | Low | Open | core `composition.ts:2428` |
| Rich (`TextRun[]`) numeric cell loses format and right alignment | Matt P6 | Low | Open | core `composition.ts:2225-2244`, `chart-data.ts:820` |
| 99 schema errors for one bad `padding` | Ben P2 | Low | Open; only three unions collapse today | core `schema-check.ts:221`, `:947-1024` |
| Missing local image passes `validate` | Matt P13 | Low | Open | core `validation-rules.ts:95`; files are first read in `node/assets.ts` |
| `opf stats` counts 0 sources for `chart.data.source` | Matt P10 | Low | Open | core `stats.ts:513-516` |
| PDF report lists only the first embedded face | Matt P11 | Low | Open: `Reporter.add` dedupes on rule, path and message, which are all empty | core `node/reporter.ts:76` |
| Re-import of a pristine export: 13–14 warnings, image becomes a `data:` URI | Matt P9, Ben | Low | Open | opf-pptx `*-provenance.js` (unconditional warnings), `index.js:1209` |
| `create` fails with `EPERM` on hard link in sandboxes | Ben T2 | Low (environment) | Open; no fallback after `link` | core CLI `io.ts:104` |
| Author skill shows removed `create --from` | Ben D1, Matt D2 | Medium | **Fixed** in #698, shipped in CLI 0.20.1; the live site updates on its next deploy | — |
| "Editable PPTX" claim without the per-line caveat | Matt D1 | High | Open | site `app/page.tsx:140`, get-started |
| No guidance on chart colours, footer width, source lines | Matt D6, D7 | Medium | Open | `docs/chart-options.md`, `format-card.md` |
| No single runnable end-to-end example; skills heavy on jargon | Ben D2, Matt D8 | Medium | Open | skills, site get-started |
| Version and snapshot labels confusing on the homepage | Matt D3, D4 | Low | Partly: the stale `0.13.2` and `0.9.1` strings are gone | site homepage |

## Plan

Every finding in the table above is in scope, not only the top ten. Each workstream is an RR item: W1 is RR-88 and so on through W8, which is RR-95. Branches are `codex/rr-<nn>-<slug>` and PR titles start with `RR-<nn>: `. The workstreams are ordered by their value to a first-time user, then by size.

### Repositories

| Repository | Path | W1 RR-88 text | W2 RR-89 colours | W3 RR-90 type | W4 RR-91 footers | W5 RR-92 axis | W6 RR-93 diagnostics | W7 RR-94 re-import | W8 RR-95 docs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| opf (core, CLI, skills) | `opf` | `--body-text` CLI flag | `chartSeriesPalette`; replace `DEFAULT_CHART_PALETTE` | table and chart sizes, `typeScale` | zone geometry, crowding rule | move `niceScale` to core, axis in composition | all seven fixes | — | skill-command check, glossary, styled-table example |
| opf-render | `opf-render` | — | use core palette; delete `CHART_SERIES_COLORS` | chart text size (`charts.js:194`) | draws new geometry (floor bump) | read the core axis; delete local `niceScale` | — | — | — |
| opf-pptx | `opf-pptx` | native body and title (builds on #277) | `schemeClr accentN`; delete `CHART_COLORS` | — | `slidenum` plus literal runs outside `sldNum` | write `c:max` and `c:majorUnit` | — | quiet pristine import, keep authored `src` | `opf-export` skill caveat lives in core |
| opf-editor | `opf-editor` | — | — | — | floor bump; footer controls unchanged | — | expose `bold` in `setTableStyle` (`table-options.js`) | — | — |
| gallery (`@openpresentation/gallery`) | `gallery` | — | regenerate previews | regenerate previews | regenerate previews | regenerate previews | none: `metrics.json` keeps `contentAlignment: center`, and the core fix makes `titleAlignment` govern the tag | — | — |
| pptx.gallery | `pptx-gallery` | caveat at `app/docs/page.tsx:226` | palette order on chart and colour-scheme pages; per-series colour if W2.3 lands | — | `data/headers-footers.json` zone geometry text | — | — | — | — |
| pptx.dev | `pptx-dev` | pass `bodyText` in `lib/opf-toolkit/browser-runtime.ts:98`; expose it in `app/openapi.yaml` and the four SDKs | `lib/samples/opf/*.json` restate cool-horizon accents; recheck | — | — | — | — | — | — |
| openpresentation.org | `openpresentation-site` | caveat on `app/page.tsx:140` and get-started; pass `bodyText` in `lib/export-deck.ts` and `starters/*/export.mjs` | — | — | — | — | — | — | tutorial, starter ZIP, version table; `agent-docs` regenerate from `.opf-source` on build |

Gallery records are owned by pptx.gallery and published through the gallery repository (see `docs/default-catalog.md`). Preview regeneration follows the gallery's own version rule. None of these workstreams changes a record.

### Execution split

These sessions can run in parallel because they touch different files:

| Session | Scope | Repository | Waits for |
| --- | --- | --- | --- |
| A, this session | Core composition and design: W3, W4.1–2, W5 core, W2.1, plus the tag-alignment and rich-cell parts of W6 (all in `composition.ts` or next to it) | opf | — |
| B | Core diagnostics: the rest of W6 (`schema-check.ts`, the validate asset check, `stats.ts`, `reporter.ts`, `io.ts`) | opf | — |
| C | PPTX: W1 on top of #277, W4.3, W7 | opf-pptx, then the CLI flag in opf | — |
| D | Docs: W8 plus the W1 caveats and the W4 footer docs | opf `skills/`, openpresentation-site, pptx-gallery | — |
| Later | Renderer and PPTX consumers of the core palette and axis (W2.2, W5), the editor `bold` control, `bodyText` wiring in pptx.dev and the site, gallery preview regeneration | opf-render, opf-pptx, opf-editor, pptx-dev, openpresentation-site, gallery | A and C released |

### W1. Editable PPTX text (PPTX; owner decision on the default)

Covers Matt P1 and P2, plus the D1 caveat.

1. Land #277's `bodyText: "native"` and expose it in the CLI as `opf convert --body-text native|measured`.
2. Extend native mode to titles: a wrapped plain-string title binds to the Title placeholder, with `normAutofit` off and the measured box size. Rich titles keep the measured path until rich runs are supported.
3. Extend native mode to the remaining body shapes one at a time: several body regions per slide, numbered lists, then nested lists. Each step needs its own Keynote check, and a PowerPoint check when one is available.
4. **Owner decision:** make `native` the default once Keynote and PowerPoint qualification passes. Until then, state the per-line behaviour next to every "Editable PPTX" claim on the homepage, get-started and the `opf-export` skill. Add a short screenshot of what editing looks like.

Acceptance: Matt's deck exported with `--body-text native` passes his slide-2 edit test in Keynote, and Keynote reports `title showing=true` on all six slides.

### W2. Chart colours follow the deck (core, renderer, PPTX)

Covers Matt P3 and D6.

1. Add one core function, `chartSeriesPalette(design)`, that returns `accent1` to `accent6` of the resolved colour scheme, followed by the extended tints. Delete the three copied palettes, and use the function in the renderer, the PPTX exporter and the colour-blind rule.
2. Write series fills in PPTX as `schemeClr accentN` when the colour is a theme accent, as `chart-highlight.js` already does.
3. Decide whether to add per-series colour (`chart.series[].color` or `chart.colors`). Pre-v1, so no alias is needed (see the format-audit program).
4. Document the palette order and the highlight behaviour in `docs/chart-options.md`.

This changes every chart preview that uses a non-default scheme. Regenerating the Gallery previews follows the Gallery repository's process: a changed record or preview is a major release there. Coordinate the change through the next release train.

### W3. Presentation-sized type (core, renderer; geometry change)

Covers Ben P1 and D2.

1. Raise table cell text to the body size (25 px, about 19 pt) and let `fit` shrink it toward `minFontSize` when rows don't fit, the way bullets work today. Raise chart axis and label text to match.
2. Optionally add `composition.typeScale`, one multiplier for the body, table and chart sizes.
3. Add a styled-table example (rich runs, `fontSize`, a padding object) to the `opf-author` content guide.

Text moves on existing decks, so this needs a core release with raised lockstep floors and font-tracker and gallery-tracker refreshes (in their own PR, per `AGENTS.md`).

### W4. Footers and page numbers (core, PPTX)

Covers Matt P4, P7 and D7.

1. Lay out footer zones on the content inset (`design.margins`). Let a zone take the width of empty neighbours, so a lone `left` zone can span to the content edge.
2. Add a validator warning when a footer wraps past two lines, with the hint "move the source to a caption or note".
3. PPTX: for `{{slide.number}} / {{deck.slideCount}}`, put the `slidenum` field and the literal runs in a plain text box rather than a `sldNum` placeholder. Keynote drops the literal runs around the field in a `sldNum` placeholder. Keep `sldNum` for a field on its own. Check it in Keynote.
4. Document footer zone geometry and where per-slide sources belong.

### W5. Native chart axis parity (core, renderer, PPTX)

Covers Ben P3 and Matt P8.

Move `niceScale` and `maxIntervalsFor` into core and compute the value axis (min, max, major unit) during composition from the chart box size. The renderer and the PPTX exporter both read it, and the exporter writes `c:max` and `c:majorUnit`. Keynote should then show the preview's 0–800 axis in steps of 100.

### W6. Diagnostics and small core bugs (core, CLI; one or two PRs, no geometry change)

| Fix | Detail |
| --- | --- |
| Schema error best match | When every error comes from a union's branches, report the deepest error on the branch whose `type` matched (`padding` must be object) and move the rest to `details.alternatives`. Test with Ben's `evidence/invalid-padding.opf.json`. |
| Local asset check | `opf validate` warns `asset-missing` when a relative image or logo path doesn't exist next to the deck. Add `--asset-dir` to match `convert`. |
| `opf stats` sources | Count `chart.data.source` as a source, separately from inline data. |
| Reporter dedupe | Include `details` (the font name) in the dedupe key, or give `pdf-font-embedded` a message. |
| Tag alignment | The tag follows `titleAlignment` whenever the slide or layout sets one. The subtitle stays as it is. |
| Rich numeric cells | A `TextRun[]` cell whose column is numeric keeps the column's alignment. Add `bold` to `TableCellStyle` so a numeric cell can be bold and still formatted. |
| Atomic write fallback | On `EPERM`, `ENOTSUP` or `EXDEV` from `link`, fall back to an exclusive `open(…, 'wx')` and copy, keeping the no-overwrite guarantee. |

Each fix needs a changes fragment and one test file.

### W7. Re-import of a pristine export (PPTX)

Covers Matt P9.

1. When the document tag shows an unedited OPF export (geometry hashes match), collapse the per-group reflow warnings into one info finding.
2. Record the authored image `src` in `OPF_IMAGE_V1` and restore it on import when the bytes still match, instead of always writing a `data:` URI.

### W8. First-use documentation (core skills, site)

Covers Ben D1–D2 and Matt D1, D3–D8.

1. Write one "first deck in ten minutes" page: brief, `deck.opf.json` with bullets, metric, chart, table and local image, then validate, PNG, PPTX, and opening in PowerPoint or Keynote. List the known limits (W1 line boxes, fonts not embedded, footer width) beside it, and ship it as a runnable starter ZIP.
2. Add a CI check that runs every `opf …` command quoted in `skills/**` against the built CLI, so a removed option fails the build instead of reaching users.
3. Show one compatible-set table, generated from `ecosystem.lock.json`, on the homepage and `/agents`. Stop showing a bare core version and two snapshot hashes.
4. Add a short glossary (furniture, promoted region, provenance, reflow) to each skill's first screen.

Site work stays on localhost per the Cloudflare hosting rules. Deployment rides the RR-87 batch.

## Suggested order

1. **W6 and W8.2** first: small, no geometry change, and they fit in a patch release.
2. **W4.3** (slide number) and **W1.1–W1.2** (CLI flag and title placeholder) next, building on #277.
3. **W2**, **W3** and **W5** together in one minor release, since each moves previews and needs one gallery regeneration. The consumers in opf-render, opf-pptx, opf-editor, pptx-dev and openpresentation-site then raise their core floor together, in dependency order (core, then renderer and PPTX, then editor), per `docs/release-process.md`.
4. **W1.4** (the default flip) after native qualification. **W7** and the rest of **W8** can run alongside.

## Not tested by either tester

Microsoft PowerPoint, the browser editor and playground, custom fonts (`--fonts`), non-Latin scripts, pagination, Markdown authoring, and editing chart data or table cells in a native app. A PowerPoint pass on both decks is the largest remaining gap before W1.4.
