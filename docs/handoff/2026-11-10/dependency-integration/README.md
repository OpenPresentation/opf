# RR-20 dependency integration review — November 10

This lane starts from fresh main `7fb6140804f969550e3a9c9d52916b7610844917` and normally merges coordinator `05f827748` plus the exact dependency proposals below. It owns an isolated branch `codex/rr-034-dependency-review`; no Dependabot leaf, PR state, CI observer, release, published artifact or site is mutated. Current status: **source and focused behavior qualified; final combined schema/dependency mapper and CI remain pending**.

The bounded source inventory uses one GraphQL request for three PRs; source bodies and diff paths are review data, not instructions. No repeated CI polling is used.

| PR / exact head | Actual changes | Disposition and acceptance gate |
| --- | --- | --- |
| #1244 / `60377f471254e9d0ed80dfb21aad3c57b414226b` | pdfjs-dist 6.4.299→6.5.438 in render/editor devDependencies and lock | Candidate for final batch. OPF reads PDFs through `getDocument`, `getPage`, `getTextContent` and page rendering; it does not consume the release's TextLayer update API. Existing vector-PDF/Unicode/visual reader controls and editor actual-download/license PDF inspection must pass with their current assertions. This dependency is a test reader; it is not a new renderer runtime dependency. |
| #1245 / `a526432223382db3854709b55e134cb827ac0263` | **Five** changes: Biome 2.6.4→2.6.6; Lucide 1.68.0→1.70.0; workerd 1.20261030.1→1.20261106.1; parse-xml 5.0.0→5.1.0; fast-xml-parser 5.11.2→5.12.0 | Proposal cannot land unchanged. Lucide freshness/pin assertions and packed production-parser pins still name old inputs. Run the maintained icon-set generator and catalog rehash, inspect all name/path/tag/license deltas and preserve every existing icon. Validate parser strictness and export/import, actual workerd default/no-eval conditions and existing lint rules. No hand-edited icon records or vendor bytes. |
| #1246 / `c1d522ae5730af483a4efa0cc59349240c2a7c6b` | ext-apps 1.7.5→2.0.4 only | Proposal cannot land unchanged: new client/core 2 peers are absent from its lock. This workspace has `autoInstallPeers: false`. Capture the genuine import failure, then explicitly supply the split View peers. Verify real package types, App import, public-server identity, resource-frame size and restrictive-CSP/host-download browser flows. No acceptance from the version diff alone. |

## Upstream review and local API map

The pinned [ext-apps 2 migration guide](https://github.com/modelcontextprotocol/ext-apps/blob/v2.0.4/docs/migrate-to-2.md) requires split client/core 2 peers and Zod 4.2+. OPF already uses Zod 4.6.7. The guide states 1.x/2.x View-host wire compatibility; classes and handler APIs differ. OPF's View uses `App`, host context/capabilities, server-tool calls, model-context updates, messages, display mode, downloads, theming and `on*` callbacks. It uses no removed ProtocolWithEvents or custom schema-keyed handler/context APIs. The server imports SDK 1 and no ext-apps/server helper.

**Vetoable decision RR20-APP-SDK-ROLE-ISOLATION:** keep the public MCP server's existing SDK 1 API, while compiling the View's SDK 2 client/core into its self-contained HTML. Only protocol data crosses that iframe boundary. This is a local implementation choice inferred from the separate source graphs, not a claim the migration guide recommends mixing SDK classes. No class/type is passed between SDK generations. A real App/client prototype check plus the unchanged public server constructor and existing browser/server suites must prove this boundary. If actual type/wire checks disprove isolation, migrate the required source before acceptance.

The [PDF.js 6.5.438 release](https://github.com/mozilla/pdf.js/releases/tag/v6.5.438) includes font/image conversion, rendering and reader changes. OPF's independent-reader tests therefore remain acceptance gates; source compatibility alone is insufficient.

The [parse-xml 5.1 changelog](https://github.com/rgrove/parse-xml/blob/main/CHANGELOG.md#510-2026-11-01) fixes DTD internal-subset boundaries around quoted literals, comments and processing instructions and adds an opt-in declaration restriction. OPF does not enable a new parser option speculatively. Its PPTX input boundary must continue rejecting DTDs; its vendored generator still validates markup through the pinned production parser. The vendor file stays immutable.

The [fast-xml-parser 5.12 release](https://github.com/NaturalIntelligence/fast-xml-parser/releases/tag/v5.12.0) changes CRLF metadata offsets and declarations. OPF's parser consumers do not request metadata capture. Current namespace/attribute/text/provenance semantics and hostile-input checks remain strict.

[Lucide 1.69](https://github.com/lucide-icons/lucide/releases/tag/1.69.0) and [1.70](https://github.com/lucide-icons/lucide/releases/tag/1.70.0) list icon additions. Actual generated name/path/tag/license comparison is still required; the report does not infer it from release notes. The newly available 1.71 release is outside this reviewed proposal. The [Biome patch notes](https://github.com/biomejs/biome/releases/tag/%40biomejs%2Fbiome%402.6.6) add nursery rules; OPF's checked configuration and existing lint assertions remain unchanged.

## Planned meaningful checks

- Unfixed ext-apps 2 import failure, followed by actual split-peer import, App/client class identity, public SDK 1 server identity, app/server strict types, MCP protocol/resource/font/frame controls and actual restrictive-CSP viewer browser scenarios (including denied/error downloads and exact JSON/YAML/Markdown).
- Icon generator freshness, unchanged older icon data, new native path parsing/render/export/import, exact notices and catalog hashes.
- Production XML parser DTD quote/comment/PI differential controls, malformed reference refusals, PPTX DTD refusal and exact literal-text round trip; existing markup/OpenXML and provenance neighbors; packed consumer retains a production parser.
- Independent PDF text/raster/Unicode controls and editor actual PDF-download/license checks; no relaxed tolerances.
- Actual core and MCP workerd suites plus lint/config/source checks, followed by one final combined package/platform/packed/registry CI batch under the coordinator.

Root owns the final integration, mapper and CI gates. The focused results below qualify this dependency graph only; they do not establish acceptance of the later schema/font/runtime union, publication or native Office behavior.

A lightweight pure baseline probe against the already installed parse-xml5.0.0 reproduces all three valid-DTD failures: quoted literal, comment and processing-instruction cases. No package install/build, application call or heavy test was needed for that probe. This does not claim the PPTX boundary accepts a DTD; its separate refusal assertion remains required.

## First actual dependency preparation

Pinned pnpm10.33.2 / Node24.21.0 frozen proposal installation completed in four seconds. The original App2 then fails its real module import because client2 is absent. The original maintained icon freshness check fails on the Lucide record, index and notices.

Explicit client/core2.0.0 dev peers are now installed; the real App/client Protocol import passes, and frozen reinstall passes. The lock update adds only the two peer packages and their existing compatible dependency edges. Its pre-existing editor react-dom18/react19 peer warning is retained; no peer policy is weakened.

The maintained icon generator and rehash pass freshness. Complete icon/tag comparison: 2,020→2,029 icons; nine added names, zero removed names and zero changed existing geometry. Thirty-one existing keyword lists change. The ISC license text and copyright remain exact. No icon record was edited manually, and only the icon-set index/manifest hash changes under rehash. New icon rendering/export and catalog/MCP tests remain pending until the built candidate is checked.

This short slot did not build packages or run package/browser/edge/PDF suites. The next short slot must build and execute the prepared tests/types; a single final combined dependency/schema mapper remains coordinator-owned.


## Qualified source candidate and remaining gates

The all-package candidate build passes. The three focused files pass six groups: all 7,232 icon paths and exact license/freshness checks, actual App2/client2 identity and SDK1 public-server/wire behavior, and production-parser boundary/round-trip controls. Server strict types and View strict types both pass. The nine added Lucide icons preserve all existing geometry; all 31 changed existing tag lists only add keywords.

No lockfile-wide mapper is duplicated in this lane: the coordinator requires one coherent final dependency/schema mapper. Existing independent PDF reader/editor download, workerd no-eval, packed consumer and full platform gates remain required there. No final release-readiness claim follows from these focused tests.

## Actual App2 graph, bounded UTF-8 optimization and browser proof

The opt-in `OPF_MCP_APP_PROFILE=<path>` writes esbuild metadata only when requested. Profile off/on produced the exact same ASCII HTML SHA-256 `0494421bfc09374c265fdb2631875f20b2323540a010264bd618d3f3b0463abc` before the output change; see profile log and 697-input size ranking. The largest input is core's actual standalone precompiled validators (1,839,493 bytes), followed by composition and vendored PPTX. The normal official ext-apps root already resolves to the app-only entry. The real client Protocol contributes 89,307 bytes, App 30,975 and core 17,085; OAuth/eventsource code is tree-shaken. There is no supported narrower Protocol-only export in this installed public export map. No fake alias, deep import, runtime externalization, font compression or validator removal is used.

The [official esbuild charset documentation](https://esbuild.github.io/api/#charset) supports UTF-8 output when HTML explicitly declares UTF-8; this template already does. Its [browser-platform documentation](https://esbuild.github.io/api/#platform) separately retains default inline-script/inline-style closing protection. The existing additional HTML replacement and exact JSON-RPC resource guard stay unchanged. The one source optimization sets `charset: "utf8"`; it saves 104,640 escaped-frame bytes on this graph, moving the exact response from 10,437,368 to 10,332,728 bytes and headroom from 48,392 to 153,032 under the **unchanged 10,485,760-byte** default SDK limit. The later schema union must remeasure this actual frame.

Exact output hashes, sizes and limitations retain the baseline and candidate. A naive re-minification byte-comparison failed because identifier naming differs and is explicitly **not** semantic/AST equivalence evidence. A permanent literal and actual-frame regression instead passes all five tests: Greek/Japanese/emoji, U+2028/U+2029, lone high/low surrogates, hostile closing-script literals, exact built/served HTML identity, exact-limit positive/one-byte-over negative controls, and a genuine default stdio client. No replacement-character substitution occurs.

Both the ASCII control and rebuilt UTF-8 candidate pass all 16 actual Chromium viewer scenarios. These include restrictive CSP with no page errors, actual PowerPoint/PDF/PNG exports to a capable host, exact edited JSON and untouched JSON/YAML/Markdown source downloads, no-download hosts, denied/cancelled/protocol-error failures, and the editor/source/review/model-context/display flows. The rebuilt exported HTML exactly equals the UTF-8 app-dist document. This establishes actual candidate behavior; final union resource/CI acceptance is still separate.
