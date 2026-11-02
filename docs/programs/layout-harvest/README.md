# Layout harvest

Opened 2026-11-02. Branches `codex/lh-<nn>-<slug>`, pull request titles `LH-<nn>: `.

## Goal

Default OPF slides look as good as Claude Design's version of the same content. We compare OPF with Claude Design (Claude's Slides artifact type) slide by slide. We build what generalizes into the layout engine, the default layouts and the authoring skills. We also apply the design and export guidance in Claude's Slides type and pptx skill.

## How the comparison works

1. **Content only.** A slide's words, numbers and pictures go to Claude Design, with the deck's colours and fonts. No layout name, region, grid or arrangement rule goes with them.
2. **Same content in OPF.** The same slide is rendered by OPF with its default layouts.
3. **Side-by-side review.** Each pair is compared at the slide-HTML level (sizes, margins, structure) and visually.
4. **Generalize before building.** An idea is built only when it holds for every count, content kind, canvas and language the layout accepts. It is tested on the varied cases of `packages/gallery/test/layout-harvest.test.mjs` and on the composition goldens (30 layouts × 1 to 6 blocks × short and long content).

The corpus:

- `examples/technical/layout-sampler.opf.json`: every default layout and 13 dynamic compositions.
- LH-27: about 1000 slides chosen for variety rather than volume.
  - Every slide kind in `examples/`.
  - Item counts of 1 to 9.
  - Dense and sparse text.
  - Dark and light themes.
  - 4:3 and portrait canvases.
  - Right-to-left and CJK text.

## Definition of done

- Every catalog item in [burndown.md](burndown.md) is `done` or `descoped`, with a reason.
- Every comparison batch of LH-27 is reviewed, and its ideas are cataloged.
- The before/after review page shows each built item.

## Invariants

- **Content is never lost.** A layout change never drops, crops or silently shrinks content below the readability floor.
  - The composition goldens may not gain a finding on a case that is not already overfull.
  - Every example deck must still render (`check:examples-convert`, the golden render).
- **Drawing changes are declared.** A gallery record that draws differently is declared in its changelog fragment, so the release is a minor.
- **Goldens come from the workflow.** Render goldens are regenerated only by the `golden` workflow. Review its changed-slide sheets before merging.
- **The document is the source of truth.** No change makes Claude Design, or any other renderer, a dependency.

## Resume protocol

Read [burndown.md](burndown.md). Take the first `todo` item in priority order whose decision row is settled. Make one branch and one pull request per item, and update its row and the progress log in that pull request.

## Decisions

These are vetoable defaults, taken 2026-11-02 so the work need not wait. Each records the alternative.

| Decision | Default taken | Alternative |
| --- | --- | --- |
| Precedence of a layout's background variant (LH-01) | A layout's `design.variant` outranks the deck's and the theme's; the slide's own design still wins | The layout loses to the deck, as other design keys do |
| A fixed deck background against a layout's variant (LH-103; owner decision 2026-11-02) | A fixed background the deck or the theme draws (a hex or `var:` color, a gradient, a pattern, a picture) beats a layout's `design.variant`: the slide keeps it and its text follows its tone or luminance. A scheme-based one (none, a theme slot, a slot or role name such as `primary`, a deck `variant`) takes the layout's variant on top. A deck with a fixed background and a `variant` keeps the background; a theme's fixed background counts as the deck's | The layout variant hides every deck and theme background, a picture too (LH-01 as first built) |
| `image` layout fit | Keep `contain` (pictures whole) | `cover`, as Claude Design crops to fill |
| Hero capacity | Keep the full-height picture; three long supporting paragraphs overflow and are reported | Full-width support row as before |
| Small-chart defaults (LH-03) | Direct value labels for a single-series chart of eight or fewer points; import does not write the default back | Leave labels to authors |
| Corpus size (LH-27) | About 1000 varied slides in about 20 Claude Design batches | 1000 whole decks (mostly repeats; about 100× the cost) |
