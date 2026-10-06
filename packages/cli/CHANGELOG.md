# Changelog

## Unreleased

## 0.10.1 (2026-10-06)

- RR-20 (install fix, no API or output change): `engines.node` is now the open-ended `>=22` instead of `24.x`. npm's install picker skips a version whose `engines.node` does not match the running Node and silently installs the newest one that does, so on Node 26 (current) or Node 22 `npm i @openpresentation/cli @openpresentation/opf-render @openpresentation/opf-pptx` installed the CLI, renderer and PPTX 0.7.0 with core 0.9.0 (no `export` or `render` command) instead of the latest release. The test suite and the packed installs pass on Node 22, 24 and 26, and CI now runs them on Node 22 and 26 next to Node 24 (the development runtime). A new check, `pnpm check:engines-range`, fails on a closed `engines.node` in any package.json, on a lockfile entry (the published-matrix consumer included) for a release after this fix that still declares one, and on a workflow Node version below the range.

## 0.10.0

- Release 0.10.0 (rebuild with core 0.12.0, which the CLI bundles; CLI 0.9.2 bundled core 0.11.4). New commands: `opf audit`, `opf from-md` and `opf to-md`, `opf diff`, `opf merge`, `opf format`, `opf render`, `opf export` and `opf import` (descriptions below). `opf edit` and `import-data` use core's shared RFC 6902 module. The bundled schema and catalogs gain the core 0.12.0 fields (template variables, numbered lists, references, citations, footnotes and captions, chart options, font-policy `sizeAdjust` and `lineAscent`), so `opf validate` and `opf lint` accept documents that use them, and `opf paginate` and `opf audit` use the 0.01 pt font grid, the wrapped-line whitespace rule and the promoted-region reading order of core 0.12.0. Existing commands, options and output fields are unchanged. `opf render` and `opf export` draw through the optional `@openpresentation/opf-render` and `@openpresentation/opf-pptx` peers (optional peer ranges ^0.12.0, development dependencies 0.12.0), which must be the releases that resolve core 0.12.0 for the preview and export to agree with the CLI's own pagination (the lockstep rule in the [release process](../../docs/release-process.md)). The CLI still requires Node 24 (`engines.node` `24.x`, bundle target `node24`).
- RR-30: add `opf from-md <deck.md|-> [output.opf.json|-] [--split <rules|headings>] [--title <text>] [--force] [--strict]` and `opf to-md`, the Markdown and outline conversions of `@openpresentation/opf/markdown` (YAML front matter, `---` between slides, speaker notes with `Note:`); offline and deterministic. See the README.

- RR-31: add `opf diff <a|-> <b|-> [--format text|json|patch] [--exit-code] [--threshold]`, `opf merge <base> <ours> <theirs> [--output|--in-place] [--prefer ours|theirs] [--report] [--force] [--dry-run]` and `opf format <file|->... [--check|--in-place|--output] [--indent] [--eol]`. `opf edit` (and `import-data`) now use core's shared RFC 6902 module (`@openpresentation/opf/patch`) instead of a private copy; the operations, pointer rules and exit codes are unchanged. Requires the core release that contains `/patch`, `/diff` and `/format`.
- Add `opf render`, `opf export` and `opf import` (RR-27): per-slide SVG and PNG; PPTX, PDF (vector or raster, from the renderer that has it), PNG and SVG (directory or zip); PPTX to OPF with optional raw import signals (opf-pptx 0.11.9 and later). They print the `opf lint` report plus the written files, support `--strict`, `--force`, `--slides`, `--font-dir`, `--asset-dir` and `--date`, never load system fonts, never fetch URLs and read images only from the document folder. `@openpresentation/opf-render` and `@openpresentation/opf-pptx` are **optional peer dependencies** loaded on first use with an install hint; the package still has no runtime dependencies. See `docs/cli.md`.
- RR-29: `opf audit <file|-> [--json] [--rule <id>]... [--ignore <id>]... [--fail-on <error|warning|info|never>] [--severity <id>=<level>] [--threshold <name>=<n>] [--config <file>]`, `opf audit --list-rules` and `opf audit --explain <id>`: design and accessibility checks (contrast, overflow, type size, alt text, reading order, fonts, links, charts, placeholders) with stable rule ids, a human reporter and lint's JSON shape. Exit 0 for no finding at or above `--fail-on` (default `error`), 1 otherwise, 2 for usage or I/O errors. Read-only; fetches nothing. See [the audit guide](../../docs/audit.md).

## 0.9.2

- Rebuild with core 0.11.4 catalogs, schema and layout code (CLI 0.9.1 bundled core 0.11.3). The bundled schema gains `HeaderFooterItem.logo`, so `opf validate` and `opf lint` accept a header or footer item that is a logo, and the bundle carries the core that now composes the design fields that earlier validated but drew nowhere (cover and section logos, `design.contentDirection`, `design.chartPrimary`, `design.listBullet: "image"` picture bullets, header and footer logos, the accent font) and aligns a cover's tag and subtitle with its title. The CLI does not render or export, so those drawing changes reach users through renderer 0.11.9, PPTX 0.11.7 and editor 0.10.6 (which require core ^0.11.4); the CLI itself changes only where it reads the core schema, catalogs or layout geometry. No command, option or output field changes. The CLI still requires Node 24 (`engines.node` `24.x`, bundle target `node24`); Node 20 and 22 stay unsupported, as since 0.8.0.

## 0.9.1

- Rebuild with core 0.11.3 catalogs and schema (CLI 0.9.0 bundled core 0.11.0). The bundled layouts catalog now holds 100 layouts, including the 70 legacy pptx.gallery layout ids (`title-slide`, `two-column`, `action-plan`, `swot-analysis`, and so on), so `opf validate`, `opf lint`, `opf catalog layouts` and `opf paginate` no longer report an unknown layout id for a gallery document that names one, and the 25 of them that carry a `composition` or `contentBox` contract paginate with that geometry. The bundle also carries the pinned pptx.gallery default catalog (chart-type samples for histogram, pareto and box-and-whisker, `deprecation` warnings and the `opf/deprecated-catalog-id` lint rule) and everything else in core 0.11.1 to 0.11.3 (cover centering, script-font model, font policy table, per-item alignment, formatted furniture). No command, option or output field changes. New CLI test: a document whose slides use every bundled layout id, including the 70 legacy ids, validates with no warning.

## 0.9.0

- Rebuild with core 0.11.0, including the reference layer (`variables`, `ColorRef`, payload/slide `id`/`extensions`, `bundlePresentation` / `opf bundle`) and corrected stock narrative `layoutHint` values.

## 0.8.1

- Rebuild with core 0.10.1 catalogs and schema, including metric/quote/timeline layout placeholders and the corrected text-bullet contract.

## 0.8.0

- Require Node 24 and bundle core 0.10.0. Add `opf lint <file|-> [--config <local-json-file>] [--strict]` with exact source/configuration hashes, contextual catalog/schema diagnostics and design contracts. Lint does not rewrite documents or fetch resources.
- Include current source-preserving scalar, metric and timeline layout, readability policies and `grid-score-v8` explanations. Retain offline authoring, patch/undo-oriented workflows, pagination and all six portable agent skills.
- Browser rendering and editable PPTX remain companion-library workflows; schema and local layout checks do not certify native font/Office equivalence.

## 0.7.0

- Bundle core 0.9.0 with complete code filename/language/body composition, exact source/tab mappings, metadata-aware pagination and `grid-score-v3` explanations in the bundled library.
- Update the self-contained layout skill's shared-code and fidelity guidance. Keep safe offline installation/update of all six skills, preserved user configuration and existing CLI authoring, validation, editing and pagination commands.
- Browser editing and editable PowerPoint export require the coordinated library release set; the CLI does not bundle proprietary applications or require a hosted provider.

## 0.6.0

- Bundle core 0.8.0 with shared quote composition and persisted pagination readability floors.
- Update portable layout guidance while retaining the six-skill installer and standalone offline CLI workflow. This entry documents the already published 0.6.0 release; it does not republish it.

## 0.5.0

- Bundle all six OPF agent skills and add `skills install`, `skills update` and read-only `skills status`, with project, personal and explicit-directory targets.
- Preserve local modifications and unmanaged folders through all-skill preflight checks; keep recoverable backups when updating managed skills. Windows installation uses copies and needs no symlink privileges.
- Suggest `npx @openpresentation/cli@latest skills install` in help and document-creation reports. Skill installation works offline after downloading the standalone CLI and requires no hosted provider.
- Continue bundling OPF 0.7.0; this release does not republish or change the core package.

## 0.1.1

- Bundle OPF 0.4.1, including the corrected embedded PNG example.
- Preserve the standalone local executable and its existing commands; no hosted service or AI account is required.

## 0.1.0

- Initial standalone agent CLI for creating, validating, inspecting, editing, importing data and paginating OPF presentations.
