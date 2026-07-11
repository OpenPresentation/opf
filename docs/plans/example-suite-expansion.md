# OPF Example Suite Expansion Plan

> **Status:** Shipped (125 example decks now ship in the npm package as of 0.3.0).

This plan tracks the expansion of `examples/` beyond the original compact technical fixtures. It is written so another agent can resume the work after context compaction without needing the live conversation.

## Goals

- Add about 100 realistic `*.opf.json` presentation documents under a new organized folder structure inside `examples/`.
- Cover industries, business functions, education, government, nonprofit/civic, research, and presentation-type scenarios.
- Exercise sparse and dense OPF documents:
  - sparse decks with only `name` and `slides`
  - metadata-rich decks with organization, speakers, catalog references, design, assets, notes, regions, blocks, and extensions
  - inline catalog override examples
  - asset-backed media and chart data examples
- Use a broad slice of the bundled catalog across narratives, layouts, chart types, themes, color schemes, font schemes, languages, audiences, purposes, tones, and social platforms.
- Validate every `*.opf.json` under `examples/` with the repository validator.
- Strengthen `/docs` so all public OPF schemas, presentation fields, and `$defs` objects/types have an author-facing reference.

## Folder Structure

New examples should live under `examples/gallery/`:

- `industries/`: healthcare, finance, retail, manufacturing, energy, media, logistics, agriculture, hospitality, real estate, telecom, insurance, pharma, aerospace, professional services, and related verticals.
- `business-functions/`: sales, marketing, product, engineering, operations, finance, HR, legal, security, support, customer success, procurement, strategy, and analytics.
- `education/`: K-12, higher education, curriculum, research, student services, campus operations, and training scenarios.
- `government/`: public health, transportation, emergency management, city council, grants, regulators, infrastructure, workforce, and public engagement scenarios.
- `presentation-types/`: pitch decks, QBRs, board updates, training decks, proposals, incident reviews, launch plans, policy briefings, conference talks, reports, and workshops.
- `international/`: multilingual and region-specific examples that exercise language and font catalog records.
- `design-and-media/`: examples focused on design variants, image/video assets, watermarks, headers/footers, slide images, and dimensions.
- `technical/`: compact focused fixtures for schema, validator, renderer, and catalog-resolution behavior. Existing root-level technical examples should live here instead of the examples root.

The original compact examples should live under `examples/technical/` as regression fixtures. Keep the examples root as an organizer rather than a long-term home for standalone OPF documents.

## Example Design Rules

- Each presentation should tell a coherent mini-story, even when it is intentionally small.
- Prefer plausible but fictional organizations, programs, products, and metrics.
- Use `*.opf.json` filenames in lowercase kebab-case.
- Mix root payload slides, promoted region slides, and `blocks` slides.
- Use all current content payload families across the suite: text, bullets, list items, image, video, chart, table, code, metric, quote, and timeline.
- Include layout references on many slides, but do not force layout usage where a minimalist example is clearer.
- Include a range of design configurations:
  - string shorthand catalog references
  - object-form overrides
  - solid, gradient, image, pattern, and theme-slot backgrounds
  - dimensions presets and explicit sizes
  - header/footer variants
  - logo sets and watermark controls
- Include examples of `catalogs.<kind>.source` and inline `catalogs.<kind>.records`.
- Do not record private coverage stats in repository files.

## Private Checkpoint Loop

After each group of 10 generated presentations:

1. Validate the new group structurally with the local validator.
2. Check internal coverage against schema features and catalog kinds.
3. Adjust the next group toward underrepresented scenarios, content payloads, design variants, and catalog references.
4. Keep the checkpoint numbers out of repo files and final user-facing notes.

## Validation Plan

1. Generate or update the example files.
2. Build the local JavaScript/CLI packages if needed.
3. Run the validator against every `examples/**/*.opf.json` file.
4. Fix invalid documents and re-run until all pass.

## Documentation Plan

Add author-facing docs under `docs/`:

- `docs/schema-reference.md`: top-level presentation fields plus every `$defs` object/type in `spec/schemas/opf.schema.json`.
- `docs/catalog-schema-reference.md`: companion catalog schemas and their fields.
- `docs/examples.md`: folder guide and authoring patterns demonstrated by the expanded suite.

Keep the docs practical: explain when to use each shape, list required fields, and point readers toward examples that demonstrate the object.
