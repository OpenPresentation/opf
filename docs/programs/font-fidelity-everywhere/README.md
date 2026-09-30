# Program: font fidelity everywhere

Status: **active** (opened 2026-09-23). Tracker: [burndown.md](burndown.md); per-font tracker: [font-tracker.md](font-tracker.md).
This is the single source of truth for the cross-repository program. Agents and
people resuming work start here, not from chat history or local scratch files.

## Goal

The owner's goal (2026-09-23), verbatim:

> "Every pptx.gallery configuration is PERFECTLY supported in rendering and PPTX output: for all 14 dimensions (charts limited to Aspose.Slides-supported chart types), the preview and the exported PPTX agree element by element (geometry within existing tolerances, text/runs, fonts in every script slot, colors, fills, backgrounds, images, z-order), the PPTX uses native PowerPoint constructs and re-imports cleanly, and a bounded native PowerPoint sample confirms it — identically for TypeScript developers on Windows/macOS/Linux, local, cloud/serverless without system fonts, and browser. Licensed fonts render with shipped open replacements while the PPTX references the real font name without embedding; one shared default font scheme (aptos). pptx.gallery is a first-class OPF catalog (spec URLs serve schema-valid records; core bundles a pinned, drift-checked snapshot) and shows measured support badges. Progress = count of gallery items passing the parity audit; tracked in docs/programs/font-fidelity-everywhere. Invariants: no gate relaxation, no in-place native retries, root alone owns Office, no publish/deploy, native p:hf deferred."

Owner decision 2026-09-30 amends the last clause of the quote: pptx.gallery does not show measured support badges or any other support or progress status. The measurement stays internal to this program.

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
  - Licensed (proprietary) fonts are never bundled or embedded. They render
    with shipped open replacements, and the PPTX references the real font
    name.
  - Open fonts are bundled. They may be embedded only through the explicit
    FF-13 embed path.
  - One shared default font scheme, `aptos` (FF-31, FF-35).
- **Catalog.** pptx.gallery is a first-class OPF catalog: spec URLs serve
  schema-valid records, and core bundles a pinned, drift-checked snapshot
  (FF-37). Measured support status (FF-36) is internal to this program and is not displayed on pptx.gallery (owner decision 2026-09-30).
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

## Next goal: every gallery config works (100%)

The owner's next goal (2026-09-30), verbatim: "for our progress table, set the
next goal to get everything to 100% 'works'". It follows the parity goal above
and is tracked as FF-47 to FF-58 in [burndown.md](burndown.md).

**Definition of done.** Every pptx.gallery config has pipeline status `works`
in [support-status.json](gallery-support/support-status.json) (the FF-23 audits
A and B), measured on published packages: the published opf-render, opf-pptx
and opf-editor releases plus the pptx-gallery main that consumes them, not
source worktrees. Baseline (core `60e73d4`, whose `support-status.json` was measured on the published set of 2026-09-30): 427
of 819 `works` (52.1%), 322 `partial`, 70 `gallery-only`. Gaps by dimension:
layouts 194 (124 partial, 70 gallery-only), font schemes 93, languages 93,
charts 7, themes 4, content blocks 1; the other eight dimensions are 100%.

**Status (2026-09-30, FF-58).** Measured on the published packages (core 0.11.3, renderer 0.11.6, PPTX 0.11.4, editor 0.10.4, pptx-gallery `edb77b2`): **812 of 819 `works` (99.1%)**. Every dimension is 100% except charts (19 of 26); the 7 chartex charts need the native PowerPoint check (FF-56) before the native export can be the default. The goal is not closed until then. See [gallery-support.md](gallery-support.md#goal-closure-on-the-published-set-ff-58-2026-09-30).

**Internal only.** This metric is tracked in this repository and never shown on
pptx.gallery. It falls under the invariant "No public support or progress status
on pptx.gallery" (owner decision 2026-09-30; FF-36 was re-scoped to an internal
measurement). No item below may publish the percentage, a badge, a legend, an API
field or a status table to the site.

**One command.** `pnpm report:works` (or
`node docs/programs/font-fidelity-everywhere/gallery-support/works-percent.mjs`)
prints `works` overall and per dimension from `support-status.json`; add
`--reasons` for the top reasons behind each non-`works` dimension and
`--json` for the numbers. Regenerate `support-status.json` first
(`build-support-status.mjs`, see the [audit README](gallery-support/README.md)).

**The font policy defines `works`.** The audits' `works` must follow the
owner's font policy (2026-09-29, see Decisions and
[font-fidelity.md](../../font-fidelity.md#font-policy-ff-31)): a preview that
draws the FF-31 policy table's look-alike replacement, with the PPTX writing the
family the user selected, is `works`. It is not a gap that the licensed family
itself is absent from the preview host. The audits must model the shipped hosts
the way FF-38 does with `PARITY_FONT_HOST=gallery` (the gallery editor's font
gate, opf-editor 0.10.1 with opf-render 0.11.2 or later), not a strict host
with no fonts. Strict no-host previews are a diagnostic, not the model. This
changes only what the audits measure as a gap (FF-48). It relaxes no gate or
tolerance: geometry, text, colours, export naming and re-import checks stay as
they are, and the FF-38 perfect/near tiers stay a separate measure (a visual-only
replacement is still `near` there). Anything the policy does not excuse (an
empty `ea`/`cs` theme slot, a layout the export ignores, a lost payload) remains
a real gap and is fixed in the engines.
FF-48 implements this ([measurement](gallery-support.md#audits-model-the-shipped-font-host-ff-48-2026-09-30)): audits A and B use the parity harness's
host model (`AUDIT_FONT_HOST=gallery` by default, `strict` as the diagnostic), and the themes become `works`.

**Owner decisions this goal may need.** Retiring or merging gallery layouts
instead of publishing canonical ids (FF-52, FF-55) changes the denominator and
ids people may use, so it needs an owner decision before it lands. Everything else
is engine work.

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
4. **Font policy.** A policy table in core covers every scheme font:
   - Licensed (proprietary) fonts are never bundled or embedded. They render
     through shipped open replacements, and the PPTX keeps the real names.
   - Open fonts are bundled. They may be embedded only through the explicit
     FF-13 embed path.
   - `aptos` is the default everywhere (FF-31, FF-35).
5. **Catalog.** pptx.gallery is a first-class OPF catalog (FF-37). Measured
   support status (FF-36) stays internal and is not shown on the gallery.
   Nothing is deployed in this program.
6. **Published.** Evidence bundles, the
   [compatibility matrix](../../compatibility-matrix.md) and the handoff are
   merged (FF-14).

## Decisions

- 2026-09-30 (agent decision, vetoable; FF-58): the closure audits run on the npm tarballs of the published packages, not on source worktrees, with one local core (the published core tarball was byte-compared with a build of its tag). The audit harness treats lazy vendored faces the way the shipped host loads them since opf-render 0.11.5: a family resolves through the faces the document draws, and a family with no drawn text resolves through a probe registry. That instrument change lowered no standard and raised no value: the first run on 0.11.6 scored 51 perfect because the harness asked for faces the host does not load. The goal is reported at 812 of 819 and left open for FF-56 instead of being closed by flipping the chartex default or relaxing the chart checks; the owner can veto that reading (for example by accepting the chartex fallback as `works`).
- 2026-09-30 (agent decision, vetoable; FF-58): FF-47 to FF-55 and FF-57 are done on the strength of the published-set audits (their acceptance criteria are the reasons they named, and all of those reasons are gone). Native PowerPoint confirmation of the written theme slots and of the other exports stays with FF-12/FF-46, which this goal does not claim.

- 2026-09-30 (agent decision, vetoable; FF-59): the slide `tag` is the eyebrow label and is drawn and exported in the scheme's primary colour (`colorScheme.primary`, else `accent1`), not the text colour. The FF-58 closure had the mismatch inverted; the export had always written the primary and the preview was the outlier, so the preview moved (opf-render#79) and the export only changed its encoding (`a:schemeClr accent1` where the deck theme holds the colour, the literal otherwise; opf-pptx#115). Not changed: no contrast adjustment (10 of 95 corpus tags are below 4.5:1, in the PPTX too; it would have to land in both engines), and the preview's separate `accent` role (`accent3`) stays unused for the tag. The owner can veto by asking for the text colour in both engines.
- 2026-09-30 (agent decision, vetoable; FF-60, coordinator-approved alternative): no Intos faces at weights 500, 600 or 800 are vendored (upstream, pinned `fef9315c`, has no Medium, ExtraBold or variable font; its Semibold exists for plain Intos only). Instead the parity fontResolution check counts a drawn weight at the tier of the face `toPptx` selects for it (bold from 600, regular below) when the preview draws exactly that face: Aptos 500 is Intos Regular, 600 and 800 are Intos Bold, which is what PowerPoint draws for the exported file. No width tolerance changes, a visual-only route stays near, and the legacy definition keeps the raw registry tier. 688/161/1 to 738/111/1 perfect/near/mismatch (50 values: 48 Aptos, 2 Georgia); see [gallery-support.md](gallery-support.md#aptos-at-weights-500-600-and-800-ff-60-2026-09-30). The owner can veto by asking for the raw registry tier back (one function, `asExportedFace`).
- 2026-09-30 (agent decision, vetoable; FF-61): the ten corpus tags under 4.5:1 (FF-59) are not fixed yet; a contrast rule has to land in the preview and the export together, so it is a tracked design follow-up, not part of FF-59.
- 2026-09-30 (agent decision, vetoable; FF-54): a gallery example that overflows its layout is fixed where it comes from. When the diagnostic depends on the content (`text-overflow`), the example is shortened to what the zone holds at the readability floor (dense stacks of five or more zones use two-item lists and a one-line title). When it does not depend on the content (`small-cell`: the card is under 100 x 60 px whatever it holds), the layout record's own region size changes (compact stack `padding 0.04`, `gap 0.02` for boxed 5x/6x column layouts, written by `sync-layout-contracts.mjs`). Tolerances, the `small-cell` limit, the 16 px floor and lint or diagnostic suppression never change. The owner can veto by asking for the previous margin and gap; the 12 records are the only data change.
- 2026-09-30 (agent decision, vetoable; FF-57): quote provenance follows the timeline pattern: `OPF_QUOTE_V1` tags hold topology only, never quote words, so re-import reads every word from the current native text, an edited quote imports as the edited quote, and a damaged or untagged one degrades to text blocks with `invalid-quote-provenance`. The `quote-import-reflow` diagnostic is reported on every restored quote, like the timeline, metric and code ones.

- 2026-09-23 (owner): the goal above replaces the earlier font-only goal. The
  program measures progress as gallery items that pass the parity audit
  (FF-38).
- 2026-09-23 (owner): one shared default font scheme, `aptos`, for every
  engine, so preview equals export (option A). Tracked as FF-35.
- 2026-09-23 (owner): font policy. Licensed (proprietary) fonts are never
  bundled or embedded; they render with shipped open replacements, and the
  PPTX references the real font name. Open fonts are bundled, and they may be
  embedded only through the explicit FF-13 embed path. Tracked as FF-31.
- 2026-09-23 (owner): pptx.gallery is a first-class OPF catalog. Tracked as
  FF-37.
- 2026-09-23 (owner): each pptx.gallery item shows its measured support status
  from the audit results. Tracked as FF-36; nothing is deployed in this
  program.
- 2026-09-23 (owner): charts are reduced to the chart types Aspose.Slides
  documents as supported. Tracked as FF-22.

- 2026-09-30 (FF-52, FF-55; root, provisional; the owner can veto before the PRs merge): layouts with geometry identical to the no-layout default get one of three outcomes and nothing is retired. (a) 25 legacy gallery layouts get a distinguishing contract from the gallery vocabulary (gutter, primary, narrow, wide, cards); (b) 24 Dark-master variants that compose exactly like a core layout become deprecated aliases (`deprecation.replacedBy`, like chart types) that stay resolvable, published and listed, and audit A measures each against its replacement; (c) the 20 core layouts that are the engine default for their content are listed by name in audit A as their own baseline (FF-52 allows this exact list). The (a) contract tweaks are deliberately minimal distinguishing geometry (a gap, a weight, a margin or a card); richer designs for sparse legacy layouts such as `executive-summary` are a later improvement and not required for FF-52. The 70 legacy slugs are canonical OPF ids bundled from the gallery catalog (`sync-gallery-catalog.mjs --include`), so nothing is retired and the denominator is unchanged. [Per-layout table](gallery-support.md#layout-contracts-and-canonical-ids-ff-52-ff-55-2026-09-30).
- 2026-09-30 (owner): the next goal after parity is 100% `works` for every
  gallery config, verbatim: "for our progress table, set the next goal to get
  everything to 100% 'works'". Tracked internally as FF-47 to FF-58; never shown
  on pptx.gallery. The audits follow the font policy (look-alike preview plus the
  selected family in the PPTX is `works`) and model the shipped font hosts.

- 2026-09-29 (owner): during the Actions credit shortage, run appropriate local
  tests and merge reviewed PRs when those tests pass. Preserve original CI
  denials/failures and separate local, cross-platform, native and release claims.
  This merge policy does not complete criteria that still need platform/native
  evidence, lower tolerances or authorize skipping release-specific gates.

- 2026-09-29 (owner): look-alike fonts and the PPTX font name. First message,
  verbatim: "look-alike fonts are to get around any font licensing
  restrictions. They are desirable for open source but if we export to
  PowerPoint the pptx file should include references to the font they selected
  and want to see in PowerPoint. If this isn't clear in docs/markdown
  everywhere then it should be." Later message, verbatim: "so a scenario... if
  the user wants Aptos... if Aptos is license restricted we can substitute a
  font (Aptos2 or whatever it's named) that looks similar and has the same size
  in pixels on the screen for rendering live previews of SVG. When we export to
  PPTX we should have PowerPoint open that file and display actual Aptos."
  Consequences:
  - The user's selected font is the source of truth. License-restricted
    (proprietary) fonts are never bundled or embedded.
  - For previews, SVG, the editor and thumbnails, the replacement should look
    similar and be metric-compatible (same advance widths and line metrics), so
    text occupies the same size on screen and wraps identically to PowerPoint.
    A metric-compatible look-alike is the goal (Calibri to Carlito, Aptos to
    Intos).
  - Where no metric-compatible open replacement exists yet, a
    visual-only look-alike is a documented fallback and a known layout-fidelity
    gap to close, not the intended end state.
  - PPTX export always writes the selected font name (for example
    `typeface="Aptos"` in the theme and in runs), never the replacement, so
    PowerPoint opens the file and shows the actual font (installed or Office
    cloud font). Only open fonts may be embedded, through FF-13.
  - The FF-38 `fontResolution` check must accept the
    [policy table](font-licensing.md)'s replacements for license-restricted fonts,
    provided the PPTX keeps the selected name: a metric-compatible replacement
    is perfect, and a visual-only replacement is classified near, not perfect.
    The harness and scoreboard change merged in
    [opf#159](https://github.com/OpenPresentation/opf/pull/159); this entry
    changes no gate.
  - The canonical statement is in [font-fidelity.md](../../font-fidelity.md#font-policy-ff-31).
    The sibling repositories link to it.

- 2026-09-30 (FF-49, FF-50; agent decision under the owner's every-config-`works`
  goal, the owner can veto it before merge): theme script slots and the
  language contract, recorded in [script-font-model.md](script-font-model.md#language-contract-ff-50-model-c).
  - Theme `a:ea` and `a:cs` follow Office's convention and the owner font policy
    (the PPTX names what the user selected and nothing else): a slot is written
    only where a script font is selected (the design font scheme's
    `eastAsian`/`complexScript`, the scheme's own script family, or the
    language's script font); every other slot stays empty, as in Office's own
    themes, so PowerPoint picks its per-language default (for example Yu Gothic
    for Japanese text typed later). A first version filled the empty slots with
    the theme's latin face; review rejected it because it degrades that
    behaviour, touches the theme fonts FF-05 investigates and writes a font
    nobody selected. The audit's "theme `ea`/`cs` is empty" reason is a gap
    only when a selected script font was not written.
  - Model C is the language contract: `language` sets `lang`, direction, the
    script slot fonts and mixed-script layout, never the Latin scheme; only
    `design.fontScheme` sets the Latin fonts. Armenian, Georgian and Ethiopic
    keep their font in the per-script entry, not `cs`, until the FF-12 native
    sample confirms PowerPoint's classification. No schema field changes.

## Scope

| In scope | Out of scope |
| --- | --- |
| opf core spec/catalog docs, evidence, ecosystem tests | Package publication, version bumps, site deploys (separate release task; the owner authorized agents to publish on 2026-09-29, see [release-process.md](../../release-process.md)) |
| opf-pptx export, importer compatibility, native harnesses | Native PowerPoint header/footer objects (`p:hf`); OPF furniture export is in scope |
| opf-render preview font resolution and re-render checks | Deferred geometry drafts (core94, PPTX42, renderer27, editor25) |
| opf-editor switch operations and preview refresh | Archived shaping work |
| pptx.gallery data, snippet builders and catalog records (FF-22, FF-28, FF-33, FF-37) | Deploying pptx.gallery |

pptx.gallery otherwise consumes released packages. pptx-dev and
openpresentation-site only consume released packages; they change after a
release that includes this work.

**Release dependency.** A perfect *live* pptx.gallery needs
published packages. The owner authorized agents to publish npm packages on
2026-09-29 through the documented release task ([release-process.md](../../release-process.md)),
separate from program work items, which do not publish. The in-program proof is therefore the FF-38 parity
audit on merged heads, together with the internal FF-36 support data derived from it.
FF-15 delivers release-readiness notes for each checkpoint, listing what a
release would ship and what the live gallery would then show.

**Release state (2026-09-29).** The release owner has since published
opf-render 0.11.2, opf-pptx 0.11.1 and opf-editor 0.10.1 and deployed
pptx.gallery on them (core `55b7d45` carries the release plan). That happened
outside the program's own PRs and does not change this program's invariants. It
delivers the FF-41 gallery-editor font gate and the native watermark export
(FF-26), but the audits have not been re-run on those heads. Completion of FF-14, FF-15,
FF-12 and every native gate is not claimed. Per-item state is in
[burndown.md](burndown.md).

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
- No package publication or deploy (packages, pptx.gallery, site) from program
  work items. Publishing is a separate release task that the owner authorized on
  2026-09-29 (see [release-process.md](../../release-process.md)); site and
  gallery deploys still follow their own repositories' rules.
- Native PowerPoint `p:hf` stays deferred; headers and footers are OPF
  furniture.
- No public support or progress status on pptx.gallery: no badges, legends,
  panels, API fields or llms.txt lines about measured, pending or parity
  status (owner decision 2026-09-30). The measurement stays internal to
  this repository.
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
   criteria hold, its PR is merged after independent review under the applicable
   merge policy, and its evidence link is recorded. The September 29 local-test
   exception permits PR merges; it does not establish unrun cross-platform,
   native, physical-font or final release acceptance.
6. When an item changes state, update its row and append one dated line to the
   progress log in the same PR, or in a small follow-up tracker PR.
7. Native PowerPoint items are root-only on the Windows host. Inspect the host
   first and record preflight and postflight evidence.

Roles: the root session plans, reviews and merges exact reviewed heads under
this policy. Only the Windows root owner runs native attempts. Parallel subagents
implement offline items and open PRs. A separate reviewer agent reviews each PR.

## Environments

| Environment | Covered by |
| --- | --- |
| Linux, Windows, macOS Node 24 | CI matrix (FF-10) |
| Packed TypeScript consumer | Packed consumer typecheck and run (FF-10) |
| Cloud/serverless without system fonts | Determinism checks: no host font, locale or timezone dependence (FF-11) |
| Browser | Existing browser checks plus preview re-render in the matrix (FF-09) |
| Desktop PowerPoint (Windows) | Root-owned native sample and embed attempts (FF-04, FF-12, FF-13) |

## Related

- [Works percent report](gallery-support/works-percent.mjs) (FF-47): `pnpm report:works`, the 100% `works` progress measure
- [Per-font fidelity tracker (FF-40)](font-tracker.md): one record per font family with route, bundled face, styles,
  measurements, host and native status, parity signals, phase, status and next action, sorted by priority
  (machine-readable: [font-tracker.json](font-tracker.json))
- [Windows native handoff](../../handoff-windows-native-2026-09-21-wrap-up.md)
- [Font fidelity](../../font-fidelity.md)
- [pptx.gallery support by dimension](gallery-support.md) and its
  [reproducible audit](gallery-support/README.md)
- Evidence: [mixed-size edit](../../evidence/windows-native-mixed-edit-20260922/README.md),
  [first font-embed attempt](../../evidence/windows-native-font-embed-20260922/README.md)
