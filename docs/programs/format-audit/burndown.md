# Format audit: burndown

Goal, invariants, owner decisions and resume protocol: [README.md](README.md).

Status values: `todo`, `in-progress`, `review` (PR open), `done` (merged), `descoped`.
Waves: A runs first and in parallel; B starts once the A schema PRs it touches are merged, to limit conflicts in
`opf.schema.json`.

## Items

| ID | Wave | Item and acceptance | Repos | Status | PRs |
| --- | --- | --- | --- | --- | --- |
| FA-00 | A | Program docs (this file, README) | opf | review | |
| FA-01 | A | **Layout records reimagined + one content-kind vocabulary.** layout.schema: `placeholders[].type` is `title subtitle tag text list image video chart table code metric quote timeline`; a `design` object (shared `DesignHints` $def, same keys/values as deck `design`) replaces `contentType*`, `contentAlignment`, `contentBox`, `slide*` metadata; `contentType`, `contentMultiple`, `slideTitle`, `slideSubtitle`, `slideTag`, boolean `slideImage`, `contentTypeListHeading` removed; core `layoutContent(record)` derives kind/count/headings. All 100 bundled layout records migrated (values preserved, `None` dropped); composition, lint, audit, markdown, render, pptx (import too), editor pickers and the gallery read the new shape. No old name remains anywhere (grep). | opf, opf-render, opf-pptx, opf-editor, pptx-gallery | todo | |
| FA-02 | A | **Narrative: plan in the catalog, pointer in the deck.** opf.schema: `narrative` is a string; `Narrative`/`NarrativeBeat` $defs removed. narrative.schema: `duration {min,max}` (minutes) replaces `durationRange`; beat `type` (content-kind enum, no `shape`) replaces `slideType`; `layout` replaces `layoutHint`; `slideCount` removed. 48 records migrated. Lint: unknown `slides[].beat` id (warning), root `duration` outside the narrative range (warning); audit info for a beat with no slide. pptx provenance, editor, markdown and gallery updated. | opf, opf-pptx, opf-editor, pptx-gallery | todo | |
| FA-03 | A | **Chart-type catalog cleanup + no deprecated aliases.** Delete the 50 deprecated chart-type and 6 deprecated audience records; rename `*-3x` ids without suffix; `name` becomes the human name and `label` is removed; `slideNumber` removed; template-workbook internals (`workbookRange`, `columns`, `dataColumns[].position`, `helperColumns`) kept only if an engine reads them, else moved to `x-gallery`. Every fixture, test, doc and engine mapping updated. | opf, opf-render, opf-pptx, opf-editor, pptx-gallery | todo | |
| FA-04 | A | **Built-in variables + true Speaker/Organization descriptions.** `{{deck.*}}`, `{{speaker.*}}`, `{{speakers}}`, `{{organization.*}}` and `var:` forms per README; `HeaderFooterItem.speaker`; validator: unique speaker/organization ids, `organizationId` resolves; descriptions say exactly what is rendered; render + pptx draw the `speaker` furniture field; editor template panel lists built-ins. | opf, opf-render, opf-pptx, opf-editor | todo | |
| FA-05 | A | **Preview honors color roles and link colors.** opf-render resolveDesign honors `text`, `textSecondary`, `surface`, `background` role overrides exactly as opf-pptx does; links drawn in the scheme `hyperlink` color. A shared core helper if needed so both engines use one resolution. | opf-render (opf if helper) | todo | |
| FA-06 | A | **Metric sentiment.** `Metric.sentiment: positive \| negative \| neutral`; absent keeps up→positive, down→negative, flat→neutral; trend arrow keeps direction, color follows sentiment; render, pptx export + import (tag), editor control, docs. | opf, opf-render, opf-pptx, opf-editor | todo | |
| FA-07 | A | **Validation tightening and dead keys.** Hex pattern on color-scheme slots/roles (inline + record); `ColorRef` on solid/gradient/pattern colors; `TextRun.link` pattern `^(https?://\|mailto:\|tel:)`; `gradient.stops` minItems 2; `Watermark.src` required; `slides[].design.dimensions` rejected; `audience` accepts a single inline object; remove `ColorScheme.custom`, `Asset.format`, `ChartDataSource`; `Font` → family string (heading/body/accent/code, record `code`); `FontScheme.app` `powerpoint \| google-slides`; `languageFamily` adds `eastAsian`/`complexScript`; FontScheme.code and CatalogEntry.source descriptions made true; video description states the descoped native playback. Catalog records migrated. | opf, opf-render, opf-pptx, opf-editor, pptx-gallery | todo | |
| FA-08 | A | **CLI honesty.** CLI and `renderSvg` batch output skip `hidden` slides by default (`--include-hidden`); CLI output names use root `filename`, else slugified `name`, else the input stem. | opf (cli), opf-render | todo | |
| FA-09 | A | **Chart alt text.** `Chart.alt` (string); exported as the chart graphicFrame `p:cNvPr/@descr`, imported back; preview `aria-label`/`<desc>`; audit `chart-text-alternative` reads it; editor field. | opf, opf-render, opf-pptx, opf-editor | todo | |
| FA-10 | B | **Rich headline text.** `title`, `subtitle`, `tag` and `quote.text` accept `string \| TextRun[]` (cite/footnote included); composition, render, pptx export + import, editor canvas, markdown. | all four | todo | |
| FA-11 | B | **Timeline status.** `TimelineEvent.status: done \| current \| planned`, drawn from the theme (filled / emphasized "we are here" / outlined) the same in both engines; import tag; editor. | all four | todo | |
| FA-12 | B | **Testimonial quotes.** `Quote.role` and `Quote.photo` (Asset with alt); composition places the attribution block; both engines; editor. | all four | todo | |
| FA-13 | B | **Small conveniences.** `code.highlight` (line ranges); `Watermark.text` (text watermark, e.g. DRAFT); `TextRun.code` (inline code in the code font; markdown backticks); per-run `lang`; `1:1`, `4:5`, `9:16` presets; docs: when to use `items` vs `bullets`. | all four | todo | |
| FA-14 | B | **Chart emphasis.** `chart.highlight: { series?: string[], categories?: string[] }`; engine colors highlighted marks with the accent and mutes the rest from the theme; native per-point colors (`c:dPt`) in PPTX; native check. | opf, opf-render, opf-pptx, opf-editor | todo | |
| FA-15 | B | **Combo charts.** A combo chart type (clustered column + line, optional secondary axis) in the chart-type catalog with native `c:barChart` + `c:lineChart`; preview; import; native check. | all five | todo | |
| FA-16 | B | **Catalog content gaps.** Metadata for the 30 bare layouts (summary, design); `font-scheme.languages` as language ids; social-platform icons or remove the fields. | opf, pptx-gallery | todo | |

## Progress log

- 2026-10-06: program opened from the owner-adopted audit; Wave A launched.
