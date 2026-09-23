# Gallery support audit (FF-23)

The reproducible audit behind [gallery-support.md](../gallery-support.md). It is
the regression check for FF-24 to FF-36: an item that claims to fix a gap
re-runs the audit on its heads and links the changed rows.

| Path | Contents |
| --- | --- |
| `audit-a/` | Layouts, content blocks, image treatments, backgrounds, headers/footers. `scripts/`, `results.json`, generated `SUMMARY.md`. |
| `audit-b/` | Color schemes, font schemes, languages, themes, narratives, audiences, tones, socials. `scripts/`, `results.json`, the audit's own `README.md` and generated per-dimension tables (`*.md`). |
| `support-status.json` | One record per gallery value, built from both `results.json` files. |
| `build-support-status.mjs` | Regenerates `support-status.json`. |

Results are copied byte for byte from the measured run (heads in
[gallery-support.md](../gallery-support.md)). The only edits are in the
scripts: the author's local pptx-gallery path became
`process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery'`. The 245 exported PPTX
files, `out/` intermediates (snippet bundles, `raw-results.json`) and build
logs are not committed. `audit-b/README.md` still mentions them because it
describes the original run.

## Re-running against new heads

The scripts locate their inputs relative to their own folder, so copy them into
this layout (any `<workspace>` directory):

```text
<workspace>/
  pptx-gallery/                    checkout at the head to measure (GALLERY_DIR)
  sources/audit-A-opf/             opf, opf-render, opf-pptx worktrees for audit A
  sources/audit-A-opf-render/
  sources/audit-A-opf-pptx/
  sources/audit-B-opf/             opf, opf-render, opf-pptx, opf-editor for audit B
  sources/audit-B-opf-render/
  sources/audit-B-opf-pptx/
  sources/audit-B-opf-editor/
  dimension-audit/A/               copy of audit-a/
  dimension-audit/B/               copy of audit-b/
```

Node 24 and pnpm (for core) are required. No Office or COM is used. From a
bash shell, with opf-render, opf-pptx and opf-editor cloned next to this
checkout and pptx-gallery checked out at `$W/pptx-gallery`:

```bash
W=<workspace>
OPF=<path to this opf checkout>
repo() { if [ "$1" = opf ]; then echo "$OPF"; else echo "$OPF/../$1"; fi; }
for r in opf opf-render opf-pptx opf-editor; do git -C "$(repo $r)" fetch origin; done
for s in A B; do
  for r in opf opf-render opf-pptx; do
    git -C "$(repo $r)" worktree add --detach "$W/sources/audit-$s-$r" origin/main
  done
done
git -C "$(repo opf-editor)" worktree add --detach "$W/sources/audit-B-opf-editor" origin/main

# Build: core with pnpm, siblings with npm (audit B imports sibling dist/).
for s in A B; do
  (cd "$W/sources/audit-$s-opf" && pnpm install --frozen-lockfile && pnpm -r --if-present build)
  for r in opf-render opf-pptx; do (cd "$W/sources/audit-$s-$r" && npm ci && npm run build); done
done
(cd "$W/sources/audit-B-opf-editor" && npm ci && npm run build)

mkdir -p "$W/dimension-audit"
cp -r "$OPF/docs/programs/font-fidelity-everywhere/gallery-support/audit-a" "$W/dimension-audit/A"
cp -r "$OPF/docs/programs/font-fidelity-everywhere/gallery-support/audit-b" "$W/dimension-audit/B"
export GALLERY_DIR="$W/pptx-gallery"

# Audit A: writes results.json, then SUMMARY.md. ONLY=layouts,blocks and LIMIT=n narrow a run.
cd "$W/dimension-audit/A"
node --import ./scripts/register.mjs scripts/audit.mjs
node scripts/summary.mjs

# Audit B: snippets, measurement, then classification (results.json, *.md).
cd "$W/dimension-audit/B"
mkdir -p out
h() { git -C "$1" rev-parse --short=7 HEAD; }
printf '{"pptx-gallery":"%s","opf":"%s","opf-render":"%s","opf-pptx":"%s","opf-editor":"%s","node":"%s"}\n' \
  "$(h "$GALLERY_DIR")" "$(h "$W/sources/audit-B-opf")" "$(h "$W/sources/audit-B-opf-render")" \
  "$(h "$W/sources/audit-B-opf-pptx")" "$(h "$W/sources/audit-B-opf-editor")" "$(node -p 'process.versions.node')" > out/heads.json
node scripts/gen-snippets.mjs
node --import "$W/sources/audit-B-opf/scripts/register-local-opf.mjs" scripts/audit.mjs
node scripts/summarize.mjs
```

Then copy the new `results.json` and generated markdown (`audit-a/SUMMARY.md`,
`audit-b/*.md`) back into this folder, replace any local absolute path with
`<workspace>`, regenerate the per-item file and update the counts and heads in
[gallery-support.md](../gallery-support.md):

```bash
node docs/programs/font-fidelity-everywhere/gallery-support/build-support-status.mjs
```

To measure a fix before it merges, point the matching `sources/audit-*-<repo>`
worktree at the fix branch instead of `origin/main`, and record that head.

## `support-status.json`

Schema version 1. Top level:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1`. Bump on any incompatible change. |
| `definitions` | Where the status legend lives (`gallery-support.md#status-legend`). |
| `statuses` | The allowed `status` values: `works`, `partial`, `schema-only`, `authoring-metadata`, `broken`, `gallery-only`. |
| `audits` | Per audit (`a`, `b`): measured dimensions, `heads` (7-character commits plus Node) and the source results file. |
| `notMeasured` | Dimensions without per-item results (charts, FF-22). |
| `sharedExportGaps` | Gaps that apply to every exported value. |
| `counts` | `{dimension: {status: n}}`. |
| `items` | One record per gallery value, below. |

Each item:

| Field | Type | Meaning |
| --- | --- | --- |
| `dimension` | string | Gallery dimension: `layouts`, `blocks`, `image-treatments`, `backgrounds`, `headers-footers`, `color-schemes`, `font-schemes`, `languages`, `themes`, `narratives`, `audiences`, `tones`, `socials`. |
| `subset` | string, optional | `legacy` for the gallery's inlined legacy font schemes. |
| `galleryId` | string | The gallery route slug. |
| `opfId` | string or null | The OPF id the snippet references. `null` for legacy layout slugs and for dimensions without an OPF catalog (backgrounds, image treatments, headers/footers, content blocks). |
| `inCoreCatalog` | boolean or null | Whether `opfId` is a record in the core bundled catalog at the measured head. `null` when not applicable. |
| `status` | string | One of `statuses`. |
| `measuredStatus` | string or null | For `gallery-only` layouts, the class the engines measured. |
| `withAssetsStatus` | string or null | Audit A class when the snippet's missing `asset:*` is supplied. |
| `previewOnly` | boolean or null | Audit A: the preview shows the value but the export has no native equivalent. `null` for audit B. |
| `opfValue` | object or null | Audit A: the OPF value the snippet emits for the dimension (for example the background or `slideImage`). |
| `reasons` | string[] | The audit's reasons, verbatim. Empty for `works`. |
| `audit` | `a` or `b` | Which audit measured it. |
| `measuredHeads` | object | Commits the record was measured at. |

Consumers such as pptx.gallery badges (FF-36) must key on
`dimension` + `galleryId`, read `status` (and `previewOnly` if they show a
preview-only badge), and link the definitions rather than restating them.
