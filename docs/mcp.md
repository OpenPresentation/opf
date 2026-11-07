# OPF MCP server

`@openpresentation/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server for OPF, so an agent or editor that speaks MCP can learn the format, look things up and check a deck without shelling out and parsing text. It teaches OPF (documentation, schemas, the default catalog, example decks and the six agent skills, all as resources, with a `start_here` tool that gives a path for a goal), and it runs the checks the CLI runs (`validate_deck`, `convert`).

It also shows decks: `show_deck` opens the OPF viewer inside a client that supports MCP Apps (Claude on the web and desktop), with Preview, Source and Both, where the user can edit the deck and the edits come back to the model ([The OPF viewer](#the-opf-viewer-show_deck)).

It keeps no state, reads no file (everything it serves is bundled in the package, and tools work on the text you pass in; the one exception is the renderer's font files, which `opf-mcp` hands to the viewer), fetches nothing and has no network access. It runs two ways: locally over stdio (this page), and hosted on an edge runtime (the same server definition over Streamable HTTP; a hosted URL at `openpresentation.org/mcp` is coming). The local server is the only one that can measure layout with the real fonts, when `@openpresentation/opf-render` is installed.

## Set it up

Any MCP client that starts a local server takes a command and arguments:

```json
{
  "mcpServers": {
    "opf": { "command": "npx", "args": ["-y", "@openpresentation/mcp"] }
  }
}
```

Pin a version (`@openpresentation/mcp@0.27.0`) to make the setup repeatable. Node 22 or later is required.

| Client | How |
| --- | --- |
| Claude Code | `claude mcp add opf -- npx -y @openpresentation/mcp` (add `--scope project` to write `.mcp.json` for the team) |
| Cursor | Add the JSON above to `.cursor/mcp.json` in the project, or to `~/.cursor/mcp.json` |
| Claude Desktop | Install the extension (`opf-<version>.mcpb`, below), or add the JSON above to `claude_desktop_config.json` |
| Any other client | Run `npx -y @openpresentation/mcp` as a stdio server (installed, the binary is `opf-mcp`) |

Check it with the official inspector: `npx @modelcontextprotocol/inspector npx -y @openpresentation/mcp`.

### Claude Desktop extension (`.mcpb`)

The server also comes as an MCP Bundle, a one-file Claude Desktop extension: open `opf-<version>.mcpb` (double-click it, or drag it into Claude Desktop's Settings, Extensions) and Claude Desktop installs and starts it. It needs no Node install, no `npx` and no configuration, and it carries the renderer and its fonts, so the OPF viewer draws decks with the exact faces and validation measures layout with them.

Build it from a checkout: `pnpm --filter "@openpresentation/mcp..." run build`, then `pnpm --filter @openpresentation/mcp run build:mcpb`. It writes `packages/mcp/artifacts/opf-<version>.mcpb` (about 81 MB, every font the renderer draws with); `node scripts/build-mcpb.mjs --no-script-fonts` writes `opf-<version>-lite.mcpb` (about 33 MB) without the script faces (Japanese, Chinese, Korean, Arabic, Devanagari and the other scripts), whose text then draws with fallbacks. `--check` also unpacks the bundle and drives its server the way Claude Desktop starts it. The build packs this checkout's `@openpresentation/opf`, `gallery`, `opf-render` and `mcp`, and installs their third-party dependencies and the renderer's font packages from the npm registry, keeping only the font files the renderer's manifests name. The manifest is `packages/mcp/mcpb/manifest.json`; `test/mcpb-manifest.test.mjs` keeps its tool list in step with the server.

`opf mcp` of the CLI is a convenience: it runs this server when `@openpresentation/mcp` is installed beside the CLI or in the working directory, and otherwise prints `npx -y @openpresentation/mcp` and exits with 2. The CLI itself carries no MCP code.

## Tools

Every tool takes JSON arguments and returns structured JSON (`structuredContent`, with the same JSON as text for clients that read only text; `show_deck` and `read_font_file` answer in their own text). A failure comes back with `isError: true` and a text report `{ ok: false, code, error, ... }` (no structured content), with a stable `code` (`unknown-id`, `invalid-document`, ...) and, where it helps, a suggestion ("Did you mean two-column?"). All tools are read-only.

| Tool | Arguments | Returns |
| --- | --- | --- |
| `start_here` | `goal?` (what you are trying to do, in your own words) | `{ goal, summary, steps[], docs[], skills[], examples[], layouts[], themes[], validate }`: a short ordered path. Which documentation pages and skill to read, two or three example decks, layouts and themes from the catalog, and the validate step (`validate_deck` with `failOn: "warning"`). With no goal, the general learning path. Everything it names is a resource URI or a tool to call next. |
| `validate_deck` | `document` (a JSON object, or deck text), `format?` (`json`, `yaml`, `markdown`; default JSON), `failOn?` (`error`, `warning`, `info`; default `error`) | `{ ok, valid, schemaValid, failOn, format, counts, findings[], checks, hint? }`. The findings are the ones `opf validate` reports (rule id, severity, category, JSON Pointer `path`, message, `help`, `fixes`, and a `location` with line and column for JSON, YAML and Markdown text). `ok` is false when a finding is at or above `failOn`. It does not look for local image files (it reads none). |
| `get_schema` | `name?` (a schema such as `presentation` or `layout`, or a `$defs` name such as `Chart`), `pointer?` (a JSON Pointer into the schema, or a `$defs` name) | `{ name, pointer, id, schema, opfVersion }`, like `opf schema`. `$ref`s stay as written. A whole schema names the `@openpresentation/opf` release it came from in its `$comment`; a part is as it is. |
| `search_catalog` | `kind` (`layouts`, `themes`, `color-schemes`, `font-schemes`, `narratives`, `audiences`, `purposes`, `tones`, `chart-types`, `languages`, `social-platforms`, `examples`), `query?`, `limit?` | `{ kind, total, returned, records[] }`: short records (id, name, summary, description, tags), best match first. |
| `get_catalog_record` | `kind`, `id` | `{ kind, id, uri, record }`: the record in full, like `opf catalog <kind> <id>`. |
| `convert` | `document`, `from?`, `to` (`json`, `yaml`, `markdown`) | `{ ok, from, to, text, findings, counts }`, like `opf convert`. The deck must be valid; otherwise nothing is converted and the findings are returned. Text formats only: PDF, PPTX, PNG and SVG need the local `opf convert`. |
| `search_docs` | `query`, `limit?` | `{ total, results[] }`: ranked pages and skills, each with `uri`, `title`, the `heading` the snippet sits under, a `snippet` and a `score`. |
| `search_shapes` | `query?`, `category?` (`lines`, `rectangles`, `basic`, `blockArrows`, `equations`, `flowchart`, `starsBanners`, `callouts`, `actionButtons`), `limit?` | `{ query, total, returned, shapes[], categories[] }`: the 187 preset shapes of a shape block or an overlay shape, searched by DrawingML name (`rightArrow`) and common words (`speech bubble`, `cylinder`, `cog`; every word must match, a name ranks first; an empty query browses PowerPoint's gallery in order). Each shape has `shape` (the value to write), `category` and `categoryTitle`, `aspect` (the default frame, width over height), `adjust[]` (each adjust value's `name`, `default`, `min`, `max`, `unit` of `fraction` or `degrees`, and whether a `handle` moves it, at a square frame) and `svg`, a small drawing from the preset's own geometry. |
| `list_examples` | `category?`, `query?` | `{ total, categories, examples[] }`: slug, name, category, slide count and `uri` for each bundled example deck. |
| `show_deck` | `document` (a JSON object, or deck text), `format?`, `view?` (`preview`, `source`, `both`; default `preview`), `slide?` (from 1) | Opens the deck in the OPF viewer (`_meta.ui.resourceUri: ui://opf/deck`). `{ opened, checked, view, slide?, format, name, slides, outline[], valid, counts, findings[] }`, and as text the deck's name, slide titles and findings, so a client without MCP Apps still gets an answer. With `processDecks: false` (a hosted server that does no deck work), `{ opened, checked: false, view, format? }` only: the viewer does the checks. |
| `read_font_file` | `file` (a path from the renderer's font manifest), `offset?` | For the viewer only (`_meta.ui.visibility: ["app"]`; a host hides it from the model). `{ file, offset, total, bytes }`: at most 512 KiB of the file, base64. Offered by `opf-mcp` when `@openpresentation/opf-render` is installed beside it. |

## Resources

Resources have stable URIs. The server lists them (`resources/list`) and also offers URI templates (`resources/templates/list`) so a client can read a URI it builds itself.

| URI | What it is |
| --- | --- |
| `opf://docs/index` | Every documentation page and skill, with its URI |
| `opf://docs/whats-new` | The most recent release notes: the last five versions of the changelog of `@openpresentation/opf` (the format, the validators and the engine), newest first, as text |
| `opf://docs/<slug>` | A documentation page as Markdown: `format-card` (the whole authoring surface on one page, sized for pasting into a model's context), `how-opf-works`, `schema-reference`, `validate`, `cli`, and the other pages meant for people who use OPF. Handoff, evidence, status and release notes are not served. |
| `opf://schema/<name>` | A JSON Schema (`opf://schema/presentation`) |
| `opf://schema/<name>#<pointer or $defs name>` | Part of a schema: `opf://schema/presentation#Chart`, `opf://schema/presentation#/properties/slides`. `opf://schema/Chart` also works. |
| `opf://examples/<slug>` | A valid example deck as JSON |
| `opf://catalog/<kind>/<id>` | A record of the default catalog (`@openpresentation/gallery`): `opf://catalog/layouts/two-column` |
| `opf://skills/<name>` | A skill entrypoint (`opf-author`, `opf-layout`, `opf-presets`, `opf-edit`, `opf-export`, `opf-inspect`) |
| `opf://skills/<name>/<path>` | A reference or asset of a skill: `opf://skills/opf-author/references/content.md` |
| `ui://opf/deck` | The OPF viewer (`text/html;profile=mcp-app`): one HTML page, about 7.6 MB (2 MB compressed), that `show_deck` opens |

Skill scripts and agent manifests are not served; the server runs no code from them.

## The OPF viewer (`show_deck`)

`show_deck` is an [MCP App](https://github.com/modelcontextprotocol/ext-apps) (SEP-1865): in a client that supports MCP Apps, such as Claude on the web and desktop, the deck opens in the conversation with the openpresentation.org playground's three views.

- **Preview** shows the slides, with the slide row to page through them. **Source** shows the deck's text (JSON, YAML or OPF Markdown) in the editor's source pane, checked as you type. **Both** puts them side by side and asks the client for full screen when the conversation is too narrow. The slide itself can be edited in place too.
- **The editor's own controls**: Undo and Redo, the review pill and the Review panel (it opens in a drawer), the Design menu (theme, colours, fonts and the slide's layout, each one undoable edit) and Find and replace (Ctrl/Cmd F). Export and Present are left out: a sandboxed iframe can neither download a file nor go full screen on its own.
- **Your edits go back to the model.** A second after the last edit, the viewer sends the whole deck to the model as context (`ui/update-model-context`), so its next answer continues from your version. **Send to Claude** also starts a turn now (`ui/message`). When the model changes the deck, it calls `show_deck` again and a new viewer opens; the earlier one stays as it was.
- **The checks run in the viewer.** It runs core's validators on every change, with text measured by the fonts the slides draw with, shows the result as a pill (`No problems`, `2 warnings`), and sends the findings to the model with the deck.
- **It follows the client's look.** The viewer's own controls take the client's light or dark theme and its colours and fonts; the slides keep the deck's theme.

**Everything runs on the user's machine.** The page bundles `@openpresentation/opf-editor`, `@openpresentation/opf-render` and core's precompiled validators, so the editing, rendering and checking happen in the client, not on the server. The client runs it in a sandboxed iframe with no network, no `eval` and no WebAssembly (the restrictive default CSP of SEP-1865, since the viewer declares no domains), so the page loads nothing: its script, styles and the startup font (Roboto Regular) are inline. Any other face a deck draws comes from the server through the client: the viewer calls the app-only tool `read_font_file`, which serves the installed renderer's files in pieces of 512 KiB, and the renderer checks each file against its pinned SHA-256 before it registers it as bytes (`FontFace` from an `ArrayBuffer`, which needs no `font-src`). Without the renderer beside the server, or on a server that offers no `read_font_file`, the viewer draws those faces with Roboto and names the substitution. Images in a deck draw when they are data URIs; the sandbox blocks a remote image.

**In a client without MCP Apps** (Claude Code, the API), `show_deck` returns the deck's name, slide titles and findings as text, like a short `validate_deck`.

Try it locally: run the server in Claude Desktop (the setup above) and ask Claude for a deck. To see the viewer outside a client, `node packages/mcp/test/deck-app-browser.mjs` (after `pnpm --filter @openpresentation/mcp build`) runs it in Chromium behind a stand-in host that frames it the way a client does; with `OPF_DECK_APP_SCREENSHOTS=<directory>` it saves a screenshot of each view. ext-apps' `basic-host` example is a reference host for a server over HTTP.

## Prompts

| Prompt | Arguments | Use |
| --- | --- | --- |
| `learn_opf` | none | Orient an agent that has not used OPF; includes the format card |
| `author_deck` | `brief`, `audience?`, `slides?` | Write a deck from a brief, then validate and fix it; includes the format card and the `opf-author` skill |
| `fix_validation_findings` | `document`, `format?` | Repair a deck that does not validate with the smallest change; includes the `opf-inspect` skill |
| `choose_layout` | `content`, `intent?` | Pick a layout from the content a slide carries; includes the `opf-layout` skill |

## A typical session

1. The agent calls `start_here { goal: "a board update with a revenue chart" }` (or reads `opf://docs/format-card`, or runs the `learn_opf` prompt).
2. It reads what the path names, finds layouts with `search_catalog { kind: "layouts", query: "two columns" }` and reads one with `get_catalog_record`.
3. It writes the deck and calls `validate_deck` with `failOn: "warning"`; each finding names a rule, a JSON Pointer and a hint. It fixes the findings and repeats until `ok` is true. A field it is unsure of comes from `get_schema { name: "Chart" }`.
4. It shows the deck with `show_deck`: in a client with MCP Apps the user sees the slides, can edit them, and the edits come back to the agent. Or it uses `convert` to hand the deck over as YAML or Markdown. PDF and PPTX export are outside this server: the local `opf convert deck.opf.json deck.pdf` (or `.pptx`) does them.

Validation checks the file. It does not render the deck, so it is not proof of how the deck looks.

## Host it

The package is a library as well as a command. Its entries:

| Entry | What it is |
| --- | --- |
| `@openpresentation/mcp` | `createOpfServer(options)`: the server with the bundled docs, examples, skills and release notes. Edge-safe. |
| `@openpresentation/mcp/server` | `createOpfMcpServer(options)`: the same server with no bundled data; you pass `sources`. Edge-safe, and small. |
| `@openpresentation/mcp/stdio` | `runStdio()`: the Node stdio wrapper that `opf-mcp` and `opf mcp` run. Uses Node. |
| `opf-mcp` (bin) | The stdio server; `npx -y @openpresentation/mcp` runs it. |

The two library entries import no Node builtin and read no file; documentation, examples, skills and release notes are bundled data; validation uses the precompiled validators (`@openpresentation/opf/precompiled`), so they run where code generation from strings is refused, such as Cloudflare Workers (the tests bundle them the way Wrangler does and run them in workerd):

```ts
import { createOpfServer } from "@openpresentation/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const server = createOpfServer({ version: "0.27.0" });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
```

`createOpfServer({ version, opfVersion?, sources?, checkText?, deckApp?, processDecks? })` returns an SDK `McpServer`. `sources` replaces any of the bundled `docs`, `examples`, `skills` and `whatsNew`. `checkText` replaces the check behind `validate_deck`; `opf-mcp` passes the one that measures layout with the fonts `opf convert` draws with. Without it, layout is estimated and the report's `hint` says so.

The bundled data is most of the size of a Worker bundle (about 12 MB minified, 5.6 MB gzipped, of which the example decks are 7 MB and the documentation 1.4 MB). A host that must stay small imports `createOpfMcpServer` from `@openpresentation/mcp/server`, which bundles none of it (about 3.5 MB minified, 0.7 MB gzipped), and takes `sources: { docs, examples, skills, whatsNew? }` from wherever it keeps them (KV, R2, static assets): `docs` is `[{ slug, title, markdown }]`, `examples` is `[{ slug, category, file, deck }]`, `skills` maps a skill name to `{ "SKILL.md": text, ... }`. `defaultSources()` and `DOC_SLUGS` (the pages served) are exported from `@openpresentation/mcp`.

**A hosted server that does no deck work.** A tool call always runs on the server the client calls, so a hosted server runs every call on your compute. Pass `processDecks: false` and it does no OPF processing of decks: `show_deck` only opens the viewer, which reads, checks and renders the deck on the user's machine and sends its findings to the model as context; `validate_deck`, `convert` and the `fix_validation_findings` prompt are left out, and `start_here` and the other prompts point to `show_deck`. What stays on the server is the lookups (docs, schemas, catalog, examples), which are small and the same for every caller, and handing over the viewer's HTML. A client without MCP Apps gets no check from such a server. `deckApp: { readFontFile }` gives the viewer font files (the local server reads the installed renderer's); `deckApp: false` leaves the viewer out. The lean `createOpfMcpServer` takes `deckApp: { html }` with `DECK_APP_HTML` from `@openpresentation/mcp`, or a function that returns the same page from storage; the function runs only when a client opens the viewer, so other requests never load the 7.6 MB page.

**Fonts for a hosted viewer.** A site that already serves the OPF preview fonts (the layout the OpenPresentation site's `prepare-opf-fonts.mjs` writes: `/opf-fonts/manifest.json`, `base/`, `lazy/fonts/` and `scripts/`) passes `readFontFile: siteFontFiles({ fetch })`, exported by both library entries. `fetch` reads a file by its path on the site; in a Worker it is the static-assets binding, so the fonts cost no storage of their own and no request leaves the Worker:

```ts
import { createOpfMcpServer, siteFontFiles } from "@openpresentation/mcp/server";

const server = createOpfMcpServer({
  version, sources,
  deckApp: { html: () => loadDeckAppHtml(), readFontFile: siteFontFiles({ fetch: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))) }) },
});
```

It reads only font files under the font folders and the faces the site's manifest names, and the renderer in the viewer checks each file against its pinned SHA-256. `OPF_SITE_FONTS_ORIGIN=https://www.openpresentation.org node --test packages/mcp/test/site-fonts.test.mjs` checks a deployed site serves every face the viewer can ask for (Node needs `NODE_USE_ENV_PROXY=1` behind a proxy).

## Limits

- The viewer is about 7.6 MB of HTML (2 MB compressed), loaded once per conversation or cached by the client. A client may cap the size of an MCP App or ask the user before it shows one.
- The viewer has no export yet (a sandboxed iframe cannot download; SEP-1865's draft `ui/download-file` is the way once clients support it), and the model sees the deck as JSON, not as pictures of the slides.
- Text formats only for `convert`. Rendering and PowerPoint need the local `opf` command, which can write files.
- `validate_deck` reads no files, so a local image path in a deck is not looked up (the CLI warns with `cli/asset-missing`). Pass images as data URIs or assets.
- Layout is measured with real fonts only under `opf-mcp` with `@openpresentation/opf-render` installed; `checks.layout` says `measured` or `estimated`.
