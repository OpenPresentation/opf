# Program: font fidelity everywhere

Status: **active** (opened 2026-09-23). Tracker: [burndown.md](burndown.md).
This is the single source of truth for the cross-repository program. Agents and
people resuming work start here, not from chat history or local scratch files.

## Goal

The owner's goal (2026-09-23), verbatim:

> "Every pptx.gallery configuration is PERFECTLY supported in rendering and PPTX output: for all 14 dimensions (charts limited to Aspose.Slides-supported chart types), the preview and the exported PPTX agree element by element (geometry within existing tolerances, text/runs, fonts in every script slot, colors, fills, backgrounds, images, z-order), the PPTX uses native PowerPoint constructs and re-imports cleanly, and a bounded native PowerPoint sample confirms it — identically for TypeScript developers on Windows/macOS/Linux, local, cloud/serverless without system fonts, and browser. Licensed fonts render with shipped open replacements while the PPTX references the real font name without embedding; one shared default font scheme (aptos). pptx.gallery is a first-class OPF catalog (spec URLs serve schema-valid records; core bundles a pinned, drift-checked snapshot) and shows measured support badges. Progress = count of gallery items passing the parity audit; tracked in docs/programs/font-fidelity-everywhere. Invariants: no gate relaxation, no in-place native retries, root alone owns Office, no publish/deploy, native p:hf deferred."

Restated:

- **Scope.** Every configuration of the 14 [pptx.gallery](https://pptx.gallery)
  dimensions: layouts, color schemes, font schemes, languages, backgrounds,
  narratives, charts, themes, audiences, tones, socials, headers/footers,
  content blocks and image treatments. Charts are limited to the chart types
  Aspose.Slides supports (FF-22).
- **Parity.** The preview and the exported PPTX agree element by element:
  - geometry within the existing tolerances (native 0.02 pt, renderer 0.1
    reference px);
  - text and runs;
  - fonts in every script slot (Latin, East Asian, complex script);
  - colours, fills, backgrounds, images and z-order.
- **Native PPTX.** The export uses native PowerPoint constructs (for example
  theme colours, fields, pictures, pattern and picture fills) and re-imports
  cleanly: values are retained or a specific diagnostic is emitted.
- **Native confirmation.** A bounded native PowerPoint sample confirms parity
  and fonts (FF-12).
- **Everywhere.** The result is identical for TypeScript developers on
  Windows, macOS and Linux, locally, in cloud or serverless containers without
  system fonts, and in the browser. Export output never depends on
  host-installed fonts, OS, locale or timezone (FF-10, FF-11).
- **Fonts.**
  - Licensed fonts render with shipped open replacements.
  - The PPTX references the real font name and never embeds it.
  - Open fonts are bundled.
  - One shared default font scheme, `aptos` (FF-31, FF-35).
- **Catalog.** pptx.gallery is a first-class OPF catalog: spec URLs serve
  schema-valid records, and core bundles a pinned, drift-checked snapshot
  (FF-37). Each gallery item shows its measured support badge (FF-36).
- **Progress.** The headline metric is the number of gallery items that pass
  the parity audit (FF-38), divided by the total. It is tracked in
  [burndown.md](burndown.md). The parity baseline is 0 of 900 perfect
  (2026-09-23). The FF-23 presence audit baseline is 7 of 793 `works`.

Carlito is only the openly licensed test stand-in for Calibri-class fonts. It
is not the goal; any chosen font must behave the same way.

The [gallery support table](gallery-support.md) (FF-23) records what the
preview, the export and re-import do today for every gallery value. It is the
per-dimension view of the gaps. Its
[parity scoreboard](gallery-support.md#parity-scoreboard) (FF-38) is the
progress metric.

## Definition of done

The program is done when every burndown item is `done` with its evidence
linked, and specifically:

1. **Parity scoreboard.** On the final merged heads, the FF-38 parity audit
   passes for every gallery item (perfect items equal the total). Charts are
   counted over the Aspose.Slides-supported set. FF-38 defines "perfect" and
   applies it to every value, including the authoring-only dimensions (tones,
   audiences, and narratives in their authoring role). Every gap in the [support table](gallery-support.md)
   is fixed or carries a recorded owner decision.
2. **Every environment.** The parity audit, or its FF-09 pairwise subset, runs
   in CI on ubuntu, windows and macos through a packed TypeScript consumer. It
   includes runs with no system fonts and in the browser (FF-09, FF-10, FF-11).
3. **Native confirmation.** A bounded PowerPoint sample, including CJK and
   right-to-left languages, opens read-only and confirms the chosen font names
   and parity (FF-12). The origin of the unexpected `Aptos` is determined by
   reviewed native evidence and fixed at the exporter/theme layer (FF-04,
   FF-05). The FF-13 embed attempt is audited, pass or fail.
4. **Font policy.** A policy table in core covers every scheme font. Licensed
   fonts render through shipped open replacements, the PPTX keeps the real
   names and never embeds them, open fonts are bundled, and `aptos` is the
   default everywhere (FF-31, FF-35).
5. **Catalog and badges.** pptx.gallery is a first-class OPF catalog (FF-37),
   and its items show measured support badges (FF-36). Nothing is deployed in
   this program.
6. **Published.** Evidence bundles, the
   [compatibility matrix](../../compatibility-matrix.md) and the handoff are
   merged (FF-14).

## Decisions

- 2026-09-23 (owner): the goal above replaces the earlier font-only goal. The
  program measures progress as gallery items that pass the parity audit
  (FF-38).
- 2026-09-23 (owner): one shared default font scheme, `aptos`, for every
  engine, so preview equals export (option A). Tracked as FF-35.
- 2026-09-23 (owner): font policy. Licensed fonts render with shipped open
  replacements, the PPTX references the real font name and never embeds it,
  and open fonts are bundled. Tracked as FF-31.
- 2026-09-23 (owner): pptx.gallery is a first-class OPF catalog. Tracked as
  FF-37.
- 2026-09-23 (owner): each pptx.gallery item shows its measured support status
  from the audit results. Tracked as FF-36; nothing is deployed in this
  program.
- 2026-09-23 (owner): charts are reduced to the chart types Aspose.Slides
  documents as supported. Tracked as FF-22.

## Scope

| In scope | Out of scope |
| --- | --- |
| opf core spec/catalog docs, evidence, ecosystem tests | Package publication, version bumps, site deploys (separate release task) |
| opf-pptx export, importer compatibility, native harnesses | Native PowerPoint header/footer objects (`p:hf`); OPF furniture export is in scope |
| opf-render preview font resolution and re-render checks | Deferred geometry drafts (core94, PPTX42, renderer27, editor25) |
| opf-editor switch operations and preview refresh | Archived shaping work |
| pptx.gallery data, snippet builders, catalog records and support badges (FF-22, FF-28, FF-33, FF-36, FF-37) | Deploying pptx.gallery |

pptx.gallery otherwise consumes released packages. pptx-dev and
openpresentation-site only consume released packages; they change after a
release that includes this work.

## Invariants

- Never relax a gate or tolerance: native 0.02 pt, renderer 0.1 reference px,
  the Carlito/chosen-font allowlists.
- Root alone owns PowerPoint and temporary font registrations. One bounded
  worker at a time (45 s default, 60 s max, per the
  [Windows native handoff](../../handoff-windows-native-2026-09-21-wrap-up.md)
  restart prompt). Never kill Office, call
  `Application.Quit`, close unrelated presentations, change Office security, or
  retry a native attempt in place; a new attempt uses a fresh directory.
- Preserve failures as evidence. Font programs are never committed.
- No package publication or deploy (packages, pptx.gallery, site) from this
  program.
- Native PowerPoint `p:hf` stays deferred; headers and footers are OPF
  furniture.
- Keep source, packed and registry claims separate, and schema support separate
  from renderer/editor/export fidelity.

## Resume protocol

Any session (root or subagent) resuming this program:

1. Read this file and [burndown.md](burndown.md). The progress log at the end
   of the burndown is the latest state.
2. `git fetch` core, opf-pptx, opf-render and opf-editor. Work only from fresh
   `origin/main` worktrees; never resume a squash-merged branch.
3. List open program PRs:
   `gh pr list -R OpenPresentation/<repo> --state all --search "FF- in:title"`
   for each repo, so merged items show up too. Reconcile any status drift into
   the burndown.
4. Pick the lowest-numbered `todo` item whose dependencies are `done`, or an
   item assigned to you. Branch as `codex/ff-<nn>-<slug>` (for example
   `codex/ff-07-script-slots`) and start the PR title with the ID (`FF-07: `).
   Branches opened before this tracker are grandfathered.
5. Each item has explicit acceptance criteria. An item is `done` only when its
   PR is merged after independent review and green CI on the exact head, and
   its evidence link is recorded.
6. When an item changes state, update its row and append one dated line to the
   progress log in the same PR, or in a small follow-up tracker PR.
7. Native PowerPoint items are root-only on the Windows host. Inspect the host
   first and record preflight and postflight evidence.

Roles: the root session plans, reviews, merges (reviewed and CI-green only)
and runs native attempts. Parallel subagents implement offline items and open
PRs. A separate reviewer agent reviews each PR.

## Environments

| Environment | Covered by |
| --- | --- |
| Linux, Windows, macOS Node 24 | CI matrix (FF-10) |
| Packed TypeScript consumer | Packed consumer typecheck and run (FF-10) |
| Cloud/serverless without system fonts | Determinism checks: no host font, locale or timezone dependence (FF-11) |
| Browser | Existing browser checks plus preview re-render in the matrix (FF-09) |
| Desktop PowerPoint (Windows) | Root-owned native sample and embed attempts (FF-04, FF-12, FF-13) |

## Related

- [Windows native handoff](../../handoff-windows-native-2026-09-21-wrap-up.md)
- [Font fidelity](../../font-fidelity.md)
- [pptx.gallery support by dimension](gallery-support.md) and its
  [reproducible audit](gallery-support/README.md)
- Evidence: [mixed-size edit](../../evidence/windows-native-mixed-edit-20260922/README.md),
  [first font-embed attempt](../../evidence/windows-native-font-embed-20260922/README.md)
