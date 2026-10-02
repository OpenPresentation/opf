# RR-04: cross-platform guarantees on the published packages (2026-10-01)

Covers the font-fidelity items FF-09 (offline pairwise matrix), FF-10 (matrix in CI on ubuntu, windows and
macos through a packed TypeScript consumer) and FF-11 (export determinism independent of host fonts, OS, locale
and timezone), measured on the published core 0.11.4 train. Machine-readable numbers: [summary.json](summary.json).
Internal evidence only; nothing here is shown on pptx.gallery.

- Pull request: [opf#243](https://github.com/OpenPresentation/opf/pull/243).
- Passing run: [Published packages matrix, run 36907715092](https://github.com/OpenPresentation/opf/actions/runs/36907715092)
  (three OS jobs and the comparison job all green; artifacts `published-matrix-<os>` and
  `published-matrix-comparison` are kept 14 days, the numbers below are copied into `summary.json`).
- Workflow: `.github/workflows/published-matrix.yml`, on pull requests that touch the harness or
  `release-plan.json`, on `main`, weekly (Monday 05:23 UTC) and on demand. About 7 to 8 minutes per OS,
  three jobs in parallel plus a 15-second comparison; npm and the Playwright browser are cached.
- Harness: `scripts/published-matrix/` (`prepare-consumer.mjs`, `consumer/`, `determinism.mjs`,
  `determinism-preload.mjs`, `browser-check.mjs`, `compare.mjs`, `digests.mjs` and its tests,
  `allowlist.json`) and `scripts/test-font-switch-ecosystem.mjs`.

## What runs

The packages under test are exactly the published ones, from `release-plan.json`: core 0.11.4, opf-render
0.11.9, opf-pptx 0.11.8, opf-editor 0.10.6. They are installed from the npm registry into a standalone
TypeScript consumer (`npm ci --ignore-scripts` against a committed lockfile with the registry integrity hashes;
`prepare-consumer.mjs` fails if the lockfile and `release-plan.json` disagree, and `--update-lock` regenerates
it). The renderer's script-font peer packages are installed too. Every OS installed identical bytes
(`installed.json` integrity hashes compared). Node is pinned to 24.21.0 (ICU 78.3, Unicode 17.0, tz data
2026c on all three), so runtime ICU differences cannot enter the comparison.

1. **TypeScript consumer.** `tsc --noEmit` with TypeScript 5.9.3 and `@types/node` 24.13.6, `skipLibCheck: false`, under
   NodeNext and Bundler resolution, against the shipped declarations, with `@ts-expect-error` controls;
   then compiled and run: validate, preview, export, typeface inventory, re-import, editor switch and undo.
2. **FF-09 pairwise matrix**, the existing `scripts/test-font-switch-ecosystem.mjs` run against those
   installed packages (it takes its engines from `OPF_MATRIX_ENGINES`; `pnpm test:fonts` still uses the sibling
   sources). A seeded greedy covering array over the 14 gallery dimensions (font schemes, themes, languages,
   layouts, content blocks, charts, headers and footers, color schemes, backgrounds, image treatments,
   narratives, audiences, tones, socials; the list is the one in [font-flow-map.md](../../programs/font-fidelity-everywhere/font-flow-map.md))
   gives 61 decks (seed 61658) that cover every pair of value classes. Each deck is validated, previewed with the
   registry's own faces, exported, checked by the typeface inventory (exported fonts equal the chosen fonts,
   theme fonts equal the catalog record), structurally validated (every part and nested workbook), re-imported
   and re-validated, then its font scheme is switched A to B and back to A, which must reproduce A byte for
   byte. Fixed cases add 18 more switch runs: every content type with a proportional and a monospace scheme,
   block replacements, a per-slide override, scheme overrides, CJK in a Latin deck, the theme chain, the
   language chain over all 14 pairwise languages and the 9 further scripts, and (new here) lossless and lossy
   WebP images. 274 states are verified; 26 chart export paths and 37 recorded font substitutions are asserted;
   no named expected failures remain.
3. **Digests.** Every state records the PPTX SHA-256, the SVG SHA-256 (combined and per slide) and, for the
   pairwise decks, the PNG SHA-256 of the first and last slide (resvg with the registry's font files only).
   300 entries (274 states and 26 chart paths), 1,200 digest fields.
4. **FF-10 cross-OS comparison.** `compare.mjs` requires every digest to be identical on ubuntu (x64),
   windows (x64) and macos (arm64), plus the Node, ICU, Unicode and tz versions, the grapheme-segmentation
   signature, the installed integrity hashes and the consumer output. A difference passes only if
   `allowlist.json` names it with a reason; an entry that matches nothing fails.
5. **FF-11 determinism grid**, per OS (`determinism.mjs`): a bounded subset (20 pairwise decks, the language,
   theme, CJK-in-Latin and WebP chains, 26 chart paths: 121 digest entries with PNGs) re-run in 17 child
   processes, each required to equal the baseline child (`TZ=UTC`, `LANG=C`, real clock):
   - time zone by locale grid: UTC, America/Los_Angeles, Asia/Kolkata, Pacific/Chatham against en-US, de-DE,
     ja-JP and ar (8 children), each with a different simulated wall clock (`Date` and `Date.now`);
   - hostile default locale: `Intl` constructors and `toLocale*` rebound to tr-TR, de-DE, ar-EG with Arabic
     digits and th-TH with the Thai calendar (4 children), because Node on Windows ignores `LANG` for the
     ICU default locale (the grid still reports 5 distinct default locales there against 7 on Linux and macOS);
   - no host fonts: `node --permission` with reads limited to the consumer, scripts and fixtures (system font
     directories and subprocesses denied, asserted inside the child), an empty fontconfig, plus an fs audit of
     every read (2 children); none read a font directory, 611 or 612 paths audited each;
   - host fonts visible to the rasterizer: resvg with `loadSystemFonts`, and a host font directory of decoy
     faces named like bundled families (Carlito, Gelasio, Tinos, Intos; bundled faces re-labelled by patching
     the name table), which the matrix proves draw differently when they are the only faces (2 children).
   The controls are asserted to have moved the environment (4 UTC offsets, 7 distinct clocks, 4 number
   formats, 5 to 7 ICU default locales).
6. **Headless-browser preview re-render** (`browser-check.mjs`, Playwright 1.63.0, Chromium 153): self-contained
   SVG previews load in the browser; every drawn family is a loaded embedded face; Calibri, Georgia and
   Consolas draw as Carlito, Gelasio and Cousine; switching the scheme re-renders (other SVG, other families,
   other pixels) and a second render of the same state gives the same pixels. On Linux a second browser with
   host fonts reduced to one unrelated face draws with the same faces. Pixels are recorded per OS and never
   compared across OSes, as FF-10 prescribes.

## Results

| Check | ubuntu-latest (x64) | windows-latest (x64) | macos-latest (arm64) |
| --- | --- | --- | --- |
| install, `tsc` x2, consumer run | pass | pass | pass |
| matrix: 61 decks, 274 states, 26 chart paths | pass | pass | pass |
| digests.json SHA-256 | `18e49783...afc69` | identical | identical |
| determinism grid, 17 children | pass, 0 differences | pass, 0 differences | pass, 0 differences |
| browser re-render | pass (2 passes) | pass | pass |

- **Cross-OS: 300 of 300 entries identical on all three systems, 1,200 digest fields, 0 unexplained
  differences, 0 allow-listed, 0 stale allow-list entries.** The three `digests.json` files are byte-identical
  (SHA-256 `18e497830dc06ef356d91fc3a43b6070168f1a1a45156c5ff9cd3c2d6e6afc69`), and so are the three TypeScript
  consumer outputs (the digests are also identical to the run on opf-pptx 0.11.7, run 36903128645). That covers PPTX bytes, SVG and PNG, including sharp's WebP to PNG conversion on
  libvips builds for linux-x64, win32-x64 and darwin-arm64.
- **Within each OS: 0 differences** across 17 environments (time zones, locales, clocks, hostile default
  locales, no host fonts, host fonts visible, decoy host fonts).
- **Nondeterminism found: none.** No fix PR was needed in opf-pptx, opf-render or core. The earlier
  fix on this theme (explicit ZIP dates in UTC, opf-pptx#86) is covered by the same digests.
- The allow-list is empty. The comparison is a regression guard: any future difference fails the job and
  needs either a fix or a named entry with a reason.

## Findings worth keeping

- With resvg's `loadSystemFonts` on, real host fonts (Windows, macOS and ubuntu runner images) and decoy
  faces named like bundled ones change no PNG: the registry's faces are chosen first. This is an observation
  for this renderer version, not a promise for other rasterizers.
- Chromium on Linux with a fontconfig that lists no font at all rejects every embedded web font with a
  `NetworkError`. The browser check therefore uses a fontconfig with one unrelated face. Chromium pixels
  also differed between that fontconfig and the runner's default (hinting and anti-aliasing come from the host
  fontconfig), so pixels are recorded, not compared.
- A lazy `FontFace.load()` is needed before reading `document.fonts` in a self-contained SVG; the SVG
  embeds 33 faces (12.7 MB) unless the caller selects the faces it needs (`registry.selectEmbeddedFonts`).
- Node on Windows ignores `LANG` and `LC_ALL` for the ICU default locale; only the `Intl` rebinding exercises
  hostile defaults there. Linux and macOS take `LANG` (de-DE, ja-JP, ar-SA, tr-TR observed).

## Not established here

- FF-10 criteria still open: the installed FF-38 parity audit and its perfect count on each OS, and making the
  workflow a required status check (a repository setting; the workflow is path-filtered, so it does not run on every
  pull request).
- Other Node 24.x builds or ICU versions (`Intl.Segmenter` grapheme rules and `Intl.Locale.maximize` follow the
  runtime's Unicode and CLDR data; the pinned Node makes the three systems agree, other versions can differ),
  Node 22 and 26, other CPU architectures (linux-arm64, win32-arm64, macos-x64) and Alpine/musl.
- The browser export build of opf-pptx (WebP through canvas is documented as not byte-comparable with Node), the
  editor in a browser, and native PowerPoint rendering (FF-12, supervised).
- Existing jobs keep their own scope: the coordinated-source and installed-candidate jobs
  (`ecosystem-ci.yml`) cover candidate tarballs built from the same commits as the published releases, the
  packed browser interaction tests and the registry fidelity suite on Linux.
