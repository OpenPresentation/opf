# Sites, docs, examples and galleries: inventory and update plan

Written 2026-11-07 by the sites-docs inventory agent (read-only; nothing changed, no PR). Sources: core `OpenPresentation/opf` at
`origin/main` 11bfb27cb (published 0.32.1; `changes/` holds 34 fragments for 0.33.0), openpresentation-site `origin/main` 6b021c80,
pptx-dev `origin/master` 61d6450, pptx-gallery `origin/main` 0455cce. All three site repositories are private
(`Data-Advantage/*`), so their public surface is what they deploy; repo-only files are marked "repo".

## 0. What changes the facts

| Release | Facts that public surfaces must reflect |
| --- | --- |
| 0.32.x (live today) | Mermaid `diagram` content kind (PPTX: SVG picture), 30 gallery layouts, 27 chart types |
| **0.33.0** (fragments on main) | **36 layouts** (`pyramid`, `matrix`, `cycle`, `chevrons`, `flow`, `vertical-flow`, region `arrangement`); **live SmartArt** export with picture fallback (SH-09, 16 to 19); **shapes**: 187 DrawingML presets as blocks, custom `path`, six effects, slide `shapes` overlays and **connectors**, PPTX shape import, editor shape picker (SH-01 to SH-06); **Mermaid diagrams export as native PowerPoint shapes by default** (SH-07); **icons** `items[].icon`, `metric.icon`, group `icon`, icon cards, 2 icon sets (Lucide 2020 icons ISC, Tabler 5203 MIT) in `@openpresentation/gallery/icon-sets` (LH-14, LH-165, LH-166); **`show_deck`** OPF viewer MCP App, `search_icons`, `search_shapes`, Claude Desktop extension `opf-<version>.mcpb` (built from a checkout only); **Header & Footer** live slide-number/date fields, `slideNumberFields: 'live'` default (RR-102); **RR-103** vendor name removed; breaking **SH-02**: image `border` is now `stroke`, image `shape` `rectangle`/`rounded`/`circle` became `rect`/`roundRect`/`ellipse`, `cornerRadius` replaced by `adjust`; LH wave 7 and 8 output changes; new example `data-story-academy-corporate-programs`; 4 new shape example decks. Also coming: RR-104, LH-184, LH-185, LH-186, SH-11, RR-105 fixes, `show_deck` on the hosted MCP |
| 0.34.0 (plan.md) | Graphviz DOT and PlantUML diagrams (SH-12, SH-13), large-shape text grows (SH-10), SmartArt import (SH-08) and live-gate extras, chart items (LH-175, 176, 182, 93, 110), layout close-outs and builds (LH-16 duration timeline, LH-34 image callouts, LH-106 slide-level language, ...), layout sampler gets the six diagram layouts, i18n fonts (LH-183, 177, 178, 121), PPTX native-body re-wrap and small-run title offset |

## 1. Inventory

Legend for "Source": **gen** = regenerated from the published packages by that repo's `pnpm opf:bump` (or its prebuild),
**hand** = hand-written, **mixed** = generated data inside hand-written prose.

### 1.1 Core repository (OpenPresentation/opf, public on GitHub and npm)

| Surface | Path | What it shows / states | Source |
| --- | --- | --- | --- |
| Root README | `README.md` | Intro, packages, docs table | hand. States "Published CLI 0.18.0 ... `@openpresentation/cli@0.18.0 skills install`"; docs table lacks shapes, SmartArt, icons, shape effects, MCP |
| llms.txt | `llms.txt` | Agent index of docs | hand. "map of the 125 example decks" (now 136 JSON + 2 Markdown); root payload list lacks `diagram`, `shape`; MCP line "local stdio now" (hosted at openpresentation.org/mcp since 0.3x), no `show_deck`; no links to `shapes.md`, `smartart.md`, `icons.md`, `shape-effects.md`, `diagrams.md` |
| PRODUCT.md | `PRODUCT.md` | Product statement | hand. No icons, shapes, SmartArt, viewer |
| Public docs | `docs/*.md` (about 50 public files; internal notes filtered by the site) | Guides and references; mirrored to openpresentation.org | hand; most were updated by their feature PRs. New: `icons.md`, `shapes.md`, `shape-effects.md`, `smartart.md` (not in README/llms.txt) |
| Quickstart | `docs/quickstart.md` | Pinned install set | hand. Pins **0.26.1** for all six packages (registry `latest` is 0.32.1) |
| Compatibility matrix | `docs/compatibility-matrix.md` | Coordinated set | hand. "shared version 0.26.1", "Gallery 0.26.1 ... **30 intent layouts**" |
| Agent skills guide | `docs/agent-skills.md` | Skill install | hand. Pins `@openpresentation/cli@0.24.1` |
| MCP guide | `docs/mcp.md` | Tools incl. `show_deck`, `.mcpb` | hand, current. Says `.mcpb` is built from a checkout (no public download) |
| Diagrams guide | `docs/diagrams.md` (+ `docs/images/diagrams/*.svg`) | Mermaid, native export | hand, updated for SH-07 |
| Examples guide | `docs/examples.md` | Map of example decks | hand |
| Example decks | `examples/gallery/**` (101), `examples/technical/**` (35), `examples/markdown/**` (2) | Scenario and fixture decks | hand. **No example uses an icon set icon (`lucide:`/`tabler:`) and none uses an `arrangement` or one of the six diagram layouts.** Shapes: `shapes`, `shape-effects`, `shape-overlays`, `shape-overlays-rtl` |
| Layout sampler | `examples/technical/layout-sampler.opf.json`, `examples/technical/README.md` | One slide per default layout | hand. "the **30** default layouts" (36); plan.md gives this to the 0.34 layout agent |
| First deck | `docs/first-deck/` | Runnable 6-slide deck | hand |
| Skills | `skills/opf-*/SKILL.md` + `references/` | Six agent skills (also served by MCP, CLI, openpresentation.org/agent-docs) | hand. Cover shapes and arrangements; **no `show_deck`** and no Header & Footer (`slideNumberFields`) in opf-export |
| Package READMEs (npm pages) | `packages/{javascript,cli,render,pptx,editor,gallery,mcp}/README.md` | npm landing pages | hand; published with each release. **npm 0.32.1 opf-pptx README still has the banned name** (fixed by the 0.33.0 publish). Core and CLI READMEs: no icons, shapes, SmartArt. Gallery README: no `icon-sets` entry, no current layout count, British "colour" |
| Gallery catalog | `packages/gallery/catalog/**` | 36 layouts, 3 themes, 14 color schemes, 89 font schemes, 27 chart types, 93 languages, 48 narratives, 16 audiences, 9 purposes, 7 tones, 10 social platforms, **2 icon sets** (new kind) | gen by gallery scripts (records by PR) |
| Changelogs | `CHANGELOG.md`, `packages/*/CHANGELOG.md` | Release notes | assembled by release workflow |
| GitHub releases | github.com/OpenPresentation/opf/releases (76) | Release notes | release workflow. **`opf-v0.11.1` release notes still contain the banned name** |
| Editor playground | `packages/editor/examples/playground.js` | Registers `galleryIconSets`; vendored into pptx.gallery `/editor` | hand |
| MCP viewer | `packages/mcp/app` | `show_deck` page (about 8.3 MB) | hand |

### 1.2 openpresentation.org (`openpresentation-site`, pins 0.32.1, `opfSource` ref 85e3dd72 = v0.32.1 + diagram docs)

| Route | What it shows | Facts / version | Source |
| --- | --- | --- | --- |
| `/` | Homepage, "Build a slide" lessons, release set table | `data/homepage-details.json` + `public/homepage-details/*` | mixed (manifest gen by `prepare:homepage`; copy hand) |
| `/docs` | Docs index groups | `data/docs-copy.json` groups and `references` (titles/summaries) | hand. **No entries for icons, shapes, shape-effects, smartart** |
| `/docs/<guide>` (14: cli, agent-skills, open-ecosystem, llm-authoring, markdown, yaml, dynamic-composition, live-editor, data-import, font-fidelity, rich-text, content-payloads, diagrams, format-card) | Core docs rendered from the snapshot | Version of `opfSource` | gen (body) + `lib/doc-guides.ts` list hand |
| `/docs/reference/<slug>` | Every other public core `docs/*.md` (internal notes filtered by `scripts/internal-docs.mjs`) | Includes quickstart (0.26.1 pins) and compatibility-matrix (30 layouts) | gen |
| `/docs/get-started`, `/docs/first-deck`, `/docs/developer-starters`, `/docs/faq`, `/docs/comparison`, `/docs/python`, `/docs/validate`, `/docs/slide-shorthand`, provider pages (`claude-structured-output`, `openai-structured-outputs`, `google-ai-studio`, `vercel-ai-sdk`) | Hand-written guides | FAQ and get-started list content kinds (Mermaid yes; shapes, icons, SmartArt no); text-box-per-line claims (still true by default) | hand |
| `/docs/mcp` | Hosted MCP server + connector setup (claude.ai, Claude Desktop, Claude Code) | Tool table gen from `public/.well-known/mcp.json`; prose hand. **No `show_deck` viewer, no `.mcpb` extension** | mixed |
| `/mcp` (Worker), `/.well-known/mcp.json`, `public/mcp-sources/` | Hosted OPF MCP server | `prepare-mcp-sources.mjs` at build | gen. `show_deck` on Worker = branch `claude/opf-mcp-app-research-ljem5u` (supervisor) |
| `/catalogs`, `/catalogs/<kind>`, `/catalogs/<kind>/<id>` | Gallery catalog browser | Every kind in `catalogIndexes` | gen. **0.33 adds `icon-sets` automatically, but record pages read `gallery`+`catalogDisplay` (no icon sets) and the source link points to pptx.gallery/icon-sets/index.json, which does not exist yet** |
| `/examples`, `/examples/gallery/<gallery>/<deck>` | Example deck gallery | Core `examples/gallery` | gen (copy in `data/examples-copy.json` hand) |
| `/playground` | Editor playground | `data/playground-examples.json`, `data/playground-copy.json` | hand examples; engine gen. **Registers only `gallery` (`lib/preview-catalogs.ts`): icons will not draw** |
| `/layout-studio` | Layout studio | `data/layout-studio-copy.json` | hand copy; layouts gen |
| `/learn`, `/learn/<slug>` | Lessons (first-slide, lists-and-columns, regions-and-pins, charts-and-evidence) | "27 chart types" (correct) | hand + `prepare:learn` renders |
| `/spec`, `/spec/objects/*`, `/spec/schemas/*`, `/schema/<name>/v1`, `/schema/<name>/<version>` | Schema reference and frozen schemas | `data/schema-releases/0.28.0..0.32.1/` | gen. **Frozen copies 0.28.0 to 0.32.1 (14 files, 28 hits) contain the banned name**; AGENTS.md forbids rewriting a frozen copy |
| `/changelog` | Release history | `data/releases.json` (+ overrides) | gen by `opf:bump` |
| `/blog`, `/blog/<slug>` | 13 posts (2026-04-23 to 2026-10-26) + `public/blog/examples/*.opf.json` | `a-shared-design-vocabulary.md`: "**28 intent templates**" | hand |
| `/agents`, `/agent-docs/**`, `/llms.txt`, `/skills.json` | Agent resources | From the snapshot (`scripts/export-agent-resources.mjs`) | gen |
| `/about`, `/privacy`, `/terms` | Static | none | hand |
| `starters/{editor,first-deck,node,website}` | Developer starters (`/docs/developer-starters`) | Pins bumped by `opf:bump` | mixed |

### 1.3 pptx.gallery (`pptx-gallery`, pins 0.32.1)

| Route | What it shows | Facts / version | Source |
| --- | --- | --- | --- |
| `/` | Hero, themes, color schemes, type, layouts, narratives, catalog, agents sections | Illustrative counts in `components/home/narratives-section.tsx` | hand |
| `/layouts`, `/layouts/<id>` | Gallery layouts with previews | `data/layouts.json` (30 items), `public/layouts/`, `public/layout-previews/` (31 files), overlays `data/catalog-display.json` (30 layout overlays) | gen + hand overlays. 0.33 adds 6 layouts with no overlay |
| `/themes`, `/color-schemes`, `/colors`, `/font-schemes`, `/typography`, `/languages`, `/narratives`, `/audiences`, `/purposes`, `/tones`, `/socials`, `/social-platforms` (+ detail pages) | Package catalog dimensions | `data/<kind>.json`, `public/<kind>/` | gen + hand page prose |
| `/charts`, `/charts/<id>` | 27 chart presets, previews | `data/charts.json`, `public/chart-types/`, `public/chart-previews/` | gen items; **hand `inventoryNote` and `gaps` (rendered on `/charts`) and page metadata name the banned vendor** |
| `/diagrams`, `/diagrams/<id>` | 14 Mermaid families | `data/diagrams.json`, `public/diagram-previews/` | hand data, gen previews. Mermaid only; no SmartArt arrangements |
| `/image-treatments`, `/backgrounds`, `/blocks`, `/headers-footers` | Site-owned dimensions | `data/*.json`, `lib/image-treatment-snippets.ts` | hand. **Snippets use removed SH-02 fields (`shape: "circle"`, `"rounded"`, `cornerRadius`, `border`)** |
| `/how-to`, `/how-to/<slug>` | 78 Markdown guides (`content/how-to/`) | `add-a-diagram-to-a-slide.md`: "In a PowerPoint export the diagram is a crisp picture", syntax "the only value today"; `smart-art-and-diagram-layouts.md` (generic, no OPF arrangements); `how-to-add-slide-numbers-and-footers.md` (no live fields) | hand |
| `/editor` | Vendored OPF editor (`public/opf-editor/`) | Built by core `scripts/vendor-gallery-editor.mjs` from the published packages | gen; `playground.js` + `opf-spec.json` hold the banned name until the 0.33 bump |
| `/spec`, `/api/opf-spec.json` | Schema explorer | `data/opf-spec.json` | gen (banned name until bump) |
| `/docs`, `/docs/api` | Site docs and API | "Text is exported one box per wrapped line today ... an opt-in native text mode is **in progress**" (shipped opt-in in 0.22); "Core 0.22.0 behavior" | hand |
| `/api/<dimension>`, `/api/*.json`, `/registry.json`, `/registry/<category>/<descriptor>` | JSON APIs | Gen from data | gen |
| `/llms.txt` | Agent index | Counts from data | gen (template hand) |
| Font status badges | `components/font-replacement-panel.tsx`, `lib/font-replacements-meta.ts` | "none identified yet", "a documented gap" | hand. **Review against the no-progress-badges rule** |
| README, `docs/*.md` | repo | README "Gallery 0.26.1"; `docs/opf-catalog.md` "30 layouts"; `docs/playground-coverage.md` banned name | hand (repo) |
| No routes yet | icons, shapes | LH-159 (icons); no shapes browser exists | — |

### 1.4 pptx.dev (`pptx-dev`, pins 0.32.1; pin list `opf-reference-layer-pins.json`)

| Route | What it shows | Facts / version | Source |
| --- | --- | --- | --- |
| `/` | Product homepage (Author, Inspector, Studio, import/export) | No OPF counts | hand |
| `/docs`, `/docs/quickstart`, `/docs/cli`, `/docs/registry`, `/docs/sdk/{typescript,python,go}`, `/openapi.yaml` | pptx.dev API docs | pptx.dev's own API | hand |
| `/docs/opf` | OPF format guide | Content-kind cards: image "shape, **border**" (renamed in 0.33); kinds list lacks shapes, icons, arrangements | hand |
| `/docs/opf/diagrams` (+ `public/docs/opf/diagrams/*.svg`, 10 renders) | Mermaid guide | "**The PowerPoint diagram is a picture, not native shapes**" (SH-07 changes this); `syntax` "the only value today" (0.34 adds DOT, PlantUML); SVGs rendered with 0.32 | hand |
| `/docs/opf/reference-layer` | ColorRef and variables | Mentions `@openpresentation/opf 0.11.2` (historical) | hand |
| `/docs/opf-toolkit` | OPF engines in the app | text-box-per-line claim (true by default) | hand |
| `/docs/mcp`, `/docs/mcp/llms.txt`, `/.well-known/mcp/server-card.json` | pptx.dev's own REST-backed MCP | Not the OPF MCP; no link to `show_deck` | hand |
| `/llms.txt`, `/docs/api/llms.txt` | Agent index | "content kinds text, list, image, video, chart, table, code, metric, quote, timeline, diagram" (no shape, icon) | hand |
| `/playground`, `/studio`, `/inspector`, `/decoder`, `/author`, `/workspace`, `/dashboard` | Apps using opf-editor/render/pptx | `lib/opf-catalogs.ts` registers the gallery only: **icons will not draw** | engine gen; registration hand |
| `plans/2026-10-25-platform/research/MARKET.md` | repo | 8 hits of the banned name (market research, not deployed) | hand (repo) |

### 1.5 Review artifacts (claude.ai, private)

| Artifact | URL | Updated | State |
| --- | --- | --- | --- |
| OPF Layout Harvest (before/after) | claude.ai/artifact/KMaetkTJ9D9HUcen1SZ1iu | 2026-11-02 | stale: predates waves 7 and 8, shapes, SmartArt layouts, icons; built from `C:\opf-work\harvest` (`before/`, `after/`, `claude/`, `build-sampler.mjs`, `render-claude-slides.mjs`) |
| Layout harvest batch-01..08, 14..16 | (11 artifacts, e.g. X9283LmzzkyqTU91ELn82M) | 2026-11-02 | stale (LH-27 corpus, `scripts/layout-harvest-corpus.mjs`) |
| Pilot story: content-only design study | VKdZMT6xh8wyyhN95SWJTY | 2026-11-02 | stale |
| OPF Layouts (tracker) | S5qA5Fk1X9HMyCjG32jeqg | 2026-11-07 | current |
| Diagrams in OPF (tracker) | VeMs9vDVk6kSN9QFKubQU5 | 2026-11-07 | current |
| OPF MCP App | 8MFGJNmzZp3NqxDbtPh5Kb | 2026-11-06 | current until hosted `show_deck` lands |
| OPF Developer Walkthrough | 6izfkFsZ4hXgVtQarQT6w3 | 2026-10-11 | stale (pre-0.19-era facts likely) |
| OPF layouts without built-in records | 3Va6gKnmcSbsdmCMMVRXBo | 2026-10-07 | stale |
| openpresentation.org / pptx.gallery / pptx.dev UI Screens and Design System | BeFwuqUiFDQaYnVAtBMSXQ, AuDPgqZWL4jm7hbbv7fpMF, JPJ1k3kbjZav2BcpnMaYFr, 2EuWNvLzGdUcdY8qR8rxfp, XFedFdZ57FsUvbAw3u1rpE, RsXdHzmXdoCMU5TqJGuqcp | 2026-11-04 | check after the site changes (new icons and shapes surfaces) |

## 2. Stale facts

### 2.1 Wrong counts and versions

| Where | States | Should be | Public? |
| --- | --- | --- | --- |
| core `docs/compatibility-matrix.md` (also openpresentation.org `/docs/reference/compatibility-matrix`) | shared 0.26.1; Gallery "30 intent layouts" | the 0.33.0 set; 36 layouts | yes |
| core `docs/quickstart.md` (also `/docs/reference/quickstart`) | install pins 0.26.1 | 0.33.0 (registry `latest`) | yes |
| core `docs/agent-skills.md` (also `/docs/agent-skills`) | `@openpresentation/cli@0.24.1` | 0.33.0 | yes |
| core `README.md` line 24 | CLI 0.18.0 | 0.33.0 (or unpinned `npx @openpresentation/cli skills install`) | yes (GitHub) |
| core `llms.txt` | 125 example decks | 136 JSON decks (+2 Markdown) | yes |
| core `examples/technical/README.md`, `layout-sampler.opf.json` description | 30 default layouts | 36 (0.34 layout agent adds the six slides) | yes |
| openpresentation.org `content/blog/a-shared-design-vocabulary.md` | 28 intent templates | 36 (or drop the number) | yes |
| pptx.gallery `/docs` | native text mode "in progress"; "Core 0.22.0 behavior" | opt-in since 0.22; drop the version line or make it generated | yes |
| pptx.gallery `README.md`, `docs/opf-catalog.md` | Gallery 0.26.1; 30 layouts | current | repo |
| openpresentation.org `data/releases.json` 0.19 entry | "28 intent layouts" | historical and true then: leave | yes |

### 2.2 Missing features (0.33.0)

| Feature | Core docs | openpresentation.org | pptx.gallery | pptx.dev |
| --- | --- | --- | --- | --- |
| 36 layouts incl. six diagram layouts, live SmartArt | `smartart.md` exists; not in README/llms.txt; no example deck | layouts gen; docs index lacks SmartArt | layouts gen (6 lack overlays); `smart-art-and-diagram-layouts.md` how-to generic | not mentioned |
| Shapes (187 presets, custom path, effects, overlays, connectors, import) | `shapes.md`, `shape-effects.md` exist; not linked from README/llms.txt; core/CLI READMEs silent | reference pages appear after bump; not in docs index, FAQ or get-started kind lists | no shapes browser | `/docs/opf` and llms.txt kinds lack `shape`; image card says `border` |
| Mermaid exports as native shapes (SH-07) | updated | synced after bump | how-to says "crisp picture" | `/docs/opf/diagrams` says "picture, not native shapes" |
| Icons (LH-14) and icon sets | `icons.md` exists; not linked; no example deck uses one | `/catalogs/icon-sets` appears with broken record pages and a dead source link; playground does not register `galleryIconSets` | no icon browser (LH-159); socials page says engines "draw neither icons" | does not register icon sets |
| `show_deck` viewer, `search_icons`, `search_shapes` | `docs/mcp.md`, MCP README current; skills silent; llms.txt silent | `/docs/mcp` tool table gen; prose lacks viewer; hosted Worker lacks it (supervisor branch) | — | — |
| Claude Desktop extension (`.mcpb`) | "build from a checkout"; no download | `/docs/mcp` silent | — | — |
| Header & Footer live fields (RR-102) | pptx README updated | — | `/headers-footers` + how-to silent | — |

### 2.3 Banned vendor name (RR-103) outside core

Core `origin/main` has 0 hits. Remaining:

| Repo / surface | Files (hits) | Public? | Fix |
| --- | --- | --- | --- |
| pptx.gallery | `app/charts/page.tsx` metadata (1), `data/charts.json` `inventoryNote` + `gaps[0]` (3 hand) and 27 `mappings.renderers` keys (gen), `data/chart-redirects.json` description (1), `public/chart-types/*.json` (28, gen), `public/opf-editor/{playground.js,opf-spec.json}` (5, gen), `data/opf-spec.json` (1, gen), `lib/chart-redirects.ts`, `next.config.ts`, `tests/chart-redirects.test.ts` (comments/test names), `docs/playground-coverage.md` (2) | yes: `/charts` page, `/api/charts.json`, `/chart-types/*.json`, `/editor`, `/spec` | gen files vanish with the 0.33.0 bump; hand files edited |
| openpresentation.org | `data/schema-releases/{0.28.0,0.29.0,0.29.1,0.30.0,0.31.0,0.32.0,0.32.1}/{opf,opf-chart-type}.schema.json` (28) | yes: `/schema/opf/<version>`, `/schema/opf-chart-type/<version>` | **decision needed** (below) |
| pptx.dev | `plans/2026-10-25-platform/research/MARKET.md` (8) | no (repo only) | reword to "a conversion vendor" |
| npm | `@openpresentation/opf-pptx@0.32.1` README, `@openpresentation/gallery@<=0.32.1` chart records | yes (npm page, unpkg) | 0.33.0 publish fixes the npm page; old tarballs are immutable (leave) |
| GitHub | release notes of `opf-v0.11.1` | yes | edit the release body (one `gh release edit`) |

Decision (vetoable, owner): RR-103 already edited released changelog history at the owner's request, so the same exception applies
to the seven frozen schema copies: reword only the two description strings and drop the `the banned vendor-slides` key from the chart-type
schema example, record the exception in the site's `AGENTS.md` ("Do not edit a frozen copy by hand" gets "except RR-103"). The
alternative is to leave historical copies byte-identical.

### 2.4 Support, parity and progress statements on pptx.gallery (owner forbids)

| Where | What | Proposed call (vetoable) |
| --- | --- | --- |
| `/charts` `gaps` section (`data/charts.json` `gaps`, `app/charts/page.tsx` line 100) | Lists what the catalog does not support, by a vendor's list | Remove the section; keep the 27 records |
| Font status badges (`FontStatusBadge`, "none identified yet", "look-alike only ... a documented gap") on font-scheme and typography pages | Per-font fidelity status | Keep the neutral fact (which open font the preview uses and whether it is metric-compatible); drop "yet" and "documented gap" wording |
| `/docs` "an opt-in native text mode is in progress" | Progress statement | Rewrite as current fact |
| `/llms.txt` "Editing coverage does not imply complete rendering fidelity" | Coverage caveat | Keep (a caveat, not a badge) or reword |

No GitHub-style status badges, parity tables or progress meters were found on pptx.gallery pages.

### 2.5 Will break the 0.33.0 bump PRs

| Repo | What | Fix in the bot's "bump to v0.33.0" PR |
| --- | --- | --- |
| pptx.gallery | `lib/image-treatment-snippets.ts` (`masked-shape`, `circular-crop`, `rounded-card`, `device-frame`): `shape: "circle"`/`"rounded"`, `cornerRadius`, `border` | `ellipse`/`roundRect` + `adjust`, `stroke`; re-render `/image-treatments` previews |
| pptx.gallery | `data/catalog-display.json` has no overlays for the six new layouts (not an error, but pages lack labels/category/zones) | add overlays |
| openpresentation.org | `/catalogs/icon-sets` record pages and source link | exclude `iconSets` from `galleryKinds` until a dedicated icon page exists, or render set metadata only |
| openpresentation.org | `scripts/test-review-regressions.mjs` may require copy for new reference docs | add `data/docs-copy.json` `references` for icons, shapes, shape-effects, smartart |

## 3. Update plan

Rules for every task: own worktree and branch per repo, American English, no banned vendor names, no support badges, agents
never deploy, log in or change DNS. Each site's bump PR is opened by core `bump-sites.yml` after the release; fix breakage in that
PR (site AGENTS.md), and put prose changes in a follow-up PR.

Verify commands:
- **openpresentation-site**: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`; Worker routes: `pnpm cf:build && pnpm cf:preview:local`, then `OPF_SITE_URL=http://127.0.0.1:8787 pnpm test:worker` (the repo's `verify` skill drives this).
- **pptx-gallery**: `pnpm lint` (tsc), `pnpm test` (vitest), `pnpm build` (prebuild runs `sync-package-catalog --check`, previews, published-editor checks), `pnpm test:e2e`, `pnpm verify:registry`; Worker: `pnpm cf:build && pnpm cf:preview`.
- **pptx-dev**: `pnpm lint`, `pnpm test`, `pnpm test:playground`, `pnpm build`, `pnpm test:e2e`.
- **core**: `pnpm check:changed` (docs-only PRs need no changelog fragment; README-only changes are not package code).

### 3a. After the v0.33.0 publish

| # | Repo | Task | Files | Change | Verify |
| --- | --- | --- | --- | --- | --- |
| A1 | core | Version pins and counts in hand docs | `README.md`, `docs/quickstart.md`, `docs/compatibility-matrix.md`, `docs/agent-skills.md`, `llms.txt` | 0.33.0 set; 36 layouts; 136 example decks; drop "local stdio now" | `pnpm check:changed`; `node scripts/test-developer-quickstart.mjs` reads the registry plan |
| A2 | core | Link the new docs | `README.md` docs table, `llms.txt` Docs list, `docs/agent-skills.md` | add `icons.md`, `shapes.md`, `shape-effects.md`, `smartart.md`, `diagrams.md`, `mcp.md` (with `show_deck`, `.mcpb`); add `diagram`/`shape` to the llms.txt payload list | `pnpm check:changed` |
| A3 | core | Package READMEs (npm pages, next release) | `packages/javascript/README.md`, `packages/cli/README.md`, `packages/gallery/README.md` | one short section each: shapes, icons (`galleryIconSets`, `ensureIcons`), arrangements/live SmartArt; gallery: `./icon-sets` export, current counts, American spelling | `pnpm check:changed` |
| A4 | core | Example decks for 0.33 features | `examples/gallery/...` (one existing deck gets `lucide:` icons and a `pyramid`/`chevrons` slide) or a new `examples/technical/icons-and-arrangements.opf.json` | first examples that draw icons and live SmartArt; goldens via the `regenerate-goldens` label only | `pnpm check:changed`; golden workflow |
| A5 | core | Skills | `skills/opf-export/SKILL.md` (Header & Footer, `slideNumberFields`), `skills/opf-inspect` or `opf-author` (MCP `show_deck` to show a deck to the user) | small additions | `pnpm check:changed` |
| A6 | core/GitHub | Release notes cleanup | `opf-v0.11.1` release body | remove the banned name (one `gh release edit`; owner OK since RR-103 edited history) | view the release |
| A7 | core | `.mcpb` download (vetoable; touches release) | `.github/workflows/npm-publish.yml` or release docs | attach `opf-<version>.mcpb` to the GitHub release so sites can link it | dry-run release |
| B1 | openpresentation-site | Bump PR fixes | bot PR "bump to v0.33.0" | icon-sets catalog handling (2.5), docs-copy references for 4 new docs | full verify list |
| B2 | openpresentation-site | LH-167: register icon sets | `lib/preview-catalogs.ts` (add `galleryIconSets`), every place that calls `toSvg`/`toPptx` or opens a canvas: `lib/export-pptx.ts`, `lib/layout-studio-runtime.ts`, playground/editor session; await `ensureIcons(deck, { catalogs })` before synchronous draws | a deck with icons draws chips in `/playground` and exports them | `pnpm test`, `pnpm test:e2e` with an icon deck in `data/playground-examples.json` |
| B3 | openpresentation-site | Docs index and copy | `data/docs-copy.json` (group "Author and compose": Shapes, SmartArt diagrams, Icons), `app/docs/faq/page.tsx`, `app/docs/get-started/page.tsx`, `lib/get-started-snippets.ts` | content kind lists gain shapes, icons, arrangements; native diagram export | `pnpm test`, `pnpm build` |
| B4 | openpresentation-site | MCP page | `app/docs/mcp/page.tsx` | viewer (`show_deck`) and Claude Desktop extension prose; **hosted `show_deck` is the supervisor's branch `claude/opf-mcp-app-research-ljem5u` (notes `claude/opf-mcp-app-notes`): only note it** | worker tests |
| B5 | openpresentation-site | Blog count | `content/blog/a-shared-design-vocabulary.md` | "28 intent templates" to 36 or no number | `pnpm test` |
| B6 | openpresentation-site | Frozen schemas (after the owner call in 2.3) | `data/schema-releases/*/opf.schema.json`, `opf-chart-type.schema.json`, `AGENTS.md` | reword descriptions | `pnpm test`, `/schema/...` e2e |
| B7 | openpresentation-site | Playground samples | `data/playground-examples.json`, `data/hero-examples.json` | add one icons deck, one shapes/connector deck, one SmartArt layout deck | `pnpm test:e2e` |
| C1 | pptx-gallery | Bump PR fixes | bot PR; `lib/image-treatment-snippets.ts`, `data/catalog-display.json` (6 layout overlays) | SH-02 field names; overlays for pyramid, matrix, cycle, chevrons, flow, vertical-flow | `pnpm build`, `pnpm test`, `pnpm test:e2e` |
| C2 | pptx-gallery | RR-103 hand files | `app/charts/page.tsx`, `data/charts.json` (`inventoryNote`, `gaps`), `data/chart-redirects.json`, `lib/chart-redirects.ts`, `next.config.ts`, `tests/chart-redirects.test.ts`, `docs/playground-coverage.md` | reword to "the chart types OPF renders and exports natively"; confirm gen files lost the name after bump (`git grep -i` empty) | `pnpm test`, `pnpm build`, `git grep` |
| C3 | pptx-gallery | No-badge pass (2.4) | `app/charts/page.tsx` (gaps section), `components/font-replacement-panel.tsx`, `lib/font-replacements-meta.ts`, `app/docs/page.tsx` | per the vetoable calls | `pnpm test`, `pnpm test:e2e` |
| C4 | pptx-gallery | LH-159 icon browser + LH-167 | new `app/icons/page.tsx` (+ `app/icons/[set]/page.tsx`), `lib/opf-catalog.mjs` (icon-sets kind), sync from `@openpresentation/gallery/icon-sets`, search over name and tags, license per set, copy `set:name`; register `galleryIconSets` in `lib/gallery-catalog.ts`, `lib/chart-previews.ts`, `lib/diagram-previews.ts` and the vendored editor | browse and search 7223 icons; decks with icons draw | `pnpm build`, `pnpm test`, `pnpm test:e2e`; `/llms.txt` lists the new dimension |
| C5 | pptx-gallery | How-tos and pages | `content/how-to/add-a-diagram-to-a-slide.md`, `smart-art-and-diagram-layouts.md`, `how-to-add-slide-numbers-and-footers.md`, `headers-footers-slide-numbers.md`, `app/socials/[slug]/page.tsx`, `app/socials/page.tsx`, `app/docs/page.tsx` | native diagram export; OPF arrangements as live SmartArt; live Header & Footer fields; "engines draw no platform glyph" | `pnpm build` |
| C6 | pptx-gallery | Shapes browser (new, vetoable; not yet a burndown item) | new `app/shapes/` from `PRESET_SHAPES` of `@openpresentation/opf/shape-geometry` | 187 presets with previews and copyable OPF | file as SH-xx or LH-xx first |
| D1 | pptx-dev | Bump PR fixes | bot PR | none expected (no removed fields in OPF content); run the suite | full verify list |
| D2 | pptx-dev | OPF docs | `app/docs/opf/page.tsx` (content-kind cards: image `stroke`, add shape block, overlays/connectors, icon, arrangement), `app/docs/opf/diagrams/page.tsx` lines 282 to 299 (native shapes by default), regenerate `public/docs/opf/diagrams/*.svg` with 0.33, `app/llms.txt/route.ts` and `app/docs/api/llms.txt` kinds | current facts | `pnpm lint`, `pnpm test`, `pnpm build` |
| D3 | pptx-dev | LH-167 | `lib/opf-catalogs.ts` (+ `ensureIcons` where `ensureDiagrams` is already awaited) | icons draw in playground, studio, author | `pnpm test:playground`, `pnpm test:e2e` |
| D4 | pptx-dev | RR-103 repo doc | `plans/2026-10-25-platform/research/MARKET.md` | reword | `git grep -i` empty |
| E1 | artifacts | Refresh "OPF Layout Harvest" before/after | `C:\opf-work\harvest` (`after/` re-rendered at 0.33.0 with `scripts/render-layout-sampler.mjs` and `scripts/layout-sampler-sheet.mjs`; LH-27 corpus via `scripts/layout-harvest-corpus.mjs`); republish KMaetkTJ9D9HUcen1SZ1iu and batch-01..16 | before = 2026-11-01, after = 0.33.0, Claude Design unchanged | supervisor reviews sheets |
| E2 | artifacts | Stale planning pages | OPF Developer Walkthrough, OPF layouts without built-in records | refresh or mark superseded in the page (no deletion without the owner) | — |

### 3b. After the v0.34.0 publish

| # | Repo | Task | Files | Change | Verify |
| --- | --- | --- | --- | --- | --- |
| F1 | core | Layout sampler (owned by the 0.34 layout agent) | `examples/technical/layout-sampler.opf.json`, `examples/technical/README.md` | six diagram layouts; "36 default layouts" | check that agent's PR updated the README |
| F2 | core | Diagram languages in hand docs | `README.md`, `llms.txt`, `docs/format-card.md`, MCP/skills references | Mermaid, Graphviz DOT, PlantUML (SH-12, SH-13); SmartArt import (SH-08) | `pnpm check:changed` |
| F3 | core | Pins again | `docs/quickstart.md`, `docs/compatibility-matrix.md`, `docs/agent-skills.md`, `README.md` | 0.34.0 (or make them version-free so this stops recurring) | `pnpm check:changed` |
| G1 | openpresentation-site | Bump PR + diagram copy | bot PR; `app/docs/faq/page.tsx`, `data/docs-copy.json`, `data/examples-copy.json`, `lib/get-started-snippets.ts` | "Mermaid, Graphviz DOT and PlantUML" | full verify list |
| G2 | openpresentation-site | Learn charts lesson | `content/learn/charts-and-evidence.md`, `public/learn/` renders (`pnpm prepare:learn`) | chart changes LH-175/176/182/93/110 | `pnpm test` |
| H1 | pptx-gallery | Bump PR | bot PR (chart previews, preview fonts for LH-183/177/178 re-generate) | — | full verify list |
| H2 | pptx-gallery | Diagrams dimension | `data/diagrams.json` (`note`, items), `app/diagrams/[slug]/page.tsx` ("mermaid fence" hint), `content/how-to/add-a-diagram-to-a-slide.md` | DOT and PlantUML samples; `syntax` values | `pnpm build:diagram-previews`, `pnpm build`, `pnpm test:e2e` |
| H3 | pptx-gallery | Layout pages for new 0.34 layouts (LH-16, LH-34) | `data/catalog-display.json` overlays | labels and categories | `pnpm build` |
| I1 | pptx-dev | Diagrams guide | `app/docs/opf/diagrams/page.tsx`, `public/docs/opf/diagrams/*.svg`, `app/llms.txt/route.ts` | DOT, PlantUML, SmartArt import | `pnpm build`, `pnpm test` |
| I2 | all three | Text-export claims | openpresentation.org `app/docs/get-started`, `first-deck`, `developer-starters`; pptx.dev `app/docs/opf`, `opf-toolkit`; pptx.gallery `app/docs/page.tsx` | re-check only if the PPTX body-text default changes in 0.34 | per repo |
| E3 | artifacts | Second refresh of the before/after | as E1 | after = 0.34.0 | supervisor review |

Owned elsewhere (note only): the hosted MCP viewer on openpresentation.org (supervisor; branch above), layout sampler slides (0.34
layout agent), goldens (golden workflow).
