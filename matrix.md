# OPF 0.36.0 changelog matrix for Keynote

84 rows from the seven 0.36.0 changelogs at `v0.36.0`; 62 can be seen in a deck opened in Keynote. Decks: `decks/matrix/`; builds: `build/<ver>/matrix/<deck>/`. Layout-sweep rows (opf#1425) are described in `sweep-rows.json` and `sweep-plan.md`; the other rows in `deck-plan.md`.

| id | entry (short) | packages | Keynote? | deck / slides | result |
| --- | --- | --- | --- | --- | --- |
| M01 | Conformance suite (conformance/, docs/conformance.md) and runner; no... | opf | no | - | not a Keynote matter: test suite and docs only |
| M02 | docs/governance.md proposed (steward, change process, versioning, name policy). | opf | no | - | not a Keynote matter: docs only |
| M03 | Validation warning opf/shape-path-units for custom shape paths drawn on 0-100 instead... | opf | no | - | not a Keynote matter: validation warning only |
| M04 | Docs: Keynote row of the compatibility matrix lists every difference measured in... | opf | no | - | not a Keynote matter: docs only (but the list is the checklist of known Keynote limits) |
| M05 | LH-102: a short layout body of several paragraphs/lists grows past LH-48 up to 56 px... | opf | yes | see sweep | pending |
| M06 | LH-102: a lone paragraph/list filling half to 60% of its body sits in the middle of... | opf | yes | see sweep | pending |
| M07 | LH-102: a short lone plain list grows to 56 px (1-3 entries) or 49 px (4-5),... | opf | yes | see sweep | pending |
| M08 | LH-133: a FAQ written as one list sets answers at the question size, not 82%. | opf | yes | see sweep | pending |
| M09 | LH-188: a one-message quote balances its lines and grows (up to 115 px for <=12 chars)... | opf | yes | see sweep | pending |
| M10 | LH-193: a plain text or list alone beside a layout's one chart or picture... | opf | yes | see sweep | pending |
| M11 | Five PowerPoint fixes: HSL stops in color, rows-chart category title room, legacy auto keeps cells | opf, pptx | yes | m-svg-hsl#1; m-charts#15-16; m-legacy-auto#1 | pending |
| M12 | MCP viewer PowerPoint export lists fonts a PowerPoint may lack;... | opf, pptx, mcp | no | - | not a Keynote matter: export notes text only; .pptx unchanged |
| M13 | One-series chart with highlights: legend names the series | opf, pptx | yes | m-charts#1-3 | pending |
| M14 | Pie/doughnut: separators kept with highlight; plot square as preview | opf, pptx | yes | m-charts#10-13 (also #5 right chart) | pending |
| M15 | A11: a short table beside a column/line/pie chart grows (to 32 px) and starts on the... | opf | yes | see sweep | pending |
| M16 | Right-aligned and centered wrapped text flush (LTR, RTL, mixed) | opf, render, pptx, gallery | yes | m-text-flush#1-7; m-text-flush-rtl#1-7 | pending |
| M17 | LH-58: a block of bullets groups as the list it draws (four one-word bullets blocks no... | opf | yes | see sweep | pending |
| M18 | C10: two tables side by side (comparison) grow together. | opf | yes | see sweep | pending |
| M19 | C12: dashboard of a metrics row and one short table: table grows, group centered. | opf | yes | see sweep | pending |
| M20 | Pictures/videos in one row, some captioned: share one height (gallery). | opf | yes | see sweep | pending |
| M21 | opf#1412 A2: blocks in full-height cells sit in the middle of their cell. | opf | yes | see sweep | pending |
| M22 | opf#1412 A1: named cells in full rows take the whole body; unnamed rows give space away. | opf | yes | see sweep | pending |
| M23 | opf#1412 A3: blocks beside a chart (no layout) sit in the middle of their column. | opf | yes | see sweep | pending |
| M24 | opf#1412 A3: composition.mode "column" keeps a chart in the one column (portrait: mode... | opf | yes | see sweep | pending |
| M25 | COL-2: a table on a column card grows with texts beside it; a too-wide table takes the... | opf | yes | see sweep | pending |
| M26 | LH-03: small column charts with hidden value axis end the axis at the tallest column... | opf, render, pptx | yes | see sweep | pending |
| M27 | LH-86/COL-4: two-column and three-column keep long texts in columns. | opf | yes | see sweep | pending |
| M28 | Two option regions (comparison) with texts 2.5x different split the row up to 3:1 for... | opf | yes | see sweep | pending |
| M29 | opf#1412 A7: grids the slide asks for center blocks in cells and stretch the short... | opf | yes | see sweep | pending |
| M30 | Edges: hsla/slash/number-only HSL stops; layout auto repair; long one-word bar category | opf, pptx | yes | m-svg-hsl#2-5; m-charts#14; m-legacy-auto#1 | pending |
| M31 | Bottom-anchored layouts (closing, cover, section, pillars, team) keep a whole gap... | opf | yes | see sweep | pending |
| M32 | PNG/PDF previews draw SVG HSL gradient stops as a browser; conversion shared in core. | opf, render, pptx | no | - | not a Keynote matter: PNG/PDF preview only; SVG and PPTX unchanged |
| M33 | image layout: lone picture shown whole or captioned keeps margins, centered, above footer. | opf | yes | see sweep | pending |
| M34 | LH-67: lead plus stack keeps author order (comparison A left, B right). | opf | yes | see sweep | pending |
| M35 | A name among logos drawn as a wordmark tile. | opf | yes | see sweep | pending |
| M36 | opf#1412 A5: paragraphs/lists beside a picture stack centered. | opf | yes | see sweep | pending |
| M37 | A12, C11: pie and its value list stand together, centered. | opf | yes | see sweep | pending |
| M38 | opf#1412 A4: pull line stack centered; sparse stack draws pull line as larger quote. | opf | yes | see sweep | pending |
| M39 | TAB-1: table layout table and note grow up to three quarters of body. | opf | yes | see sweep | pending |
| M40 | TAB-2: table-beside table grows with its aside. | opf | yes | see sweep | pending |
| M41 | C08, IM1: Mermaid/DOT/PlantUML diagrams start at 48 px and fill more of their block. | opf | yes | see sweep | pending |
| M42 | C03, VPR-1: chevrons and vertical-process fill their region; exported as native shapes... | opf | yes | see sweep | pending |
| M43 | MX1: matrix of other than four entries draws as primary-paint centered cards. | opf | yes | see sweep | pending |
| M44 | HI1, H2: org-chart and hierarchy use OPF own tree (opfTreeGeometry) when PowerPoint... | opf | yes | see sweep | pending |
| M45 | IP1, PY1: stepped pyramid bars widen and center; SmartArt layout def reads barWidth/inset. | opf | yes | see sweep | pending |
| M46 | PR2: a step without description draws as a heading among described steps. | opf | yes | see sweep | pending |
| M47 | PR1: process layout with one list of 2-5 sentence steps draws the badged row. | opf | yes | see sweep | pending |
| M48 | TLN-1: lone timeline grows in proportion up to 56 px labels; connector width lineWidth. | opf, render, pptx | yes | see sweep | pending |
| M49 | VEN-1: four-set venn with labels <=24 chars draws circles with outside labels. | opf | yes | see sweep | pending |
| M50 | C09: agenda of 7+ entries stands in the middle; first columns get the longer share (7... | opf, gallery | yes | see sweep | pending |
| M51 | chart-beside aside anchored middle; quote aside keeps its card. | opf, gallery | yes | see sweep | pending |
| M52 | C07: code snippet and its explanation grow together. | opf | yes | see sweep | pending |
| M53 | COL-3: short text beside a longer one in a row of cards is centered in its card. | opf | yes | see sweep | pending |
| M54 | C05: dashboard KPI lead region flow row: 4-5 metrics side by side; 1-2 metrics centered. | opf, gallery | yes | see sweep | pending |
| M55 | C14: automatic foot band moves up under a short body; comparison verdict band stays at... | opf | yes | see sweep | pending |
| M56 | Several lists in one region dealt in balanced rows (5 = 3+2). | opf | yes | see sweep | pending |
| M57 | P1: card row with heading lines under middle anchor hugs tallest card and centers. | opf | yes | see sweep | pending |
| M58 | P3: one-word pillars draw display words over an accent rule. | opf | yes | see sweep | pending |
| M59 | SCO-1: scorecard tile figures grow into the tile, shared foot, unit kept beside. | opf | yes | see sweep | pending |
| M60 | ScriptFontProfile.languageSource is core's type. | render | no | - | not a Keynote matter: TypeScript types only |
| M61 | Preview paints preset fills before lines (export unchanged) | render | yes | m-preset-preview#1-4 | pending |
| M62 | Native body centered/bottom written as middle/bottom-anchored box | pptx | yes | m-native-body#1-4 (native.pptx) | pending |
| M63 | #1404: slide own language survives import in undeclared deck; Latin pieces of RTL... | pptx | no | - | not a Keynote matter: import only; exported files unchanged |
| M64 | Chart data labels on one line | pptx | yes | m-charts#4-5 (every labeled chart of the deck carries it) | pending |
| M65 | Whole-link text box links on the shape (no underline) | pptx | yes | m-links#1-3 | pending |
| M66 | Plot area under a chart heading = preview plot | pptx | yes | m-charts#6-9 (also #1, #7, #8 small column charts) | pending |
| M67 | Agenda of 7+ entries exports (opf#1429) | pptx | yes | m-agenda#1-5 | pending |
| M68 | opf#1431: dataLabels false survives import. | pptx | no | - | not a Keynote matter: import only |
| M69 | opf#1431: theme-colored reference line keeps data record on import. | pptx | no | - | not a Keynote matter: import only |
| M70 | Import: undeclared mixed-script deck gets no invented language. | pptx | no | - | not a Keynote matter: import only |
| M71 | Negative bar/column: category names not cut off in Keynote (opf#1278) | pptx | yes | m-negative-bars#1-8 | pending |
| M72 | #1404: RTL slide with number-only paragraph keeps its language on import. | pptx | no | - | not a Keynote matter: import only |
| M73 | Narratives quarterly-review and operational-review. | gallery | no | - | not a Keynote matter: catalog narrative records; no drawing |
| M74 | code layout: aside anchored middle | gallery | yes | m-gallery-anchors#1 | pending |
| M75 | pillars and team layouts: card content anchored middle | gallery | yes | m-gallery-anchors#2-3 | pending |
| M76 | updateJsonSource duplicateKeys reject. | editor | no | - | not a Keynote matter: editor API |
| M77 | README review panel wording. | editor | no | - | not a Keynote matter: docs |
| M78 | Design/Find/Export share one panel. | editor, mcp | no | - | not a Keynote matter: editor/MCP viewer UI |
| M79 | Canvas caret follows balanced heading lines. | editor | no | - | not a Keynote matter: editor-only behavior |
| M80 | Presenter: link click follows without changing slide. | editor | no | - | not a Keynote matter: presenter behavior (not the pptx) |
| M81 | Docs index points to openpresentation.com. | mcp | no | - | not a Keynote matter: docs |
| M82 | No Expand button when host is Claude. | mcp | no | - | not a Keynote matter: MCP viewer UI |
| M83 | Viewer footer says the assistant can see this version. | mcp | no | - | not a Keynote matter: MCP viewer UI |
| M84 | Viewer without read_font_file explains fonts cannot be loaded. | mcp | no | - | not a Keynote matter: MCP viewer UI |
