# Current-entrypoint audit scope

This receipt records the final bounded audit at core commit `120a770041b3f7d3c04ced1ac87675ed0d18292b` (PR #98). It is separate from pending deployment acceptance and makes no new native/font/repair claim.

Reproduce the read-only inventory and matched line numbers:

```sh
python3 /private/tmp/opf-current-entrypoint-checks-20260921/audit-scope.py /private/tmp/opf-current-entrypoint-docs-20260921/opf > /private/tmp/opf-current-entrypoint-checks-20260921/audit-scope.json
```

The JSON records the commit/tree, script hash, every searched file hash, exact regular expressions and matched lines. Searches are case-sensitive. The final all-version scan broadens the original obsolete-version/availability searches; each hit was read in context. The audit is lexical and bounded, not a certification that every sentence throughout the repository is current.

## Exact paths searched

- `README.md`
- `docs/BACKLOG.md`
- `docs/agent-skills.md`
- `docs/catalog-schema-reference.md`
- `docs/compatibility-matrix.md`
- `docs/content-item-design-overrides.md`
- `docs/content-payloads.md`
- `docs/data-import.md`
- `docs/design-resolution.md`
- `docs/dynamic-composition.md`
- `docs/ecosystem-development.md`
- `docs/examples.md`
- `docs/font-fidelity.md`
- `docs/format-card.md`
- `docs/how-opf-works.md`
- `docs/lint.md`
- `docs/live-editor.md`
- `docs/llm-authoring.md`
- `docs/open-ecosystem.md`
- `docs/quickstart.md`
- `docs/release-process.md`
- `docs/rich-text.md`
- `docs/schema-reference.md`
- `docs/table-text-colors.md`
- `packages/cli/README.md`
- `packages/javascript/README.md`
- `skills/opf-author/SKILL.md`
- `skills/opf-author/references/content.md`
- `skills/opf-edit/SKILL.md`
- `skills/opf-edit/references/editor.md`
- `skills/opf-export/SKILL.md`
- `skills/opf-export/references/rendering.md`
- `skills/opf-inspect/SKILL.md`
- `skills/opf-layout/SKILL.md`
- `skills/opf-layout/references/geometry.md`
- `skills/opf-presets/SKILL.md`
- `skills/opf-presets/references/design.md`

## Patterns and retained hits

- Obsolete-version candidates: `0\.(10\.1|8\.1|7\.1|7\.0|5\.0|4\.0|5\.1)`.
- Availability candidates: `unreleased|local preview|release target|pre-release|future (render|edit)|not yet|Still needed`.
- Publication context: `published|public set|Use core|CLI preview|preview packages|candidate packages|pending release|release will|not published`.
- Full version cross-check: `0\.[0-9]+\.[0-9]+`.

The nine corrected files are README; agent-skills, content-payloads, ecosystem-development, live-editor and table-text-colors guides; author/edit skill entrypoints; and the editor skill reference. Current pins use core 0.11.0, CLI/render 0.9.0, PPTX 0.9.1 and editor 0.8.0 on Node 24. The installed public-export smoke in this folder verifies the APIs whose availability wording changed.

Remaining older-version/availability matches have these dispositions:

| Paths / locations | Why retained |
| --- | --- |
| `docs/compatibility-matrix.md:32,108` | Old caret-range exclusion and explicitly previous coordinated baseline; neither recommends installing the old train. |
| `docs/content-payloads.md:163,176,178` | Rich cells, import and layoutTable introduction versions; current coordinated pins now precede them. Native viewer and unsupported-table limits remain real boundaries. |
| `docs/dynamic-composition.md:79,81,93,127,131,164,192` | API/algorithm milestones and original rollout checkpoints. Its introduction explicitly distinguishes historical versions from current grid-score-v9 / furniture-flow-v2 and the published train. |
| `docs/ecosystem-development.md:16-20` | Explicit September 9 portability checkpoint, including old Node 20/24 and package source evidence; current Node 24 train is stated separately. |
| `docs/font-fidelity.md:9-15,89,95` | Renderer 0.8 API introduction, recorded experimental-font evidence, and genuine theme/embedded-font/shaping/native limitations. Akasia 0.0.2 is an experimental font version, not an OPF package pin. |
| `docs/live-editor.md:17,109-115` | Unpublished local tarballs are a development recipe, separate from published install. The remaining list now concerns mixed-style typing/caret, specialized geometry/rendering, fonts and native acceptance. |
| `docs/quickstart.md:120,158` | “Local preview” names SVG output, not unpublished software; archived shaping prototypes are correctly excluded from published runtime. |
| `docs/release-process.md:40-44,57,143` | Explicit example of a historical 0.3.0 tag and immutable publication procedures, not a recommended current install. |
| `docs/table-text-colors.md:9` | Native observations retain their recorded source-checkpoint/runtime scope; they are not promoted to fresh current-package acceptance. |
| `docs/agent-skills.md:22,73`; `docs/open-ecosystem.md:14`; author/export skill version cautions | Correct warnings to inspect actual installed exports and distinguish source documentation from immutable published skill/package snapshots. |
| `packages/cli/README.md:28,136`; `docs/lint.md:3`; inspector skill | “0.5.0 and later” skill installer and 0.8.0 lint introductions; current CLI 0.9.0 is explicitly documented. |
| `packages/javascript/README.md:7,25,72-74` | Package naming history for 0.2.0, Node 24 boundary since 0.10.0, and lint introduction; no old install command. |
| `skills/opf-export/references/rendering.md:5-6,19` | prepareNodeFonts introduction and older-release exclusion, accompanied by current coordinated versions. |
| `skills/opf-layout/references/geometry.md:42,57-63,68,70` | Explanation/quote/code and card-placement milestones, with current grid-score-v9 / furniture-flow-v2 and published pins stated later. Source mappings and native/repair limitations remain explicit. |

Other publication-pattern hits describe current supported packages, immutable publication policy or present-day boundaries; matching “published” alone is not a stale-copy finding. Remaining guarded-repair, native issue 87, renderer issue 24 at 0.1px, font compatibility and coordinated geometry work stays outside bounded issue88 closure.

## Exclusions

Dated handoffs/security/backlog receipts, `docs/evidence/**`, `docs/plans/**`, release checkpoints and migration/continuation history were not rewritten or treated as current installation guides. The JSON lists exact excluded root-document names. Nested history was excluded by inventory scope; relevant historical evidence was read only where needed to interpret current guide claims. This scope does not include generated site snapshots or claim their eventual canonical deployment accepted.

Repository skill prose corrections do not change the immutable skill snapshot already bundled in CLI 0.9.0. No npm release, package version change, compatibility waiver or repository mutation was made to produce this receipt.
