# Maintained Keynote qualification (RR-86)

This is a versioned, project-authored baseline pack for the existing PPTX exporter and importer. It generates 16 OPF slides, a PPTX, SVG previews, edit actions and a sealed identity manifest. It does not change export defaults, implement native paragraph/list-body export, produce `.key` files, automate Keynote or establish native acceptance. The opt-in body prototype follows review of this baseline. Direct `.key` generation and advanced effects remain deferred.

An explicit `generate --mode measured|native` selects a separate paired **17-case** fixture for the [unmerged native-body prototype](https://github.com/OpenPresentation/opf-pptx/pull/269). Both modes use exactly the same source: K06 is a real multicolumn flat list and K17 is a supported flat-bullet body. All other original slides stay unchanged. Omitting `--mode` keeps the original 16-case source. Existing sealed suites and attempts are never rewritten.

Use Node 24 and a genuine installed consumer containing matching `@openpresentation/opf`, `opf-render`, `opf-pptx` and `gallery` packages plus the renderer's pinned font peers. The generator records actual installed versions and runtime hashes rather than assuming a release number; generate the accepted baseline again against the final coordinated registry graph. Source, installed-package, registry provenance and native claims remain separate.

```sh
node scripts/keynote-qualification/cli.mjs generate --consumer /absolute/installed-consumer --output /absolute/new-keynote-suite
node scripts/keynote-qualification/cli.mjs verify --suite /absolute/new-keynote-suite
```

The output directory must be new, outside the repository and installed consumer, under an existing canonical parent. Existing attempts are never overwritten. `suite.json` seals every generated source, archive, preview, action and static inspection file. It binds the generator revision/file hashes, installed runtime files, prepared font-file hashes and renderer manifest hash. The one prepared font handle is shared by preview and export. It neither installs native fonts nor asserts which physical face Keynote uses. The renderer verifies its bundled font/license pins normally.

The project-authored deck selects **Arial for both heading and body**, using the normal licensed **Arimo preview alias** in regular, bold, italic and bold italic styles. Native XML must retain Arial, without writing the preview alias as the selected native family. Proprietary Arial files are never bundled. Root's 2026-10-15 preflight reports four Arial style files available on the Mac and the Windows preflight verifies four styles. The reported regular-file hashes differ: macOS `525979822591a3447cfc49d943d6f7683508e25543407871c0ed8fed05fd2bd9`, Windows `b3658eadae55e682b5f69eb64c439c1ecc8f196c0bb8d4756d145d13bc86476a`. These attributed file observations do not prove identical font versions, physical per-glyph selection or native parity. Record actual native font/substitution observations in the UI results. The earlier Roboto suite is retained unchanged as dated smoke evidence and is not the canonical Arial baseline.

| Slides | Source case | Native observation or edit |
| --- | --- | --- |
| K01 | Cover/title/subtitle | Title, Body and Slide Number controls; imported layout chooser; create one native slide |
| K02–K03 | Scalar and rich paragraphs | Replace a marker, Return/new paragraph, bold/italic and object boundaries |
| K04 | List, description and nested child | Replace item, Return, indent, descriptions and list controls |
| K05–K06 | Long prose and wrapped list | Append paragraph/item, wrapping, clipping and editable-object boundaries |
| K07 | Two-column text and metric | Change layout, reapply original, preserve content and inspect geometry |
| K08–K09 | Synthetic PNG, contain and cropped cover | Replace image and use native crop/mask with caption preserved |
| K10–K11 | Native column and line charts | Change Q2 to 900 in native data editor; change line color |
| K12–K13 | Plain and rich native tables | Edit text cell and bold run; preserve table structure |
| K14–K15 | Slide-number fields | Reorder K14 after K15 and inspect actual displayed numbers |
| K16 | Notes and untouched final control | Append a notes marker and preserve the slide text |

Pictures reuse the repository's MIT synthetic quadrants/circle fixtures. `assets/replacement.png` is the replacement witness. The original retained long-text deck remains an independent review case in `test/fixtures/native-long-text/`; this pack does not replace or modify it.

## Native supervisor procedure

Only the root/supervisor operates Keynote. Each route starts from a separate fresh copy of the sealed baseline:

```sh
node scripts/keynote-qualification/cli.mjs copy --suite /absolute/new-keynote-suite --route no-op --output /absolute/new-keynote-noop
node scripts/keynote-qualification/cli.mjs copy --suite /absolute/new-keynote-suite --route content-edits --output /absolute/new-keynote-edits
node scripts/keynote-qualification/cli.mjs copy --suite /absolute/new-keynote-suite --route layout-structure --output /absolute/new-keynote-layouts
```

Open only that attempt's `editable.pptx`. Record Keynote/macOS versions, import warnings, actual font names and screenshots in its `result.json`. Follow the route actions in `attempt.json`; unavailable controls are `unsupported`, failed observations are `failed`, and unexecuted actions stay `not-run`. Use `passed` only with identified evidence. For each route, save a **new** `working.key`, export a **new** `native-export.pptx`, reopen both and retain any failure. Never save over sealed inputs, unrelated user files or an earlier attempt. Close only the test copies. Native slide-number display, crop controls, chart/table editability, text fit and actual fonts require real UI observations.

Keep four directional outcomes distinct in `result.json`: `opf-to-pptx-to-keynote`, `keynote-save-and-reopen`, `keynote-to-pptx`, and `keynote-pptx-to-opf`. A valid exported ZIP, recovered source provenance or successful import alone cannot pass a native edit action. In particular, line shapes are not proof of native paragraph or list semantics, and cached field text is not proof that slide numbers update.

Inspect the actual native-exported file without opening any app:

```sh
node scripts/keynote-qualification/cli.mjs inspect --suite /absolute/new-keynote-suite --consumer /absolute/installed-consumer --input /absolute/new-keynote-edits/native-export.pptx --route content-edits --output /absolute/new-keynote-edits-inspection
```

Repeat with the corresponding route for each output. This writes new `inspection.json`, `imported.opf.json` and import diagnostics. It validates XML, package relationship targets, native chart/table presence, slide ordering, marker text, notes and edited chart cache. It retains actual shape/placeholder/paragraph inventories and picture/crop hashes for independent review. Assertions are static and do not establish native geometry, glyph/font, baseline or pixel parity. The output always keeps `nativeAcceptance: false`; the supervisor reviews this inspection together with actual UI evidence and the directional result file.

Table markers are read from current scalar/rich cell payloads, including styled cell objects' `value`; style, cached source,
extensions and speaker notes do not supply cell words. The existing K12 action requires its marker in body row 0, column 0;
K13 requires its rich-cell marker in body row 0, column 1. Each slide must have one current table, and native XML checks the
same cell after its header row. A marker in another cell, header, title, table or slide is insufficient. These assertions
verify current words and location, not native typography or comprehensive preservation of all other cells.

For no-op comparisons, paragraph/run words remain in XML order. Literal furniture is identified by its baseline placeholder role and exact retained object name, then checked separately for identity, multiplicity and literal text; its paint order is not treated as authored word order. Dynamic field types/counts are checked independently of cached display text. Speaker notes body words remain required, while notes-page generated-field removal is a distinct topology finding. The inspector reparses the sealed input with the current semantic reader, so older sealed inventories need no rewriting. `noOpTopology` records before/after field counts, furniture roles and object paint order; it does not assert visual equivalence.

The retained project-authored Keynote 15.1.1 no-op pair in `test/fixtures/keynote-noop/` demonstrates why this matters: body/notes words remain intact, slide-number fields survive without cached text, all sixteen notes-page number fields disappear, and literal footers lose their `ftr` role. The current importer returns those literal footers as content blocks; inspection reports that real import gap separately. Native footer visibility and layering remain separate UI findings even when literal footer words compare equal. The original scratch inspection's 32 text-comparison failures are preserved unchanged.

## Literal-footer binding causal control

The maintained preparation command uses the original sealed sixteen-case baseline and its exact installed runtime. It prepares the two archive variants without calling the OPF exporter or changing a package runtime or default:

```sh
node scripts/keynote-qualification/cli.mjs footer-controls --suite /absolute/baseline16 --consumer /absolute/baseline-consumer --output /absolute/new-footer-controls
node scripts/keynote-qualification/cli.mjs footer-verify --suite /absolute/new-footer-controls
node scripts/keynote-qualification/cli.mjs footer-copy --suite /absolute/new-footer-controls --variant native-footer --output /absolute/new-A-attempt
node scripts/keynote-qualification/cli.mjs footer-copy --suite /absolute/new-footer-controls --variant ordinary-footer --output /absolute/new-B-attempt
```

A (`native-footer`) is an exact archive-byte copy of the sealed baseline. B (`ordinary-footer`) removes only the actual slide-local `<p:ph type="ftr" .../>` token from each of the sixteen exact `OPF furniture N part 0 line 0` literal footer objects. Missing/renamed/duplicate targets, extra footer bindings, live fields in the target, mismatched literal words, unexpected order or unsupported input suites refuse preparation. Exactly sixteen removals are required.

`part-differences.json` proves the token edit against every uncompressed part's size and SHA-256. All other XML and binary part bytes remain exact, including the object's current text, geometry, styles, locks, paint order, live slide-number fields, tags, relationships, layouts/master placeholders and `p:hf` flags. B is ZIP-recompressed, so its archive metadata, compressed bytes and archive hash may differ independently of the proved part edit. A is never recompressed. The control's `suite.json` seals both variants and the proof, records baseline/source/runtime identities and retains `nativeAcceptance: false`. The original seal is verified before and after preparation. Existing outputs and copies are never overwritten.

B deliberately retains even the OPF manifest's native-placeholder marker to keep this a single-variable binding test; it is not a production export option or an import-recovery implementation. Root must review preparation before opening the two fresh copies. In each copy, observe literal footer visibility and object order on K08 and the simpler K02, observe their live numbers separately, capture evidence, save a fresh `working.key`, export a fresh `native-export.pptx`, and reopen both. Compare actual UI results; a static token difference does not establish the cause of the footer's visibility change. Preserve any failure. Use the normal `inspect --suite /absolute/baseline16 --consumer /absolute/baseline-consumer --input /absolute/new-A-attempt/native-export.pptx --route no-op --output /absolute/new-A-inspection` command (and a fresh B inspection) for the actual native outputs. Imported furniture classification and notes-page number loss remain separate findings.

## Portable checks

```sh
node test/keynote-qualification.mjs
node test/keynote-noop-semantics.mjs
node test/keynote-footer-controls.mjs
node --check scripts/keynote-qualification/cli.mjs
node --check scripts/keynote-qualification/pack.mjs
```

The tests cover the action/source contract, placeholder and relationship inspection, presentation order independent of part numbering, fresh-copy protection and sealed-file tamper rejection. They use no native application, network or machine fonts. Normal test discovery includes the test automatically. Generated decks and native outputs stay outside tracked source; the fixture generator and actions are maintained here, with no transfer ZIP as a distribution requirement.

## Merged-source successor preparation

The successor is based on actual PPTX release-prep merge `e0a67c6ee9892c58d15131923156b0ecf51ab14e` (PR #276), with the fourteen reviewed RR86 commits replayed separately from the release branch. Its genuine package version is `0.20.3`; that version alone identifies neither the prototype nor a published artifact. This is a **local source candidate**, not evidence of PPTX registry publication or native acceptance.

The current `scripts/keynote-qualification/candidate-consumer.json` pins genuinely verified Core `0.20.3`, renderer `0.20.2` and Gallery `3.0.0`, all 44 exact renderer font peers, and the local `file:../openpresentation-opf-pptx-0.20.3.tgz`. After source and exact snapshot-delta review, use a new normal consumer and ordinary npm pack from the exact clean reviewed candidate commit. Pass that actual commit and tarball to the unchanged `candidate` command, then use its sealed receipt for measured/native generation. Do not substitute the base release SHA for the RR86 candidate SHA or mix the historical recipe below with these inputs.

The candidate still requires contained normal installs, one Core, exact installed runtime/vendor/manifest bytes against Git and tarball integrity against the consumer lock. Actual Body controls and explicit measured fallbacks remain required. Receipts retain `registryAcceptance: false` and `nativeAcceptance: false`. Compare defaults and complete import deltas with a separately packed **merged-source P3 control** on the same genuine dependency graph; it is not a registry-qualified P3 control while publication is pending. No previous fixture, source/native result or failed inspection is relabeled to the successor. Native execution remains separately authorized; Windows remains on human HOLD.

## Historical local prototype comparison (9f / old graph)

These commands describe the retained `9f` experiment. Use the exact historical tooling revision and recipe named by each attempt receipt; later controls require their own recorded tooling revisions, including the K17 semantic no-op guard from `62a2689` and current table-cell inspection from `e470c0a`. Do not attribute those later guarantees to the earlier `8ee257f` paired-suite tooling. The current successor recipe above has different pins and a different tarball. Historical native/fixture bytes and hashes stay unchanged.

Use a **new normal npm consumer**, with the local prototype packed from clean commit `9f159655df6aa5972a8663b94f5d73142a2c07b8`. Its package version remains `0.20.2`; that version string is not proof of prototype capability. Core `0.20.1`, renderer `0.20.0`, Gallery `3.0.0` and the renderer's exact Google font-peer versions were declared in that historical checkout's `scripts/keynote-qualification/candidate-consumer.json`. Install those packages normally from their registry versions plus the ordinary local PPTX tarball. Do not use source aliases, links, version rewrites or edited package metadata.

Under Node 24, with `run` pointing to a new external canonical directory and `runtime` pointing to the clean reviewed prototype checkout:

```sh
mkdir "$run"
npm --prefix "$runtime" --cache "$run/npm-cache" ci
# Run pack from the runtime checkout; its normal prepack build must leave Git clean.
(cd "$runtime" && npm --cache "$run/npm-cache" pack --pack-destination "$run" --json > "$run/npm-pack.json")
mkdir "$run/consumer"
cp scripts/keynote-qualification/candidate-consumer.json "$run/consumer/package.json"
(cd "$run/consumer" && npm --cache "$run/npm-cache" install --ignore-scripts --no-audit --no-fund)
node scripts/keynote-qualification/cli.mjs candidate --source "$runtime" --revision 9f159655df6aa5972a8663b94f5d73142a2c07b8 --tarball "$run/openpresentation-opf-pptx-0.20.2.tgz" --consumer "$run/consumer" --output "$run/candidate.json"
node scripts/keynote-qualification/cli.mjs generate --consumer "$run/consumer" --output "$run-measured" --mode measured --candidate "$run/candidate.json"
node scripts/keynote-qualification/cli.mjs generate --consumer "$run/consumer" --output "$run-native" --mode native --candidate "$run/candidate.json"
```

The candidate command checks a clean exact Git head, byte-compares every installed PPTX runtime/vendor file and package manifest to that commit, verifies normal installation and exact control/font pins, and matches the lockfile integrity to the tarball. It writes a fresh receipt with source revision, archive SHA-256/SHA-512, runtime files and consumer lock identity. Generation checks that receipt again. Suites embed the receipt but retain `registryAcceptance: false` and `nativeAcceptance: false`.

Native generation also fails closed unless K02, K03, K05, K07 and K17 contain exactly one actual `body` placeholder holding all source characters in the authored paragraph count, with native wrapping and no autofit. It requires measured output and path-specific `unsupported-list`/`multi-column` fallback diagnostics on K04/K06. An old public exporter silently ignoring `bodyText`, a per-line fake body, partial source text or missing fallback is refused. K17's action replaces a flat entry and inserts a new semantic item with Return; K04/K06 remain explicit unsupported-body controls. These are archive capability checks, separate from actual Keynote controls and edits.

For the explicit `body-17` / `native` suite's **no-op** inspection, K17 must also reimport as one semantic flat list containing its three current entries in the original order and words. A newline text block containing identical words, a missing/mixed/nested/numbered list, wrong entries or a cached list in provenance fails this check. A list on another slide cannot satisfy it. Measured mode, the original sixteen-case baseline and other routes do not inherit this new list guarantee. Existing word, footer and field findings remain separate; a new semantic finding never rewrites an earlier inspection.

Use `copy` separately for each route and mode. Attempt files record mode, fixture and exact suite hash. Paired content routes expect 17 slides; the new-slide route expects 18. Do not open either candidate in a native application before root reviews its identities, capability reports and preview evidence.

## Historical Windows preparation from Git (9f / old graph)

The root session owns native PowerPoint actions. The following commands only prepare local artifacts. Use Node 24 and a short, **new** path such as `C:/opf-work/rr86-body-01`; do not alter native fonts. Check out the reviewed qualification-extension branch/commit in a separate short-path repository, then run these PowerShell commands from it:

```powershell
$ErrorActionPreference = 'Stop'
$run = 'C:/opf-work/rr86-body-01'
New-Item -ItemType Directory -Path $run | Out-Null
git clone --config core.autocrlf=false https://github.com/OpenPresentation/opf-pptx.git "$run/runtime"
if ($LASTEXITCODE) { throw 'Clone failed' }
git -C "$run/runtime" checkout --detach 9f159655df6aa5972a8663b94f5d73142a2c07b8
if ($LASTEXITCODE) { throw 'Candidate checkout failed' }
Push-Location "$run/runtime"
npm --cache "$run/npm-cache" ci
if ($LASTEXITCODE) { throw 'Candidate install failed' }
npm --cache "$run/npm-cache" pack --pack-destination "$run" --json | Set-Content -Encoding utf8 "$run/npm-pack.json"
if ($LASTEXITCODE) { throw 'Pack failed' }
Pop-Location
New-Item -ItemType Directory -Path "$run/consumer" | Out-Null
Copy-Item scripts/keynote-qualification/candidate-consumer.json "$run/consumer/package.json"
Push-Location "$run/consumer"
npm --cache "$run/npm-cache" install --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE) { throw 'Consumer install failed' }
Pop-Location
node scripts/keynote-qualification/cli.mjs candidate --source "$run/runtime" --revision 9f159655df6aa5972a8663b94f5d73142a2c07b8 --tarball "$run/openpresentation-opf-pptx-0.20.2.tgz" --consumer "$run/consumer" --output "$run/candidate.json"
if ($LASTEXITCODE) { throw 'Candidate identity refused' }
node scripts/keynote-qualification/cli.mjs generate --consumer "$run/consumer" --output "$run-measured" --mode measured --candidate "$run/candidate.json"
if ($LASTEXITCODE) { throw 'Measured suite refused' }
node scripts/keynote-qualification/cli.mjs generate --consumer "$run/consumer" --output "$run-native" --mode native --candidate "$run/candidate.json"
if ($LASTEXITCODE) { throw 'Native capability refused' }
```

The runtime clone keeps tracked text as LF so the source receipt can compare package bytes with Git objects without normalization. Each OS records its own installed runtime, tarball, font and generator hashes. This recipe does not establish cross-platform byte equality, native font selection or native acceptance. Preserve failed preparation attempts and use a fresh numbered directory for a new attempt.

## Registry runtime identity (separate from source candidates)

`registry` seals an ordinary installed C0.20.3/R0.20.2/G3 consumer and its **actual registry PPTX version**. It executes the unchanged Core release verifier at independently reviewed revision `041404a0d579c7183461962022e204f7ce8a6012`, after checking its exact five-module closure. Keep a clean separate checkout of that revision; arbitrary verifier revisions or supplied success reports are refused. The command checks normal registry lock identities, one Core/Gallery and all 44 font peers, verifies all four artifacts' tags/main ancestry/SLSA/signatures, and compares installed payloads with exact registry archives **before any consumer runtime import**. Gallery uses its maintained independent release policy: no GitHub release is expected. Network execution needs a separately approved bounded run: at most 20 GitHub reads, 16 direct registry reads, four ordinary script-disabled scratch installs and four signature audits, with no retry loop. GitHub authentication preserves the maintained GH_TOKEN/GITHUB_TOKEN or normal `gh auth token` fallback; credentials and request headers are never recorded. Evidence labels GitHub responses as parsed verifier inputs and registry responses as exact bytes. npm's internal dependency traffic is additional and is not counted as those direct reads.

```sh
node scripts/keynote-qualification/cli.mjs registry --consumer /absolute/registry-consumer --verifier-source /absolute/clean-reviewed-core --verifier-revision 041404a0d579c7183461962022e204f7ce8a6012 --publisher ACTUAL_PUBLISHED_PPTX_COMMIT --output /absolute/new-registry-identity
```

Review the resulting `receipt.json` and evidence independently, then pass its accepted SHA-256 explicitly:

```sh
node scripts/keynote-qualification/cli.mjs generate --consumer /absolute/registry-consumer --mode native --registry /absolute/accepted-registry-identity --registry-sha256 INDEPENDENTLY_ACCEPTED_RECEIPT_SHA256 --output /absolute/new-registry-native-suite
```

Offline generation proves continued equality to that independently accepted receipt/evidence and actual consumer bytes; it does not freshly authenticate the registry or make a caller-authored receipt true. Keep receipt/evidence archives and the accepted digest. `--registry` and `--candidate` are mutually exclusive. Registry receipts establish only their named four-artifact identity; suites retain `nativeAcceptance: false` and no global acceptance claim. Existing actual Body/paragraph/flat-bullet and fallback checks remain mandatory: genuine published PPTX0.20.3 has no Body capability and must refuse native17 even with a valid registry receipt. Use measured17 for that package. A future RR86 registry native17 run needs its actual published artifact and publisher; it cannot relabel the existing local candidate. No historical suite or recipe is rewritten.

Offline tests use synthetic receipt/transport-result and ignored-option controls only. They do not authenticate a registry artifact or run the new route against published P3. A separately reviewed real registry run and actual published-P3 no-Body refusal remain required before reporting that qualification.
