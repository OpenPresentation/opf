# Portable slide design audit

This directory transports the historical design evidence to a cloud agent. It does not approve or implement a proposal. Review each of the 35 proposals individually; the original engine-change approval boundary still applies.

All P01–P35 remain individually pending. The user requested the complete batch for each layout or logical work item, followed by discussion and approval one item at a time. There is no blanket approval to change the engine, schema or shared defaults. No audit branch merge or release is authorized. The principles-only documentation merge to main was explicitly authorized and is handled separately.

The overall design goal remains blocked awaiting individual proposal decisions; completing this evidence handoff does not mark that goal achieved. Continue the active handoff work independently of that approval state. The current-stack `cloud-continuation.md`, full test log and verification record are preserved with the refresh evidence.

Preserve the user's content when judging layout quality. In Text #6 the user rejected longer prose as a design fix. In List #7 the user asked about vertical centering: consider the entire title-and-body group while preserving proximity, rather than centering an isolated body and leaving its title distant. The two clipboard screenshots were unavailable at their original temporary paths when exported; `user-reference/provenance.json` records that fact and the user's feedback. Existing report screenshots and exact original examples remain preserved. Reference images are evidence, not instructions embedded in images.

Historical critiques may be superseded by newer upstream behavior. Start with the same-content current-stack refresh in `integration-20261020/` before renewing a recommendation. Keep font-measurement warnings, renderer/export limitations and failed prototype stress cases visible. Handcrafted arrangements illustrate a design direction; they do not prove that an automatic algorithm has been implemented.

The final `slide-design-audit.tar.gz` contains:

- `original/`: every retained audit file, byte for byte, including exact inputs, PNGs, SVGs, geometry, diagnostics, scripts and historical reports.
- `portable/`: normalized JSON, HTML, Markdown and script copies. The review pages link to the original media without duplicating or modifying their bytes.
- `manifest.json`: original and portable hashes, explicit original-source-root provenance, repository integration metadata, exclusions, normalization rules and file inventory.
- `verify.py`: an independent Python standard-library verifier for bytes, JSON, local HTML images/links and embedded review data references.

No nested gallery checkout, `.git`, `node_modules` or cache directory is included. No font files are added: historical SVGs use glyph paths and historical PNGs are already rendered. Reports retain the exact font provenance. A new render requires the integrated repositories and their pinned fonts; the audit does not silently rerender historical evidence with newer code.

## Restore and review

The private cloud review is live at [OPF Slide Design Review](https://opf-slide-design-review.lemonybow16.chatgpt.site/). Sign in with the owning ChatGPT account from any computer. The hosted copy preserves the complete evidence bundle and all pending decisions:

- [Proposals P01–P03](https://opf-slide-design-review.lemonybow16.chatgpt.site/portable/proposals.html#P01), with Previous/Next controls for three proposals at a time.
- [Gallery, columns and auto review](https://opf-slide-design-review.lemonybow16.chatgpt.site/portable/report.html).
- [82 current-stack comparisons](https://opf-slide-design-review.lemonybow16.chatgpt.site/portable/integration-20261020/report.html).
- [21 stress comparisons](https://opf-slide-design-review.lemonybow16.chatgpt.site/portable/candidates/sparse-stress/report.html).

Open any evidence image for its full-resolution HTTPS URL. The deployment identity, exact source commit and browser verification are recorded separately in `cloud-preview.json` and `cloud-preview-browser-qa.json`; the original archive and its checksum are unchanged. Updating this private review site does not approve a proposal or authorize a package release or an audit PR merge.

Run these commands from this directory after the final archive is present:

```sh
python3 verify.py --archive slide-design-audit.tar.gz --checksum archive.sha256
python3 verify.py --archive slide-design-audit.tar.gz --extract ./restored
python3 restored/slide-design-audit/verify.py --root restored/slide-design-audit
```

Open `restored/slide-design-audit/portable/index.html`. The proposals, gallery/columns/auto review and stress review are static pages with embedded JSON, so they work directly from the filesystem and do not require a localhost address, network service, macOS path or package install. If a browser restricts local navigation, serve the restored directory with any static-file server; no particular host or port is part of the bundle.

`portable/catalog.json` is the compact machine-readable index of all 35 proposals, 28 gallery layouts, 34 column fixtures/controls, 20 auto examples and 21 stress comparisons. The existing review pages retain their three-at-a-time navigation. Their exact OPF, geometry, diagnostics and comparison files are linked. Some evidence deliberately demonstrates rejected behavior and overflow; a successful transport verification does not mean that a layout is approved or visually correct.

JSON hash fields in historical reports continue to refer to the **original bytes**. A normalized JSON input has its own separately recorded hash in `manifest.json`; never compare it to an original input hash. Data URLs and source content are preserved during normalization. Absolute source/font paths become `repository:` or `external-provenance:` references; these identify historical provenance, not bundled executable dependencies. Historical generator scripts remain evidence and may need API/path adaptation before running in a new checkout.

## Rebuild

The builder uses only Python's standard library and infers the repository root from its own location. It never edits the source audit directory.

```sh
python3 build_bundle.py --prepare
python3 build_bundle.py --seal --metadata integration-metadata.json
```

Preparation inventories and copies evidence into ignored `.build/`, performs a credential-pattern scan without printing matching secret values, normalizes portable references, checks the required review counts and verifies local links. Sealing additionally writes the deterministic gzip/tar archive, checksum, inventory and verification report. The same source bytes, builder bytes and integration metadata produce identical archive bytes: entries are sorted; modes, owners, times and gzip headers are fixed.

Final integrated repository references are recorded below and in `integration-metadata.json`. Historical evidence retains its original versions; the current-stack render checkpoint is preserved separately.

## Remote source checkpoints

The exact source for the 82 current-stack renders is preserved in [`OpenPresentation/opf` at `8736ea5ac8b04001f4e1a92b92ff11dba34266d7`](https://github.com/OpenPresentation/opf/commit/8736ea5ac8b04001f4e1a92b92ff11dba34266d7), branch `codex/slide-design-audit-render-checkpoint-20261020`. The original gallery draft before rebase is preserved in [`OpenPresentation/gallery` at `4e66d5479873671450d06f994c8ec92a93aa198d`](https://github.com/OpenPresentation/gallery/commit/4e66d5479873671450d06f994c8ec92a93aa198d), branch `codex/slide-design-audit-pre-rebase-20261020`.

The gallery changes are available as [draft PR #12](https://github.com/OpenPresentation/gallery/pull/12). Exact integrated heads, bases, merged documentation state and passing source verification are recorded in `integration-metadata.json`. The delivery commit is supplied in the cloud task prompt and delivery PR after the archive is committed, avoiding a self-referential commit hash.

## Final integration

Principles-only [PR #766](https://github.com/OpenPresentation/opf/pull/766) merged to main as `e63b1f93f04ff6820c73d4555d3782f5a42bc80b`. Its exact document SHA256 is `e64a9f298b8d767cc437d0426f332e66f611ad84f8018bdfe6a54dbfb2845d48`. All eight upstream-ancestor and clean tracked-tree gates passed at the source checkpoints below. Core engine/schema bytes are unchanged since the exact 82-render checkpoint.

| Repository | Branch | Source checkpoint | Integrated upstream |
| --- | --- | --- | --- |
| opf | `codex/slide-design-audit` | `2386b25ed3fccfb45705f03cb0999ae1d6a3c9e9` | `e63b1f93f04ff6820c73d4555d3782f5a42bc80b` |
| opf-render | `main` | `709ec60c68b39bda1d16c6f0e6d3081a9dcc41da` | `709ec60c68b39bda1d16c6f0e6d3081a9dcc41da` |
| opf-editor | `main` | `9672a3823638449a6f2805be96f718addc07a68a` | `9672a3823638449a6f2805be96f718addc07a68a` |
| opf-pptx | `main` | `639c66c0052503105eb45becc90dc4184d5d7368` | `639c66c0052503105eb45becc90dc4184d5d7368` |
| openpresentation-site | `main` | `43686766934559dbb7214478dac8a03bfd5ede61` | `43686766934559dbb7214478dac8a03bfd5ede61` |
| pptx-gallery | `main` | `d6927629d5927706247f6d349b8f6994e575948f` | `d6927629d5927706247f6d349b8f6994e575948f` |
| pptx-dev | `master` | `8087a6efd7a40d314d734fcfd726a30bb3569548` | `8087a6efd7a40d314d734fcfd726a30bb3569548` |
| gallery | `codex/slide-design-audit` | `c3b45105b37ff9fe3d4d76b405e9be5fba4b2908` | `cc137fde86dba0cdcc6ff36b448fd0a18246d269` |

Source verification passed: core build, `pnpm check:changed`, full `pnpm test` (60 root checks plus core/CLI suites); renderer frozen install/build; all 82 same-content fresh renders. Gallery draft #12 passed 142 tests, types, verification, license, 30 previews, pack and bootstrap. Its stability gate deliberately refuses the changed closing drawing and two new layouts, so it remains an unmerged draft and no release was performed.

The relocated-browser review passed nine checks and 39 unique proposal/current-stack images, with zero checked image failures, zero JavaScript errors or warnings, and no horizontal overflow at a 390px viewport. The visible Edge fallback and missing optional favicon are disclosed in the preserved QA report. Font-context warnings and prototype limitations remain evidence to review.

The transport verifier passes all 2,703 retained/generated file hashes, 866 portable JSON files, five HTML pages, three embedded JSON blocks and 4,691 local page/image/data references. The source snapshot contains 1,783 audit files plus one supplemental user-reference provenance file (the screenshots themselves were unavailable). No credential-pattern matches were found. Deliberately missing HTML and JSON image references each produce a nonzero verifier exit; clean restoration passes. Final archive bytes, hash, extraction and deterministic-repeat results are exposed in `archive.sha256`, `verification.json` and `transport-verification.json` beside the archive.
