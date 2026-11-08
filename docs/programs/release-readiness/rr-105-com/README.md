# RR-105 and SH-20..23: PowerPoint COM evidence (handoff, 2026-11-07)

On 2026-11-07 the owner handed the remaining work to another agent. This folder keeps what the Windows Office-owner
session measured in PowerPoint for Windows through COM, so the results survive off that machine. It also lists the COM
checks still owed. Large outputs (PNGs, PPTX, raw probes) stayed on the Windows PC; their paths are listed below.

**Environment:**
- PowerPoint for Microsoft 365, 16.0.20527.20112 (build 20527).
- Windows 11 Home 25H2 build 26200.9711. The Windows registry calls it "Windows 10 Home".
- en-US, Node v26.4.0.
- COM only: the owner declined UI control.
- Only one session drove PowerPoint at a time. Every run checked first that no POWERPNT.EXE was running. Office was never killed.

## 1. v0.33.0 qualification, pass 1 (main before the release candidate)

- **Corpus:** `scripts/native-acceptance/qualification/`, with its manifest, `build.mjs`, `run-powerpoint-windows.ps1` and
  `evaluate.mjs`. It lands with [opf#1085](https://github.com/OpenPresentation/opf/pull/1085), which is being folded into the
  v0.33.0 integration PR.
- **Built from:** branch `65b4f2aac`, which is main `ec25bc9b2` plus the corpus, at OPF 0.32.1.
- **Scope:** 25 PPTX files of 20 decks, 256 slides.
- **Verdict: no release blocker.**
  - Every file opens without a repair prompt, and every slide renders.
  - Only one opt-in `--body-text native` case overflows (#1089).
  - Live SmartArt, native charts and tables, glued connectors, Header and Footer fields, and the round trip through a
    PowerPoint-saved copy all pass.
- **Results:**
  - [pass1/qualification-0.33-windows.md](pass1/qualification-0.33-windows.md): the results table, findings and file hashes.
    It is a copy of the page #1085 adds.
  - [pass1/results.md](pass1/results.md) and [pass1/results.json](pass1/results.json): the grader's per-feature output.
  - [pass1/run.json](pass1/run.json): per file, opened, slide count and time.
  - [pass1/build.json](pass1/build.json): the revision, per-deck source and PPTX hashes, and export findings.

| Finding | Severity | Status |
| --- | --- | --- |
| [opf#1086](https://github.com/OpenPresentation/opf/pull/1086): false `numbering-unsupported-core` on stepper badges | low | fixed, merged |
| [opf#1089](https://github.com/OpenPresentation/opf/issues/1089): `--body-text native` card re-wraps and overruns (layout-sampler s41) | medium, opt-in | 0.34 PPTX agent; Wave 2 fix #1114 |
| [opf#1090](https://github.com/OpenPresentation/opf/issues/1090): academy slide 3, the background ring misses the native bar | medium, example | fix [opf#1095](https://github.com/OpenPresentation/opf/pull/1095), folded into the integration |
| [opf#1091](https://github.com/OpenPresentation/opf/issues/1091): a title in small runs draws about 22 pt higher (already in 0.32.1) | medium, not a regression | 0.34 PPTX agent; Wave 2 fix #1114 |
| [opf#1092](https://github.com/OpenPresentation/opf/issues/1092): histogram bin labels and the Pareto axis | low | charts agent (#1106) |
| [opf#1093](https://github.com/OpenPresentation/opf/issues/1093): text of a flipped asymmetric preset (preview vs PowerPoint) | low | fix [opf#1097](https://github.com/OpenPresentation/opf/pull/1097), folded into the integration |
| [opf#1094](https://github.com/OpenPresentation/opf/issues/1094): `opf/reading-order` false positive on icon-group cards | low, validator | open |

**Not run:**
- Accessibility Checker, Edit Data, adjust handles and Change Shape: they need the UI.
- The SH-16 picture fallback: PowerPoint takes the live SmartArt instead; Keynote and LibreOffice grade the fallback.
- The never-shrink batch (RR-104, LH-184, LH-185, LH-186, SH-11): it had not merged, so pass 1 graded it on the existing decks only.

## 2. SH-08: PowerPoint-made SmartArt fixture

The job was `make-powerpoint-smartart.ps1` on branch `sh-08-smartart-import`. Its job sheet is [sh-08/job.md](sh-08/job.md).

**Final run, script commit 88196f7f4:**
- Exit 0. All 17 slides built, with no `error` entries; every PowerPoint layout Id and Name matches.
- 15 slides are clean. The manifest is [sh-08/powerpoint-smartart.json](sh-08/powerpoint-smartart.json).
- Two slides have `issues`:
  - Slide 9, Accent Process: "Field visits: Unable to add node to graphic".
  - Slide 11, Vertical Bullet List: "Enter two markets" and "Supply chain" could not be added.

**What the earlier runs and probes established:**
- **`SmartArtLayouts`:** on this build, `Application.SmartArtLayouts` raises "Object does not exist" through automation.
  - It does so with PowerPoint windowless and visible-minimized, and after opening a deck that has SmartArt
    ([sh-08/probe3.ps1](sh-08/probe3.ps1)).
  - Word's `SmartArtLayouts` is null too.
  - The working route: `AddSmartArt` accepts an existing graphic's `SmartArt.Layout`. The seed deck
    `make-smartart-seeds.mjs` gives all 17 built-in layouts ([sh-08/probe5.ps1](sh-08/probe5.ps1)).
- **Basic Matrix:** after every node is deleted, only one `Nodes.Add()` succeeds, and a fifth node on a fresh graphic
  fails. Filling the four default nodes in place works ([sh-08/probe6.ps1](sh-08/probe6.ps1)).
- **A second child in Accent Process and Vertical Bullet List** ([sh-08/probe7.ps1](sh-08/probe7.ps1)):
  - `AddNode(below)` on the parent fails, and so does `AddNode(after)` on the child.
  - `AddNode(default)` adds a top-level sibling instead of a child.
  - The only form accepted is one child whose text holds several paragraphs (`First\rSecond\rThird`).
  - A deck saved from PowerPoint's UI text pane may store separate nodes; making one needs the owner.

**Local outputs:** `C:\opf-work\_supervisor\com-jobs\sh-08\` holds `powerpoint-smartart.pptx`, `slide01.png` to
`slide17.png` and `smartart-seeds.pptx`.

## 3. SmartArt live-gate sweep (SH-20 to SH-23)

The job ran `C:\opf-work\_supervisor\com-jobs\sh-live-extras\run.ps1` on 2026-11-07, 14:36 to 14:55. Its job sheet is
[sweep/job.md](sweep/job.md), and the logs are [sweep/run.log](sweep/run.log) and [sweep/trees-run.log](sweep/trees-run.log).
**All three steps completed.**

**Step 1: `com-probe` over the live and native-shape decks. Exit 0.**
- **Live export (`sweep\ppt`):** 516 decks, 516 slides, no open errors.
  - 465 slides are live SmartArt.
    - On OPF's own layouts (347): pyramid-steps 59, card-grid 61, matrix-quadrants 10, cycle-ring 13, cycle-loop 27,
      cycle-loop-3 7, chevron-rows 50 (+2 compact), flow-rows 54 (+5 compact), vertical-flow-columns 58 (+1 compact).
    - On built-in layouts (118): pyramid1 20, matrix3 3, cycle2 28, chevron1 24, process1 23, process2 20.
  - 51 slides stay native shapes by design: the list-block controls, the `-rtl-` and `-he-` decks, and long or
    medium text at high counts.
  - The probe is [sweep/ppt-probe.json.gz](sweep/ppt-probe.json.gz) (6.8 MB raw). It records every node, every
    GroupItems shape, and each text line's bounds.
- **Native-shape export (`sweep\ppt-shapes`):** 516 decks, no SmartArt, no errors
  ([sweep/ppt-shapes-probe.json](sweep/ppt-shapes-probe.json)).
- [sweep/meta.json](sweep/meta.json) is the sweep's instance metadata: kind, count, text, slide size, script and findings.

**Step 2: the ninth node, `com-checks` on the 18 `*-8-short-*` decks. Results:
[sweep/ninth-com-checks.json](sweep/ninth-com-checks.json).**
- All 18 are live on OPF's layout.
- A node edit keeps every size and rectangle (18 of 18).
- `add=9` keeps OPF's layout and OPF's size on all nine nodes (18 of 18). This is the SH-23 input: the nine-entry
  tables apply.
- Deleting two nodes leaves 7 on OPF's layout (18 of 18).
- **Change Layout** to Basic Block List:
  - It worked on the first deck, `chevrons-8-short-square`, which switched and came back to OPF Chevron Rows. That
    deck's SaveCopyAs and reopen kept the layout and rectangles.
  - On the other 17 decks it failed as expected: "layout not found: …/layout/default", because this build refuses
    `SmartArtLayouts`. The exception skipped those decks' SaveCopyAs-and-reopen check, which is still owed (section 4).

**Step 3: tree measurements, `measure-trees.ps1`. Exit 0.**
- In `run.ps1` this step refused to start: PowerPoint, closed by step 2, was still exiting after the 60-second wait.
  It was rerun by itself at 14:53 and took about 2 minutes.
- **Coverage:** 580 measurements.
  - Organization Chart (`orgChart1`): 11 trees × 20 frames.
  - Hierarchy (`hierarchy1`): 11 trees × 20 frames.
  - Basic Venn (`venn1`): 7 counts × 20 frames.
- **Errors:** none.
- **One known issue:** in all 20 frames of the Hierarchy tree with an assistant (`asst`), adding the assistant failed
  with "Aide: The specified value is out of range". Hierarchy has no assistant node type, so that tree was measured
  without it.
- The data is [sweep/trees.json.gz](sweep/trees.json.gz) (4.8 MB raw). For each row it records every shape PowerPoint
  drew: type, connector flag, rectangle, rotation, flips, text, size and margins. The script is
  [sweep/measure-trees.ps1](sweep/measure-trees.ps1).

**Local outputs** in `C:\opf-work\_supervisor\com-jobs\sh-live-extras\`:
- `sweep\ppt\` (16 MB) and `sweep\ppt-shapes\` (9 MB): the PNGs.
- `sweep\ninth\` (4 MB): working copies, resaved copies and the PNG of each step.
- `trees\`: 29 PNGs.
- `sweep\pptx\`, `sweep\pptx-shapes\` and `sweep\preview\`: the decks and OPF's previews.

## 4. COM checks still owed

1. **The final v0.33.0 PowerPoint pass (pass 2) on the integration build.**
   - Rebuild the corpus from the integration commit, then run `run-powerpoint-windows.ps1` and `evaluate.mjs`.
   - Grade the never-shrink rows (RR-104, LH-184, LH-185, LH-186, SH-11).
   - Fill in "Pass 2" of `docs/programs/release-readiness/qualification-0.33-windows.md`.
   - Run the extra checks below as well.
2. **The ninth-node SaveCopyAs and reopen check** on the 17 decks where Change Layout threw (section 3, step 2). Reorder or guard `com-checks.ps1` so a Change Layout failure does not skip it.
3. **SH-08:** a decision on the multi-paragraph children (section 2), or an owner-made deck.

### Extra checks for the final pass (the supervisor's list, `final-033-extra.md`)

Run these together with the RR-105 manifest. Use the shipped CLI export with fonts, open read-only through COM, export each slide at 1280 x 720 and compare with OPF's preview.

#### SH-10: text in large shapes grows (#1115)
Check that shape text has the same point size as the preview, breaks at the same lines, and has no autofit.
- `examples/technical/shapes.opf.json`
  - Slide 1 stays at 28 px: eight presets, the siblings at the body size.
  - Slide 2: "path", "can", "cube".
  - Slide 3: the Fills labels.
  - Slide 4: Strokes. "thickThin inside" and "gradient, sketch" wrap to 2 lines.
  - Slide 5: Theme styles. "intense" is bold (SH-11).
  - Slide 6: top and bottom anchoring. "Bottom, with rich runs" wraps.
  - Slide 7: rotated, flipped and linked shapes.
- `examples/technical/shape-effects.opf.json`, slides 1 to 3
  - Labels: "soft", "hard", "perspective", "object", "inner shadow", "glow", "blur", "reflection", "rotated" (turned 20°), "intense style" (bold).
  - The star's "glow and shadow" stays small.
- `examples/technical/shape-overlays.opf.json`, slides 3 and 4
  - Labels: "Plan", "Build", "Ship", "Source", "Upper", "Lower".
  - The "Review" diamond stays small.
- `examples/technical/shape-overlays-rtl.opf.json`, slide 1: "Second" and "First", right to left.

#### Charts (#1104, #1105, #1106, #1108, #1111)
1. LH-176 (#1105): bar thickness and gap per category equal the preview. The PPTX keeps `c:gapWidth` 150/50, so PowerPoint should look as before; the preview moved to match it. Slides:
   - `examples/gallery/education/athletics-budget-review` #3
   - `examples/technical/chart-colors` #1
   - `examples/technical/color-variants` #2 and #4
   - `examples/technical/full-feature-tour` #4
   - `examples/gallery/business-functions/investor-relations-update` #7 (now labeled bars, no value axis)
2. LH-182 (#1108): no watermark tiles inside the hole. The surface ellipse ("OPF chart N mark under 1 hole") sits exactly on PowerPoint's hole, with no ring of motif or fill at the inner edge, and the doughnut sits where the preview draws it (plot pinned inner). Slides:
   - `renewal-save-plan` #3
   - `alumni-giving-campaign` #3
   - `research-findings-report` #3
   - `demand-generation-campaign-brief` #7 (a doughnut on a card)
3. RR-105 finding 5 (#1106), qualification corpus `layout-harvest.pptx`:
   - Slide 17: bin labels read [1.2, 3.1], (3.1, 4.9], (4.9, 6.8], (6.8, 8.6].
   - Slide 18: the value axis is 0 to 5,000 by 1,000, and the percentage axis 0% to 100% by 20% (`cx:valScaling`).
   - The file opens with no repair prompt.
4. LH-175 (#1104): native clustered columns of both series, matching the preview. Slides:
   - `partner-ecosystem-launch-kit` #3
   - `visual-brand-system-sampler` #3
   - `curriculum-approval-brief` #7
   - `wildfire-evacuation-preparedness` #3
   - `consulting-margin-recovery-plan` #3
   - `product-launch-narrative` #7
5. LH-93 (#1111): on `C:\opf-work\charts-tools\lh93\deck.opf.json` slides 1 and 2, both charts' PlotArea InsideWidth, InsideHeight and InsideTop are equal.
6. LH-110 (#1118, later wave): `C:\opf-work\charts-tools\lh110\deck-de.opf.json` and `deck-fr.opf.json`. The dashed line sits at 92% (label "92 %") on slide 1, and at 30 on slide 2.

#### LH-174 (#1110)
- `C:\opf-work\lh-layout-work\decks\own-icons.opf.json`, slides 2 and 3: entries without an icon draw a bullet centered in the icon-chip column (sheet `sheets\lh-173-174.png`).

#### Later wave, not in 0.33 integration unless folded
- SH-12, `examples/technical/dot-diagrams.opf.json`, slides 1 to 5 (diagrams "shapes"):
  - cluster group
  - "Approved?" diamond
  - stadium shape (roundRect at 50%)
  - dashed labeled back edge
  - undirected graph with open connectors
  - "Deck store" cylinder
  - dark variant with circles and a double circle
  - alt text
- SH-13, `examples/technical/plantuml-diagrams.opf.json`, slides 1 to 8:
  - sequence, with an alt frame
  - class, with a composition diamond, cardinalities and a dashed realization
  - state
  - activity
  - use case, with the «include» relation
  - component
  - mind map
  - gantt, with a milestone
  - alt text on slide 8

#### Wave 2: PPTX fixes (#1114, head b7aff87f8)
1. `examples/technical/layout-sampler.opf.json` exported with `--body-text native`:
   - Slide 41: all six cards wrap as the preview does, and "Share results with both teams." stays on one line inside its card.
   - Slide 22: the lead breaks after "before ", not after "deciding".
   - Slide 20: the lead is drawn as measured lines.
   - Spot-check the other native bodies on slides 3 to 42.
2. The #1091 repro deck (one 20 pt title run), plus `examples/gallery/design-and-media/data-story-academy-corporate-programs.opf.json` (default export) slides 1, 5, 6 and 16: the title baseline is within about 1 pt of the preview's (repro: box top + 40.5 pt). This confirms the three-quarters rule at a pitch of about 2.7 times the run size.
