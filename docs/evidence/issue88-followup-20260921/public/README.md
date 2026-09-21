# Canonical production guidance audit — 21 September 2026

This is bounded issue88 documentation/API evidence, not universal compatibility or product certification. Checks used actual headless Chromium 153.0.8010.12 and canonical www domains. Vercel metadata resolves each canonical alias to a READY git deployment with the exact source SHA.

## Initial merged public fixes adopted

- openpresentation.org: deployment `dpl_AeiHR47yjZUZ2DUv98o95QRoGSqC`, source `ffe3fca43b0baf1476a0dce61d0d5d545a8c00bc` (site43). `/agents` visibly pins CLI0.9.0.
- pptx.gallery: deployment `dpl_AJdvHXvwdP2KnshRJBMu36Z9EZF4`, source `78d2ac10d1795cc273c10cacc712f60dfcf61d37` (gallery35). `/colors/cool-horizon` and `/llms.txt` describe published core0.11.0, named colors/variables and the published CLI bundle operation. Remote media/data remain separate.
- pptx.dev: deployment `dpl_Hrdtt7jbYRmM1kb6daHu4bFJWiZv`, source `761885b98092657fbbd05ffa529316d8b635539a`. `/docs/opf/reference-layer` accurately names core0.11.0, renderer0.9.0, PPTX0.9.1, editor0.8.0.

`browser-production-review.json` records requested/final URLs, status, text hashes, response headers, title, links and uncaught page errors. Seven rendered pages and eight raw resources returned HTTP200; rendered pages had no uncaught errors. Screenshots of corrected agent/gallery content were visually inspected. The gallery llms file is retained only as its first100 lines plus the complete response hash/byte count. Do not add its complete body to core evidence.

## Audit bounds

`bounded-source-pin-audit.json` covers tracked app/components/lib textual source:77 site paths,112 gallery paths,352 pptx.dev paths. Lockfiles, dependencies, dated reports and historical evidence are excluded. Source-version grep hits were reviewed: site unpublished copy is conditionally hidden for a public package; gallery0.10.1 is a historical code comment; pptx.dev prerelease CLI guidance concerns its separate hosted-API client, not the published OpenPresentation CLI. The comments are not user-facing stale train findings.

Current hosted guides examined: quickstart, compatibility matrix, CLI, agent skills, open ecosystem, LLM authoring, dynamic composition, live editor, data import, font fidelity, rich text, content payloads, format card; source README, llms discovery, gallery docs/API and pptx.dev docs/API/reference-layer. Additional canonical browser snapshots in `current-guide-audit-before.json` bind the remaining current-guide claims. This is not a crawl of every route/catalog item or authenticated API acceptance.

## Concrete defects found before follow-up corrections

1. The site's docs source pin was still released core `b8a1faf`: `/docs/reference/quickstart` and its raw file instructed renderer/PPTX0.8.1 and editor0.7.1. `/docs/reference/compatibility-matrix` said ColorRef paint needed a renderer release. Raw `/agent-docs/README.md` advertised core0.10.1. The source snapshot is separate from correctly installed current npm packages.
2. `/docs/data-import` still describes APIs as local coordinated preview packages; `/docs/rich-text` has the same registry-availability uncertainty; `/docs/dynamic-composition` retains candidate/unreleased descriptions for shipped furniture/metric behavior and stale layout explanations. These require upstream current-guide reconciliation, keeping real font/native/repair limits explicit.
3. Gallery `/docs` said editing was unavailable and denied downloadable PowerPoint files despite `/editor`. PR36 replaces this with the local browser editor's supported OPF import/edit/preview/undo/save/export scope and font-review requirements.
4. Site `scripts/export-agent-resources.mjs` appended all docs files, including binary evidence, into `/llms-full.txt`. Canonical production HEAD reported300849917 bytes at2026-09-21T13:30:07Z. Updating source to accepted937047f produced321605007 bytes with the same exporter. This is a preexisting machine-readable guide defect, not a runtime package defect; a parallel focused exporter correction is in progress.

## Follow-up state when initially recorded

Gallery36: `bbf47f6`, new branch `codex/issue88-gallery-editor-docs-20260921`, one documentation page. Node24.21.0/pnpm10.33.2 production build passed including all exact published editor hashes. Chromium read corrected built `/docs`, followed `/editor`, found Save OPF and PowerPoint controls, and emitted no page errors. Screenshot inspected. No runtime/package/catalog/golden changes. PR state in `gallery36-pr.json` is a timestamped snapshot, not final deployment evidence.

Site docs snapshot937047ff9f65d936126c577d3c6b7c5f9a61e364 passed sync, existing regressions, release/showcase hash checks and the648-page production build. It remains a local one-line package.json change, waiting for the final accepted upstream current-guide commit and exporter correction before the final build/PR.

Issue88 documentation/API should remain open until these follow-ups are reviewed, merged and verified on their canonical production deployments. Native Office acceptance, font compatibility, renderer issue24's0.1px gate, geometry drafts and package publications are outside these docs changes.
