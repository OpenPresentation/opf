# Changelog

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
