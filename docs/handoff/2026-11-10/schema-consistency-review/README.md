# OPF v0.34 schema consistency — recovered review and proposals

Review only; NEVERMERGE. No schema/runtime change is applied, no feature branch is merged, and no golden, release or deployment is produced. Recommendations below are vetoable. The implementation branch is evidence to review, not approval to adopt it.

## Exact sources and recovered state

A single bounded fetch refreshed the six requested remote refs. Main is `a52dc9441f7eec9dc6f72debb174339758e1761e`. The user's branch `claude/elegant-bell-2g5ks5` is `c7d396520c324c2d448757e906c00cf326dbd99e` (tree `47c486b8f5ac76094f71b540d4698e5228520e0a`). It contains two implementation commits above `e7dc37096a7332a65ae2af8c37e2283790408650`: `4a8e47d02c4bd3d25c4831e3a8c44338aa38760c` (FA34–36) and `c7d3965` (FA37–38). Their combined delta is552 paths,4,324 additions and2,950 deletions:3schemas,88package source paths,260tests,119examples and30docs; other paths include fragments/catalog/build material.

Fresh staging is `863b83b902eaad7a2c614b353c0379f269146441`. Its schema tree is `f0d6a6a44160e199d73ceac9fd0a3263b4703a59`, different from the proposed branch's `246802781c72248706542346548138020c202036`. All three named feature heads are actual ancestors of staging:

| Ref | Exact head |
| --- | --- |
| `codex/lh-110-explicit-reference-lines` | `01a36fb0bdc59753d9d0b9f938dca078f1c933df` |
| `codex/lh-110-reference-qualification` | `7100f6082e0ef58bc77b18c75db7f5ee1b0fc9fe` |
| `codex/sh-27-rtl-placement` | `d9e6787c62a8e804f2a5171e742a38b92cee77a1` |

No standalone final proposal/report or five-audit result packet was found in the two-commit tracked delta. Five fragments and FA34–38 burndown entries exist. The burndown claims a later owner approval (“implement all M/H/O”), but that is absent from the supplied transcript. It remains an unverified historical claim, not authorization to apply this branch. The transcript's last explicit scope is review/proposal first.

## Coverage and limits

[Inventory](inventory.json) recursively lists all17authoritative schema files, their exact Git blob/byte SHA identities,1,014property occurrences, nested definitions, enum/default keywords, required fields, bounds and mutually exclusive/dependent alternatives. `opf.schema.json` has117definitions,658property occurrences,74enums,13default keywords,77oneOf and22anyOf nodes. Counts describe source occurrences, not distinct document keys or implemented features.

Covered authoring families: deck metadata/organizations/speakers/language; design/themes/dimensions/furniture/backgrounds; catalog records/references; composition/layout regions/groups/pagination settings; rich text/lists/numbering/quotes/code/metrics/timelines; tables/datasets/mappings/number formats; charts/reference lines/axis options; shapes/connectors/paint/effects; images/callouts/assets/icons; variables/templates; citations/footnotes/captions and extensions. Finding/report and catalog-index/manifest schemas are inventoried separately from deck properties.

The six OPF skill entrypoints, current handoff, format-audit instructions, changed schema/source/docs and the relevant added tests were read. Detailed implementation review focused on FA34–38; this is not an exhaustive execution audit of all88changed source files. Editor comments/review state and host SDK options are not invented as root document fields. `charts`, `bodyText`, `typefaces`, `fonts`, validation configuration and other export/SDK controls remain outside the OPF JSON vocabulary.

Only one dependency-free pure Node probe was authorized/executed: exact committed `legacy-tags.js` bytes, with bounded Git reads. Its four counterexamples are retained in [actual output](legacy-counterexamples.json). No Ajv, compose, render, editor browser, PPTX export/import, native Office or full-suite run was performed for this review. JSON below is valid JSON and source-schema-derived; fresh executable validation remains owed before implementation acceptance. Earlier transcript “probes passed” claims are not promoted as current evidence.

## Prioritized recommendations

| Priority / exact path | Current authoring problem and proposal | Benefit / tradeoff / migration | Implementations, docs and required evidence | Confidence |
| --- | --- | --- | --- | --- |
| **Must fix before adopting FA37/38:** `packages/pptx/src/legacy-tags.js:38` | Generic `upgrade()` runs `pathText()` on every string. Actual text, code, data-cell and extension strings exactly `slides.0.left` become `slides.0.start`. Restrict upgrades to typed structural path/vocabulary fields; arbitrary authored values must stay exact. | Prevents data corruption. This affects current records too: callers do not gate on exporter version. No document-format change needed to repair it. Do not solve it with blanket text normalization. | [Exact code](https://github.com/OpenPresentation/opf/blob/c7d396520c324c2d448757e906c00cf326dbd99e/packages/pptx/src/legacy-tags.js#L38), document/data/image/annotation/furniture provenance readers; add current+legacy roundtrips for exact literals, table cells, code, notes/extensions, plus structural rename positives and collision refusals. | **Confirmed actual pure defect**, not a native reproduction. Existing “authored text” test uses longer phrases and misses it. |
| **Must fix:** `Chart.referenceLines`, `ChartReferenceLine`, `resolveChartData` | Preserve explicit-only values/labels/axis/bounds/order; a nonempty reference list must not silently disappear on an unsupported type or option route. Add located unsupported-type refusal and safe undoable editor switching. Separate correctness from the branch's additional stacked-type support. | Makes the document truthful. Previously accepted-but-ignored combinations become errors; authors remove references or choose a supported type. Do not infer lines from titles or silently change emphasis. | Schema [reference](https://github.com/OpenPresentation/opf/blob/c7d396520c324c2d448757e906c00cf326dbd99e/spec/schemas/opf.schema.json#L4538), core chart-data/references/layout, SVG, editor switches, PPTX helpers/overlays/import. Require negative/positive bounds, primary+secondary fractions/percent, optional/multiple labels, title mutants and bar/singleton/stacked route coverage. | High for explicit semantic refusal. Source-only here; current native/source qualification is separate. Do not claim every transcript bug remains on latest staging. |
| **Must fix for consistency:** `Design`, `TextRun`, backgrounds/metadata and `ContentPayload` alternatives | Close typo-prone objects; express supported payload options in schema as well as semantic checks; explain the accepted form and correction once. Preserve free-form data through documented `extensions` rather than silently ignoring misspellings. | Earlier unknown keys become errors: a deliberate breaking cleanup with useful diagnostics. Known fields/defaults should retain behavior. Audit intentional custom metadata before closing objects. | [Design](https://github.com/OpenPresentation/opf/blob/c7d396520c324c2d448757e906c00cf326dbd99e/spec/schemas/opf.schema.json#L755), [ContentPayload](https://github.com/OpenPresentation/opf/blob/c7d396520c324c2d448757e906c00cf326dbd99e/spec/schemas/opf.schema.json#L3239), schema-check/finding messages, generated types, completions, examples; added authoring-messages and payload-option-parity tests are relevant but not rerun here. | High authoring value. Migration count claimed in transcript is unverified; do not quote “only1example” as established. |
| **High value:** `OverlayAnchor.width/height` and new `widthPx/heightPx`; `OverlayShape.width/height` | Remove the unit cliff: currently1 means the target size,1.01 means1.01reference pixels. Keep `width/height` fractional and use explicit reference-pixel keys. Allow useful oversized frames while keeping dimensions positive and representable. | Existing anchored values>1 must move to `*Px`; values<=1 retain meaning. Fractions>1 become useful. A cap such as8is a vetoable document contract, not an established PowerPoint/JS maximum. | [Anchor](https://github.com/OpenPresentation/opf/blob/c7d396520c324c2d448757e906c00cf326dbd99e/spec/schemas/opf.schema.json#L2737), core box resolver, editor move/resize/detach, PPTX import/export/provenance, docs/examples. Require exact1/1.01 boundary, mixed units, duplicate-unit refusal, RTL/chart-point anchors and edit/import tests. | High; the existing source description itself states the discontinuity. |
| **High value, coordinated breaking rename:** logical layout words | Rename logical `left/right` to `start/end` in design alignment/chartPrimary, furniture zones, promoted regions, caption/cell alignment, image placement and overlay bands. Keep physical borders/padding/crop/focus/callout coordinates/chart positions unchanged. | Removes a real RTL naming trap. Broad migration across JSON/YAML/Markdown, catalog records, generated types, SDK reports/options and PPTX provenance;552paths show it is not a small spelling fix. No document aliases by default pre-v1. **Blocked on the legacy literal defect above.** | Schema/layout/theme plus core direction resolver, SVG, editor source/controls/history, PPTX export/import tags, gallery metadata and authoring docs. Prove LTR+RTL render equivalence and exact current-source edits separately from schema validity. | High on semantic clarity; scope/timing vetoable. Do not rename physical data as a side effect. |
| **Usability, can wait if migration risk dominates:** `TextRun.lang`→`language` | Make the document run override use the same word as deck/slide language. Correct the description too: an omitted run override follows the effective slide language, then the deck, not unconditionally the deck (see existing lh-106-slide-language.test.mjs). Keep Markdown's standard `lang=` and OOXML `@lang`; internal resolved `TextStyle.lang` need not be globally renamed. | Clearer authoring but all producers/consumers/templates/import provenance must migrate atomically. Existing `lang` sources become invalid. This does not fix native Arabic glyph order or certify physical fonts. | [TextRun](https://github.com/OpenPresentation/opf/blob/c7d396520c324c2d448757e906c00cf326dbd99e/spec/schemas/opf.schema.json#L4351), parser/stringifier, core, font planners, editor rich text, PPTX current edits/import, skills/examples. Require nested footnotes/quotes, explicit versus inherited language, YAML/Markdown and legacy native saves. | Medium-high benefit; lower priority than silent corruption/units. |
| **Optional:** shared `Line` for table borders/reference stroke | Share `none` or partial `{color,width,dash}`; keep richer shape `Stroke` separate. Make defaults contextual and explicit: references dashed/4⁄3px, borders solid/table-rule defaults. Allow explicit empty highlight lists as an off switch consistent with tables. | Less boilerplate without exposing irrelevant arrows/gradients. New partial borders/none are additive; do not accidentally change existing border defaults or make line omission alter reference bounds. | [Line](https://github.com/OpenPresentation/opf/blob/c7d396520c324c2d448757e906c00cf326dbd99e/spec/schemas/opf.schema.json#L4522), TableCellBorder, table-grid, SVG/PPTX and import. Added line-style/table-border-line tests address structure/output but are not rerun here. | Medium; useful, but not a reason to enlarge native scope. |

## Concrete before/after authoring

Each pair uses a complete minimal presentation. “Before” targets reviewed staging; “after” illustrates the proposal branch. These are proposals, not live0.33syntax or a claim of executed cross-engine acceptance.

**One unit per anchored key — fixed badge.**

```json
{"slides":[{"blocks":[{"id":"note","text":"Launch in March"}],"shapes":[{"at":{"block":"note","edge":"end","width":160,"height":64}}]}]}
```

```json
{"slides":[{"blocks":[{"id":"note","text":"Launch in March"}],"shapes":[{"at":{"block":"note","edge":"end","widthPx":160,"heightPx":64}}]}]}
```

**Boundary case:** current `width:1.01` is1.01reference pixels. Preserve that exact intent with `widthPx:1.01`; author a frame1%wider than the target with `width:1.01` only under the new fractional contract. Do not mechanically reinterpret old numbers.

```json
{"slides":[{"blocks":[{"id":"note","text":"Launch"}],"shapes":[{"at":{"block":"note","edge":"center","width":1.01,"height":0.5}}]}]}
```

```json
{"slides":[{"blocks":[{"id":"note","text":"Launch"}],"shapes":[{"at":{"block":"note","edge":"center","widthPx":1.01,"height":0.5}}]}]}
```

**Logical vocabulary — common layout and RTL edge.**

```json
{"design":{"titleAlignment":"left","footer":{"right":{"text":"Confidential"}}},"slides":[{"title":"Decision","left":{"text":"Launch now"}}]}
```

```json
{"design":{"titleAlignment":"start","footer":{"end":{"text":"Confidential"}}},"slides":[{"title":"Decision","start":{"text":"Launch now"}}]}
```

```json
{"language":"ar-SA","design":{"contentAlignment":"right"},"slides":[{"table":{"columns":["Item"],"rows":[[{"value":"A","style":{"align":"left","borders":{"left":{"color":"accent1","width":1}}}}]]}}]}
```

```json
{"language":"ar-SA","design":{"contentAlignment":"end"},"slides":[{"table":{"columns":["Item"],"rows":[[{"value":"A","style":{"align":"start","borders":{"left":{"color":"accent1","width":1}}}}]]}}]}
```

The border's physical `left` stays `left`; only text alignment changes vocabulary. Image focus remains0..1 and physical; image callout signed origins remain physical even in RTL. Free overlay `x` is a logical slide fraction in this design, not the same coordinate system as image pixels.

**Run language — ordinary override and explicit Arabic proofing edge.**

```json
{"language":"en-US","slides":[{"text":[{"text":"Bonjour","lang":"fr-FR"}]}]}
```

```json
{"language":"en-US","slides":[{"text":[{"text":"Bonjour","language":"fr-FR"}]}]}
```

```json
{"language":"ar-SA","slides":[{"text":[{"text":"Bonjour 1","lang":"ar-SA","fontFamily":"Aptos"}," العربية 2"]}]}
```

```json
{"language":"ar-SA","slides":[{"text":[{"text":"Bonjour 1","language":"ar-SA","fontFamily":"Aptos"}," العربية 2"]}]}
```

Characters, language and requested face are unchanged by the rename. Actual PowerPoint rendering remains a separate B07 question.

**Partial border and line-only suppression.**

```json
{"slides":[{"table":{"columns":["Region"],"rows":[[{"value":"North","style":{"borders":{"top":{"color":"accent1","width":2}}}}]]}}]}
```

```json
{"slides":[{"table":{"columns":["Region"],"rows":[[{"value":"North","style":{"borders":{"top":{"width":2},"bottom":"none"}}}]]}}]}
```

Here omission deliberately selects the table's default rule color; retain `color` if accent1was intentional. Partial authoring must not be presented as equivalence when the default differs.

```json
{"slides":[{"chart":{"type":"column","data":{"columns":["Month","Value"],"rows":[["Jan",10],["Feb",20]]},"referenceLines":[{"value":30,"label":"Ceiling","stroke":{"width":0}}]}}]}
```

```json
{"slides":[{"chart":{"type":"column","data":{"columns":["Month","Value"],"rows":[["Jan",10],["Feb",20]]},"referenceLines":[{"value":30,"label":"Ceiling","stroke":"none"}]}}]}
```

Both intend to retain the label and30in automatic bounds, hiding only the line. Neither title text nor a zero-width stroke removes the reference value.

**Strict objects — migrate intentional custom data, reject typos.** A currently accepted unknown design key moves to root extensions, rather than being silently ignored:

```json
{"design":{"projectOwner":"Sam"},"slides":[{"text":"Launch plan"}]}
```

```json
{"extensions":{"projectOwner":"Sam"},"slides":[{"text":"Launch plan"}]}
```

The edge case `design.titleAlignmnt` must be a located error suggesting `titleAlignment`, not custom metadata. A background gradient without stops must explain the missing stops; a `labelPosition` without `label` must explain both removing the former or adding the latter. These erroneous inputs are not labelled valid “before” examples.

**Reference lines — fractions, multiple/optional labels and unsupported-type handling.** This complete chart retains the already approved explicit contract; no new syntax is needed:

```json
{"slides":[{"title":"Margin — do not infer a target","chart":{"type":"combo","data":{"columns":["Month","Revenue",{"name":"Margin","format":"0%"}],"rows":[["Jan",100,0.2],["Feb",120,0.3]]},"line":["Margin"],"secondaryAxis":["Margin"],"referenceLines":[{"value":-10,"label":"Floor","stroke":{"dash":"solid"}},{"value":0.25,"axis":"secondary","label":"Target","stroke":{"dash":"dash"}},{"value":0.1,"axis":"secondary"}]}}]}
```

25%is0.25in the percentage data column's axis units, not25. Omitting `axis` chooses the primary value axis. The unlabeled line stays unlabeled. A nonempty reference on a pie should give a located error; removing it is an explicit author choice, not an automatic conversion:

```json
{"slides":[{"chart":{"type":"pie","data":{"columns":["Region","Value"],"rows":[["North",42],["South",31]]},"referenceLines":[]}}]}
```

An empty list remains a valid no-reference edge case. Stacked-type references and new native guarantees need their own acceptance evidence; they are not inferred from accepting this JSON.

## Decisions and scope for v0.34

**Must fix:** the confirmed literal-corrupting tag migration; truthful explicit-reference handling/diagnostics without silent removal; typo/option/schema-description consistency. Keep already-approved signed origins and finite representability guards, without treating negative coordinates as errors or making dimensions/focus/stops share their bounds.

**High-value usability:** explicit anchored-size units; a coordinated logical start/end vocabulary cleanup if the broad migration fits the release; clear unit tables and contextual default/empty-list semantics. Consider the run-language rename in the same atomic vocabulary release, not as a font-fidelity remedy.

**Can wait:** one basic Line vocabulary, extra shorthand, category references/bands, fill/background unification, and unrelated default/catalog redesigns. Preserve useful existing compact implicit payloads and explicit blocks; they serve concise authoring and stable editing respectively. Preserve owner-chosen DimensionPreset and font-role aliases rather than deleting coherent exceptions merely for uniformity.

Recommended vetoable answers:

1. **Direction:** logical layout start/end; physical pixel/plot/border/focus/callout sides stay physical. Do not promise arbitrary geometry mirroring from a vocabulary rename.
2. **Units:** reference pixels are720-short-edge design units, not device pixels. Run fontSize stays points; dimensions inches; gaps/origins/dimensions may be fractions; gradients/focus/opacity are normalized; chart references use associated data-axis units. Publish this matrix instead of claiming all numbers share one unit.
3. **Null/omission/empty:** keep existing field-specific semantics. Omission inherits where documented; explicit empty reference arrays mean none; explicit empty highlight lists can be the off switch. Do not globally treat null as omitted or inject defaults into authored source.
4. **Off-slide content:** partial outside placement is valid. The proposed wholly-outside warning is a separate policy choice, not a correctness requirement or native cap; intentional hidden/offstage content must remain valid and must not move/shrink. Do not bundle it silently with the unit fix.
5. **Representability:** use actual resolved geometry for refusal. The branch's schema-check callout preflight scales by the whole slide as an upper bound, which can be more conservative than a small actual image frame; examine false positives before calling that bound an exact necessity. This is a source-review risk, not a reproduced runtime failure here.
6. **Breaking migration:** rewrite document/catalog/source-format vocabulary together, with explicit examples and generated-type/SDK notes. Do not use generic string rewriting or silently replay stored old source over current native edits. No aliases/deprecations are required solely because the project is pre-v1; supported legacy PPTX input still needs safe typed handling.
7. **Fidelity:** schema acceptance, composition, SVG/editor behavior, native export and import are separate gates. Bar/singleton/stacked overlays have limits around independent chart moves, data/axis edits and pinned bindings; retain diagnostics and current-appearance conservative import. No current0.33support or new native certification is claimed.

Do not fold the entire stale552-path implementation as a completed review. First review these choices and repair the confirmed migration defect; then implement selected changes against the current coherent staging source, run mapped source checks, fresh schema examples/types/SDK/edit/undo/import tests and the maintained renderer/native qualification where geometry or PPTX changes. Existing golden hashes/tolerances are not edited locally. This report's only executed product-code evidence is the small pure counterexample, and it remains separate from any future implementation acceptance.