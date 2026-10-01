# Export determinism

`toPptx` is meant to produce byte-identical PPTX files for the same OPF document
and the same options, whatever the host time zone, `LANG`/`LC_ALL`, wall clock
or installed fonts. This page records what is verified, what each known source of
variance does, and which ones are pinned, fixed, or documented and excluded.
It covers the Node exporter only (FF-11 evidence). It is not a claim about
other operating systems, other Node/ICU builds or the browser build.

## What `npm run test:determinism` checks

`test/determinism.mjs` starts child Node processes. Each child exports the same
authored decks (`test/determinism-fixtures.mjs`) and reports SHA-256 digests of the
PPTX, of every part inside it and of every part inside each embedded chart
workbook. The parent requires every digest to equal the baseline child's
(`TZ=UTC`, `LANG=C`, real clock).

- Decks: Latin (Turkish dotted/dotless I, sharp s, ligatures, emoji ZWJ, flags and
  Indic conjunct sequences), Japanese, Chinese, Korean, Arabic and Hebrew (right to
  left), CJK and RTL inside a Latin deck. Each has notes, header/footer with a fixed
  date and slide number, a column chart and a pie chart (embedded workbooks), a table,
  a picture, code, metric, quote and timeline slides. Eight core examples
  (`full-feature-tour`, `chart-type-sampler`, ...) and a mixed-image deck (PNG, JPEG,
  GIF and six WebP files) are exported as well, with default options and with explicit
  `timestamp`/`zipDate`/`date` options. A few packages are re-imported and the imported
  OPF is hashed.
- Grid: `TZ` in UTC, America/Los_Angeles, Asia/Kolkata (+5:30), Pacific/Chatham
  (+12:45/+13:45) by `LANG`+`LC_ALL` in C, en_US, de_DE, tr_TR, ja_JP.
- Clock: every child after the baseline replaces `Date` and `Date.now` with a different
  fixed instant (years 1980 to 2090), so a vendored `new Date()` cannot pass by
  timing luck. Any datetime in any XML part other than the authored timestamp fails the
  test, as does any ZIP header timestamp other than the authored one, at every nesting
  level.
- Hostile default locale: children also run with `tr-TR`, `de-DE`, `ar-EG` and
  `th-TH-u-nu-thai-ca-buddhist` bound as the default of every `Intl` constructor and
  `localeCompare`/`toLocale*` call. This exists because Node on Windows ignored `LANG`
  for the ICU default locale in the local run (the manifest records
  `envGridChangedIcuDefaultLocale`: `false` there; expected `true` on Linux and macOS,
  which were not run). The test asserts that the hostile mode
  really changed number formatting, the ICU default locale and collation.
- Fonts: children run under `node --permission` with reads limited to this checkout
  (plus the real location of every symlinked or junctioned dependency, and on Linux
  the running executable, which sharp's libc detection reads) and no child processes, with an empty fontconfig and
  an fs audit. The test asserts that the sandbox denied the system font directory and
  subprocess creation, and that the exporter read nothing outside the allowed
  directories or in any font directory.
- Suites: `plain` (estimated measurement; full grid), `registry` (opf-render bundled
  `base`, `office` metric and `office` visual font registries, which name chosen
  families over substitutes) and `webp` (sharp conversion; diagonal grid).
- Static inventory: the test scans `src/*.js` and the vendored PptxGenJS for
  `localeCompare`, `toLocale*`, `Intl`, `Date.now`, `new Date()`, `Math.random`,
  `process.env/platform`, Node built-ins and random ids, and fails when a count differs
  from the reviewed one. A new occurrence needs a decision recorded on this page.
- Negative controls (run by hand when the test was written): making
  `normalizeCoreProperties` a no-op, and appending `(1234.5).toLocaleString()` to
  `docProps/core.xml`, each fail the test with the differing part named.

`OPF_DETERMINISM_ARTIFACTS=<dir>` writes `manifest.json`: the baseline digest of every
case, Node/ICU/Unicode versions and a grapheme-segmentation signature. Cross-OS identity
is checked by running the test on each OS and diffing those manifests; a single run
cannot show it.

## Known variances

| Source | What it does | Disposition |
| --- | --- | --- |
| `docProps` timestamps | Vendored PptxGenJS writes `new Date().toISOString()` into `docProps/core.xml` of the PPTX and of every embedded workbook (four call sites). `normalizeCoreProperties` overwrites `created` and `modified` with `options.timestamp` when the caller supplies one, else `1980-01-01T00:00:00Z`. | Pinned. Tested with a different clock per child and a scan for any other datetime. Callers who supply `timestamp` own the value (it is written as given). |
| ZIP entry dates | Default: fixed local 1980-01-01 00:00:00 (identical in every zone). Explicit `zipDate`: UTC fields stamped after ZIP generation (opf-pptx#86). | Pinned; `test/zip-date.mjs` plus this grid. |
| Host clock outside 1980-2099 | Two transient `zipSync` calls (`src/chart-workbook.js`, `src/package-fonts.js`) use fflate's default modification time, the current time. A host clock whose local year is before 1980 or after 2099 makes fflate throw. Their output is re-zipped with fixed dates before it reaches the result, so bytes never depend on it. | Documented, excluded: it can only fail an export, never change bytes. Fixtures keep clocks inside the range. |
| `TZ` | No exporter code path reads local calendar fields except the fixed 1980 default above. | Pinned by the grid (includes +5:30 and +13:45 offsets). |
| `LANG`/`LC_ALL`/locale | `src` and the vendor have no `localeCompare`, `toLocale*` or `Intl`; no locale-sensitive number formatting reaches chart caches or workbooks (the hostile runs use Arabic-Indic and Thai digits). `toUpperCase`/`toLowerCase` and default `sort()` are locale independent in ECMAScript. Furniture dates use a hand-written UTC formatter with English names, and core rejects `date: true` without a literal or `options.date`. | Pinned by the hostile-locale runs and the static inventory. |
| Importer tie-breaks | `compareSlidePaths` (`src/index.js`) and the language-tag tie break (`src/script-fonts.js`) ran in the PPTX importer only, never in export, and used `localeCompare`, so a Turkish default locale could order tags that differ only by `I`/`i` differently. Both now compare UTF-16 code units. | Pinned. `test/determinism-fixtures.mjs` asserts the code-unit order and the grid and hostile-locale runs must reproduce it; the inventory allows no `localeCompare`. Behavior change: a tie between tags that differ only by case now resolves upper-case first (previously `id-ID` before `Id-ID` in the root locale). |
| Host fonts | The exporter imports no `fs`, `os` or `child_process`. Text is measured by the caller's `textMeasurement` or by estimation; opf-render's `prepareNodeFonts` loads only SHA-256-verified bundled font packages with `loadSystemFonts:false`. | Pinned: proven by code inspection, the static inventory, and the permission-sandbox runs. Limit: native code (sharp/libvips, which links fontconfig for text and SVG input the exporter never requests) is not visible to the fs audit. |
| Font-registry substitution | Measurement is an input. A provider that previews Aptos with Carlito changes measurement and drawing only; the PPTX names the chosen family (FF-31, `test/export-chosen-fonts.mjs`). The same pinned registry gives the same bytes. A different registry, policy or provider (or a browser canvas measurer) changes layout by design. | Pinned for the bundled registries (tested); other providers documented, excluded. |
| ICU version (`Intl.Segmenter`) | Core splits text at grapheme boundaries with `Intl.Segmenter("und", {granularity: "grapheme"})`. The explicit `und` locale makes it independent of `LANG` (proved by the hostile runs). Boundaries depend on the runtime's Unicode data: Node 24.21.0 ships ICU 78.3 / Unicode 17.0. | Pinned to Node 24.x (`engines`). Builds with a different ICU may segment new emoji or Indic conjunct sequences differently; documented, excluded. Manifests record the versions and a segmentation signature so a difference is attributable. |
| WebP conversion | The Node path converts WebP to PNG with sharp (exact version pinned in `package.json`; prebuilt libvips, libwebp, libpng, zlib-ng per platform). It is deterministic within a machine across the grid. The browser path decodes with the browser and re-encodes through canvas. | Node: pinned by version; cross-OS output is compared through the manifests, not shown here. Browser: documented, excluded. A browser export is not byte-comparable with a Node export when it contains WebP. PNG, JPEG and GIF are embedded unchanged. |
| `Math.random` | Vendored PptxGenJS uses it for ids and one chart-colour fallback. `toPptx` replaces it with a seeded generator (`options.seed`) for the duration of the call. | Pinned. Three concurrent exports in one process match sequential output (tested). The replacement is process global while an export runs, so other code using `Math.random` during an export sees it. |
| Compression | fflate deflate is pure JavaScript at a fixed level; versions are locked by `package-lock.json`. | Pinned; identical across platforms for the same version (verify with manifests). |

## Cross-OS evidence (RR-04)

Core's "Published packages matrix" workflow
([opf#243](https://github.com/OpenPresentation/opf/pull/243), evidence in core
`docs/evidence/rr-04-cross-platform-20261001`) installs the published opf-pptx 0.11.8 with core
0.11.4, opf-render 0.11.9 and opf-editor 0.10.6 from the npm registry and exports a 61-deck pairwise
matrix (274 states and 26 chart paths, WebP assets included) on ubuntu x64, windows x64 and macos
arm64 under Node 24.21.0 (ICU 78.3, tz data 2026c). All 300 PPTX, SVG and PNG digest entries are
identical on the three systems, so the WebP conversion (sharp's prebuilt libvips per platform) and
fflate output agree across them. On each OS, 17 child processes (time zones, locales, simulated
clocks, hostile default locales, a no-font `--permission` sandbox, host and decoy fonts for the
rasterizer) match the baseline. No nondeterminism was found.

## Not established here

Other Node 24.x builds and ICU versions, other CPU architectures (linux-arm64, win32-arm64, macos-x64),
musl, the browser build and native PowerPoint. The checks above are for the Node exporter.
