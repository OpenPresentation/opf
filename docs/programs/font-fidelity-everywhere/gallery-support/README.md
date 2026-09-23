# Gallery support audit (FF-23)

The reproducible audits behind [gallery-support.md](../gallery-support.md):

- The presence audits (A and B, FF-23) are the regression check for FF-24 to
  FF-39. An item that claims to fix a gap re-runs them on its heads and links
  the changed rows.
- The parity audit (FF-38) is the program's progress scoreboard. Every fix PR
  reports its before/after count of perfect values.

| Path | Contents |
| --- | --- |
| `audit-a/` | Layouts, content blocks, image treatments, backgrounds, headers/footers. `scripts/`, `results.json`, generated `SUMMARY.md`. |
| `audit-b/` | Color schemes, font schemes, languages, themes, narratives, audiences, tones, socials. `scripts/`, `results.json`, the audit's own `README.md` and generated per-dimension tables (`*.md`). |
| `parity/` | Parity scoreboard (FF-38): `scripts/`, `run.ps1`, `build.ps1`, `parity-results.json` and the generated `PARITY.md`. |
| `support-status.json` | One record per gallery value, built from the presence and parity results. |
| `build-support-status.mjs` | Regenerates `support-status.json`. |

Results are copied byte for byte from the measured runs (heads in
[gallery-support.md](../gallery-support.md)), except for one normalized id
(below). The only script edits are local paths:

- the author's pptx-gallery path became
  `process.env.GALLERY_DIR ?? '<workspace>/pptx-gallery'`;
- in `parity/run.ps1` and `parity/build.ps1`, the toolchain and clone paths
  became `NODE_TOOLCHAIN` and `OPF_REPOS` environment variables (default
  `<workspace>`), and `build.ps1` finds `sources` relative to itself, as
  `run.ps1` does.

The exported PPTX files, `out/` intermediates (snippet bundles,
`raw-results.json`, probes, controls) and build logs are not committed.
`audit-b/README.md` still mentions them because it describes the original
run.

### Normalized ids

pptx-gallery `f17e9ae` gives the United Kingdom map chart a misspelled slug.
Core renamed that slug to `united-kingdom`, and `check-text-integrity` rejects
the old spelling, so the committed files record that chart under
`united-kingdom`. This is the only byte change to `parity/parity-results.json`.
In `support-status.json` the `parityOnly` record carries
`galleryIdNormalized`, and consumers map it back to the gallery slug. The
drift is removed by FF-22 and FF-37.

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

## Parity scoreboard (FF-38)

The parity harness uses the same workspace convention. Copy `parity/` to
`<workspace>/dimension-audit/parity/`. It expects worktrees
`<workspace>/sources/<prefix>-{opf,opf-render,opf-pptx,pptx-gallery}`, with
prefix `parity` by default; `GALLERY_DIR` overrides the gallery path. It runs
from PowerShell on Windows, or with `pwsh` elsewhere, and needs Node 24 and
pnpm on `PATH` or under `NODE_TOOLCHAIN`:

```powershell
$W = "<workspace>"
foreach ($r in 'opf','opf-render','opf-pptx','pptx-gallery') {
  git -C "<clones>\$r" fetch origin
  git -C "<clones>\$r" worktree add --detach "$W\sources\parity-$r" origin/main
}
Copy-Item -Recurse "<opf>\docs\programs\font-fidelity-everywhere\gallery-support\parity" "$W\dimension-audit\parity"
& "$W\dimension-audit\parity\build.ps1"                  # pnpm/npm install and build the worktrees
& "$W\dimension-audit\parity\run.ps1"                    # writes parity-results.json and PARITY.md
& "$W\dimension-audit\parity\run.ps1" -Only layouts,charts -Limit 20   # quick subset
$env:OPF_REPOS = "<clones>"; & "$W\dimension-audit\parity\run.ps1" -Update   # move worktrees to origin/main, rebuild, rerun
```

For a fix PR, create `sources\<prefix>-*` worktrees with the PR branch in the
repository you changed and `origin/main` elsewhere. Then run:

```powershell
& "$W\dimension-audit\parity\build.ps1" -Prefix fix123
& "$W\dimension-audit\parity\run.ps1" -Prefix fix123 -Baseline "$W\dimension-audit\parity\parity-results.json" -Out "$W\dimension-audit\parity\out\fix123.json"
```

The report then includes a before/after table; quote it in the PR. After a
merged fix, copy `parity-results.json` and `PARITY.md` back into `parity/`,
regenerate `support-status.json`, and update the headline in
[gallery-support.md](../gallery-support.md) and [burndown.md](../burndown.md).

## `support-status.json`

Schema version 1. Top level:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1`. Bump on any incompatible change. |
| `definitions` | Where the status legend lives (`gallery-support.md#status-legend`). |
| `parityDefinitions` | Where the parity checks are defined (`gallery-support.md#parity-scoreboard`). |
| `sectionAnchors` | `{dimension: anchor}` for the per-dimension sections of `gallery-support.md`; see the map below. |
| `statuses` | The allowed `status` values: `works`, `partial`, `schema-only`, `authoring-metadata`, `broken`, `gallery-only`. |
| `parityStatuses` | The allowed `parity.status` values: `perfect`, `near`, `mismatch`. |
| `audits` | Per audit (`a`, `b`, `parity`): measured dimensions or checks, `heads` (7-character commits plus Node) and the source results file. `parity` also records tolerances, the record count (900), `withAssetsRecords` (31) and `parityOnlyValues` (76). |
| `notMeasured` | Dimensions without a presence status (charts, FF-22). |
| `sharedExportGaps` | Gaps that apply to every exported value. |
| `counts` | Presence: `{dimension: {status: n}}`. |
| `parityCounts` | Parity: `{total, perfect, near, mismatch, checksPassed: {check: n}}` over all 900 parity records. |
| `items` | One record per presence-audited gallery value (793), below. |
| `parityOnly` | Values measured only by parity: the 76 charts, as `{dimension, galleryId, galleryIdNormalized?, parity}`. |

The parity audit has 107 records that are not presence items. The 76 charts
are in `parityOnly`. The 31 `withAssets` variants (backgrounds 6, image
treatments 15, headers/footers 10) are attached to their item as
`parity.variants.withAssets`.

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
| `measuredHeads` | object | Commits the presence record was measured at. |
| `parity` | object | FF-38 result for the published snippet: `status` (`perfect`, `near` or `mismatch`), `failedChecks[]`, `nearChecks[]`, and `topReasons[]` (up to five failing `check \| reason` strings, most frequent first). It has an optional `variants.withAssets` with the same shape. Heads are in `audits.parity.heads`. |

Consumers such as pptx.gallery badges (FF-36) must key on
`dimension` + `galleryId`, read `status` (and `previewOnly` if they show a
preview-only badge) and `parity.status`, and link the definitions rather than
restating them.

### Section anchors

Link a dimension to its section as
`gallery-support.md#<anchor>`. The same map is in `sectionAnchors`:

| Dimension | Anchor |
| --- | --- |
| `layouts` | `#layouts` |
| `color-schemes` | `#color-schemes` |
| `font-schemes` | `#font-schemes` |
| `languages` | `#languages` |
| `backgrounds` | `#backgrounds` |
| `narratives` | `#narratives` |
| `charts` | `#charts` |
| `themes` | `#themes` |
| `audiences` | `#audiences` |
| `tones` | `#tones` |
| `socials` | `#socials` |
| `headers-footers` | `#headers-and-footers` |
| `blocks` | `#content-blocks` |
| `image-treatments` | `#image-treatments` |

Other anchors are `#status-legend` (presence statuses),
`#parity-scoreboard` (parity checks) and `#universal-blockers`.
