# RR-04: the installed FF-38 parity audit on ubuntu, windows and macos (2026-10-02)

The FF-38 parity harness (preview against exported PPTX, 850 pptx.gallery values) ran on three GitHub-hosted systems
against the packages installed from the npm registry. Result: **850 values on every system, 741 perfect, 109 near,
0 mismatch, and no difference between the systems** (same values, same class, same outcome of every check, fact, diff
and diagnostic). Internal evidence only; nothing here is shown on pptx.gallery.

- Pull request: [opf#315](https://github.com/OpenPresentation/opf/pull/315).
- Run: [Installed parity audit, run 37078965487](https://github.com/OpenPresentation/opf/actions/runs/37078965487) on
  commit `c1da7a8f` (`ubuntu-24.04`, `windows-latest`, `macos-latest`; artifacts `installed-parity-<os>` are kept 14
  days, the files below are copies). An earlier run of the same code on `afb99849`
  ([37078104253](https://github.com/OpenPresentation/opf/actions/runs/37078104253)) gave the same counts and no
  difference; it is not used because it recorded the checkout's HEAD instead of the package commits as the head of each
  source (fixed in `c1da7a8f`, and the comparison now fails on it).
- Workflow: `.github/workflows/installed-parity.yml` (pull requests that touch the workflow, the driver, the comparison,
  the snippet snapshot, the harness scripts or `release-plan.json`; `main`; weekly, Monday 05:41 UTC; on demand with an
  `overrides` input). It is not a required check and carries a path filter, so ordinary pull requests are not slowed
  and no required status can stay pending. The jobs took 65 to 115 seconds each on 2026-10-02 (a runner may queue for minutes when the shared runners are busy).
- Driver: `scripts/published-matrix/installed-parity.mjs`; comparison: `scripts/published-matrix/compare-parity.mjs`
  (unit test `compare-parity.test.mjs`, in `pnpm check:published-matrix`). The harness under
  `docs/programs/font-fidelity-everywhere/gallery-support/parity/` is unchanged: no check, tolerance or definition moved.

## What was measured

| | |
| --- | --- |
| Packages (npm registry, `--ignore-scripts`) | `@openpresentation/opf` 0.12.0 (`5e1dda7`), `opf-render` 0.12.0 (`3b300a3`), `opf-pptx` 0.12.1 (`986d22b`), `opf-editor` 0.11.1 (`f4779da`); the versions of `release-plan.json`. The npm `gitHead` of each is stamped into its `package.json` and the harness records it as that source's head. |
| opf-pptx 0.12.2 | Not on the registry when the run was made (`npm view @openpresentation/opf-pptx@0.12.2` answered 404). When it is published, `release-plan.json` or `OPF_PARITY_OVERRIDES` moves the audit to it with no code change. |
| Renderer peers | The script-font packages of `opf-render@0.12.0` `peerDependencies` (the `@expo-google-fonts/*` packs), plus `esbuild` 0.28.2 for the snippet bundler. |
| Node | 24.21.0 on all three systems (`actions/setup-node`), the same patch release as the published matrix. |
| Font host | `PARITY_FONT_HOST=gallery`: the gallery editor's bundled font host modelled in Node (`font-host.mjs`). No host font is read, so the fonts of the runner cannot enter the result. |
| Values | 850: the 14 colour schemes, 89 + 4 font schemes, 93 languages, 4 themes, 10 narratives, 14 audiences, 7 tones, 10 socials, 12 backgrounds, 30 image treatments, 20 headers and footers, 32 blocks, 485 layouts and 26 charts. |
| Value documents | `scripts/published-matrix/fixtures/gallery-snippets-c349a61.json.gz`: the output of the harness's own `gen-snippets.mjs` (the gallery's snippet builders bundled with esbuild) on `Data-Advantage/pptx-gallery` `c349a61` (origin/main of 2026-10-02), 850 documents, 0 builder errors. pptx-gallery is a private repository and the workflow token cannot read it, so the generated documents are committed instead; with `GALLERY_DIR` set the driver runs `gen-snippets.mjs` on a checkout. The snapshot reproduced the checkout's run exactly (850 of 850 results identical on the same packages). |

## Result per system

| System | Runner | values | perfect | near | mismatch |
| --- | --- | --- | --- | --- | --- |
| ubuntu | `ubuntu-24.04`, linux x64 | 850 | 741 | 109 | 0 |
| windows | `windows-latest`, win32 x64 | 850 | 741 | 109 | 0 |
| macos | `macos-latest`, darwin arm64 | 850 | 741 | 109 | 0 |

Per check, identical on all three: geometry 850 pass; text 835 pass, 15 near; fills, zOrder, slideSize, typefaces,
theme and mapping 850 pass; reimport 849 pass, 1 near; fontResolution 757 pass, 93 near. Per dimension (identical on all
three):

| dimension | n | perfect | near | mismatch |
| --- | --- | --- | --- | --- |
| color-schemes | 14 | 14 | 0 | 0 |
| font-schemes | 89 | 35 | 54 | 0 |
| font-schemes-legacy | 4 | 3 | 1 | 0 |
| languages | 93 | 66 | 27 | 0 |
| themes | 4 | 1 | 3 | 0 |
| narratives | 10 | 10 | 0 | 0 |
| audiences | 14 | 14 | 0 | 0 |
| tones | 7 | 7 | 0 | 0 |
| socials | 10 | 10 | 0 | 0 |
| backgrounds | 12 | 12 | 0 | 0 |
| image-treatments | 30 | 30 | 0 | 0 |
| headers-footers | 20 | 20 | 0 | 0 |
| blocks | 32 | 24 | 8 | 0 |
| layouts | 485 | 485 | 0 | 0 |
| charts | 26 | 10 | 16 | 0 |

The 109 near values are the known ones, not OS effects: 93 on fontResolution (families such as Segoe UI, Grandview,
Tenorite, Impact and the CJK and Indic system faces, whose preview draws the FF-31 visual-only look-alike route while
the PPTX names the selected family), 15 charts on the text check (PowerPoint lays out its own native chart labels, "chart
label wrapped/split in preview") and 1 chart on reimport (`world` re-imports as the clustered column it is written as,
with the `chart-data-adapted` diagnostic).

## Comparison

`compare-parity.mjs` compares every leaf of every result (class, checks, stats, font resolution, typefaces, diffs and
all diagnostics, 850 values) and of the run's `meta` (Node version, heads, font host, tolerances, definitions), and it
checks that the recorded heads are the registry commits of the installed packages. Nothing is allow-listed.
[comparison.json](comparison.json): 850 values, **0 differences**. After removing the clock (`meta.generatedAt`) the
three result files have the same SHA-256 (of `JSON.stringify` of the parsed file with `meta.generatedAt` set to
null; the first 16 hex digits are `298c385dbf8fcb51`). A fourth run on the Mac mini that wrote this evidence (Node 26.7.0,
the same packages and snapshot, outside CI) also gave 741 / 109 / 0 and differs from the CI results only in `meta.node`.

The 11 installed dependencies that differ by system are the platform builds of `esbuild`, `sharp`, `sharp-libvips` and
`@resvg/resvg-js` (`@esbuild/<os>`, `@img/sharp-<os>`, `@img/sharp-libvips-<os>`, `@resvg/resvg-js-<os>`; the same
versions 0.28.2, 0.35.4, 1.3.3 and 2.6.2 on each system, Windows has no libvips package); every other installed
dependency has the same version on all three systems. The renderer's
native libraries are therefore the same releases on every system.

## Findings

None: no value, class or check differs between ubuntu, windows and macos, so there is no configuration or check to name.
Nothing was relaxed to get here. The only defect found was in the new driver, not in the packages: the first run put its
work directory inside the checkout, so the harness recorded the checkout's HEAD as the head of every source (fixed, and
guarded by a check in the driver and in the comparison).

## Files

- `ubuntu-24.04/`, `windows-latest/`, `macos-latest/`: `parity-results.json.gz` (the harness's results file, gzip),
  `PARITY.md` (the harness's generated report), `installed.json` (Node, platform, packages with `gitHead`, every
  installed dependency version).
- `comparison.json`: the cross-OS comparison.

## Re-running

```bash
node scripts/published-matrix/installed-parity.mjs all        # on any system; work directory under RUNNER_TEMP or the temporary directory
OPF_PARITY_OVERRIDES=@openpresentation/opf-pptx@0.12.2 node scripts/published-matrix/installed-parity.mjs all
GALLERY_DIR=<pptx-gallery checkout> node scripts/published-matrix/installed-parity.mjs all   # snippets from a checkout, not the snapshot
node scripts/published-matrix/compare-parity.mjs <directory with one sub-directory per system>
```

To refresh the snippet snapshot after the gallery changes, run the driver once with `GALLERY_DIR`, gzip
`<work>/dimension-audit/parity/out/snippets.json` (`gzip -9 -n`) to
`scripts/published-matrix/fixtures/gallery-snippets-<gallery commit>.json.gz` and delete the old file.
