# OPF MCP server

`@openpresentation/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server for OPF, so an agent or editor that speaks MCP can learn the format, look things up and check a deck without shelling out and parsing text. It teaches OPF (documentation, schemas, the default catalog, example decks and the six agent skills, all as resources, with a `start_here` tool that gives a path for a goal), and it runs the checks the CLI runs (`validate_deck`, `convert`).

It also shows decks: `show_deck` opens the OPF viewer inside a client that supports MCP Apps (Claude on the web and desktop), with Preview, Source and Both, where the user can edit the deck and the edits come back to the model ([The OPF viewer](#the-opf-viewer-show_deck)).

It keeps no state, reads no file (everything it serves is bundled in the package, and tools work on the text you pass in; the one exception is the renderer's font files, which `opf-mcp` hands to the viewer), fetches nothing and has no network access. It runs two ways: locally over stdio (this page), and hosted on an edge runtime (the same server definition over Streamable HTTP). The hosted connection target is `https://www.openpresentation.org/mcp`; its deployed version, tools and viewer availability follow that site’s deployment, separately from the npm package. Check the [hosted MCP guide](https://www.openpresentation.org/docs/mcp) for that deployment. The packaged `show_deck` viewer described here does not establish that a hosted deployment offers it. The local server measures layout with real fonts when `@openpresentation/opf-render` is installed.

## Set it up

**Hosted, nothing to install.** `https://openpresentation.org/mcp` is this server over Streamable HTTP: no account, no key, read-only, and it keeps nothing. In Claude (web or desktop): Settings, Connectors, Add custom connector, name it `OPF` and paste the URL; other clients take the same URL as a remote MCP server. Then ask for a deck ("make a five-slide OPF deck about our Q3 results and show it to me") and the OPF viewer opens in the conversation. A deck you pass to `validate_deck`, `convert` or `show_deck` is read in memory for that one call and not stored; the viewer itself edits, checks, draws and exports the deck on your machine. The hosted server allows 600 requests a minute per address and bodies up to 4 MB.

**Local.** Any MCP client that starts a local server takes a command and arguments:

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

When the matching [GitHub release](https://github.com/OpenPresentation/opf/releases) lists `opf-<version>.mcpb` and its SHA-256 file, download both assets from that release. Release-bundle publication is planned from 0.34.0; 0.33.0 has no published bundle asset. The trusted publish workflow builds and checks the full bundle before attaching it after registry verification. Verify it with `sha256sum --check opf-<version>.mcpb.sha256` on Linux, or compare `Get-FileHash opf-<version>.mcpb -Algorithm SHA256` to the file on Windows.

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
| `convert` | `document`, `from?`, `to` (`json`, `yaml`, `markdown`) | `{ ok, from, to, text, findings, counts }`, like `opf convert`. The deck must be valid; otherwise nothing is converted and the findings are returned. This tool converts text formats only. The viewer separately offers PowerPoint, PDF and PNG Export in a host that can save files; the local `opf convert` also writes rendered formats. |
| `search_docs` | `query`, `limit?` | `{ total, results[] }`: ranked pages and skills, each with `uri`, `title`, the `heading` the snippet sits under, a `snippet` and a `score`. |
| `search_shapes` | `query?`, `category?` (`lines`, `rectangles`, `basic`, `blockArrows`, `equations`, `flowchart`, `starsBanners`, `callouts`, `actionButtons`), `limit?` | `{ query, total, returned, shapes[], categories[] }`: the 187 preset shapes of a shape block or an overlay shape, searched by DrawingML name (`rightArrow`) and common words (`speech bubble`, `cylinder`, `cog`; every word must match, a name ranks first; an empty query browses PowerPoint's gallery in order). Each shape has `shape` (the value to write), `category` and `categoryTitle`, `aspect` (the default frame, width over height), `adjust[]` (each adjust value's `name`, `default`, `min`, `max`, `unit` of `fraction` or `degrees`, and whether a `handle` moves it, at a square frame) and `svg`, a small drawing from the preset's own geometry. |
| `list_examples` | `category?`, `query?` | `{ total, categories, examples[] }`: slug, name, category, slide count and `uri` for each bundled example deck. |
| `show_deck` | `document` (a JSON object, or deck text), `format?`, `view?` (`preview`, `source`, `both`; default `preview`), `slide?` (from 1), `session?` | Opens the deck in the OPF viewer (`_meta.ui.resourceUri: ui://opf/deck`). `{ opened, checked, view, slide?, format, name, slides, outline[], valid, counts, findings[], viewer }`, and as text the deck's name, slide titles, findings and the viewer session key, so a client without MCP Apps still gets an answer. With `processDecks: false` (a hosted server that does no deck work), `{ opened, checked: false, view, format?, viewer }` only: the viewer does the checks. A later call for the same deck (the same name) replaces the open viewer of it; `session` chooses another session. `viewer` is `{ session, createdAt, tie }` ([Instances](#instances-and-the-viewer-session)). |
| `open_editor` | `example?` (a bundled example's slug), `title?` (the deck's name: the starter deck's title, or a new name for the example), `session?`; all optional | Opens the OPF viewer's editor with a deck to edit: with `{}` a two-slide starter deck ("Untitled deck"), or the example named. `{ opened, editor: true, example, name, slides, document, examples[], viewer }`; an unknown slug still opens the starter deck and the text names the nearest slug. Title "OPF deck editor". Its `_meta` carries `ui.resourceUri` and `"openai/ui": { "entrypoints": [{ "type": "global" }] }`, the marker Claude reads to offer the app as a direct entry point ([Entry point](#the-direct-entry-point-open_editor)). |
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
| `ui://opf/deck` | The OPF viewer (`text/html;profile=mcp-app`): one HTML page (about 9.1 MB of UTF-8; `pnpm --filter @openpresentation/mcp build` prints the exact size and the JSON-RPC frame's headroom under the 10 MiB stdio limit) that `show_deck` and `open_editor` open. The `resources/read` content item carries `_meta.ui` `{ prefersBorder: false, preferredDisplayMode: "fullscreen" }`; the viewer declares no `csp`, `domain` or `permissions` (any of them would go on the same content item). |

Skill scripts and agent manifests are not served; the server runs no code from them.

## The OPF viewer (`show_deck`)

`show_deck` is an [MCP App](https://github.com/modelcontextprotocol/ext-apps) (SEP-1865): in a client that supports MCP Apps, such as Claude on the web and desktop, the deck opens in the conversation with the openpresentation.org playground's three views.

- **Preview** shows the slides, with the thumbnail strip under them. **Source** shows the deck's text (JSON, YAML or OPF Markdown) in the editor's source pane, checked as you type. **Both** puts them side by side; in a container narrower than 860px it stacks the slide over the source, and choosing it there asks the client for a larger view. The slide itself can be edited in place too. The model is told to open on Preview unless the user asked for the source.
- **The bar** (48px, one row down to a 640px container, two rows and no Both below it, and every control still in two rows at 320px): Undo and Redo, the deck's name (a little room from 640px, a row of its own below 640px; renaming opens the editor's Save and Cancel over the whole bar, or over the name's own row where the bar wraps, and Enter or Save commits one undoable edit, Escape or Cancel puts the name back, and leaving the field keeps the draft), the view switch, the editor's Design menu (theme, colors, fonts and the slide's layout, each one undoable edit), Find and replace (Ctrl/Cmd F), Export, Expand, and **Send to Claude**. Undo stops at the deck as it was opened. Present is left out (a sandboxed iframe cannot go full screen on its own), and the source pane's Copy works without the clipboard permission.
- **Export** is the editor's own menu: PowerPoint (`@openpresentation/opf-pptx`, editable), PDF (vector, selectable text), SVG and PNG slides, and the OPF source as JSON, YAML or Markdown. Every file is made in the viewer, on the user's machine, with the fonts the slides draw with, and handed to the client to save (`ui/download-file`), since a sandboxed iframe cannot download. The menu, and the source pane's Download, show only in a client that declares that capability; the agent handoff is left out, the deck being in a conversation already.
- **Your edits go back to the model.** A second after the last edit, the viewer sends the whole deck to the model as context (`ui/update-model-context`), so its next answer continues from your version; the footer says so (`Edits not shared yet`, then `Claude has your edits`). **Send to Claude** also asks for a turn (`ui/message`): it is the view's one primary button, filled while there are edits you have not sent, and it stays usable to send again. In a client that is not Claude the wording is "the assistant". Where the client offers the viewer's tools, the model changes the open deck in place ([The viewer's tools](#the-viewers-tools-editing-together)); otherwise it calls `show_deck` again and a new viewer opens, and with the session key the earlier one steps aside.
- **The checks run in the viewer.** It runs core's validators on every change, with text measured by the fonts the slides draw with, and sends the findings to the model with the deck. The status footer (28px) shows the verdict at the left, the editor's review pill (`Valid OPF`, `2 issues`), which opens the Review panel in a drawer; then the slide navigator (previous, `01 / 16`, next), the editor's status line, and the version at the right.
- **One palette, the client's.** The viewer is built to the openpresentation.org design system (the playground's bar and footer) and reads only the editor's `--opf-ui-*` tokens. In a client that sends the standard MCP Apps style variables, the neutral tokens (surfaces, text, borders) are derived from the client's background and text colors and its fonts, for the viewer's own chrome and the editor's parts alike, in the client's light or dark theme; the accent and the status colors stay OPF's, and the slides keep the deck's theme. Without those variables it uses the design system's own values.
- **It is as tall as the deck needs.** Inline, the stage takes the shape of the deck's slides (up to 480px) with 16px around the slide on every side, so a 16:9 deck in a 660px column is about 545px tall; until the deck is drawn, a slide-shaped placeholder holds its place and says what the viewer is waiting for; Source and Both have a fixed height. Full screen, and a client that fixes the height, fill the frame.

- **Saving is controlled by the host.** Source downloads preserve the current JSON, YAML or Markdown text, MIME type and suggested filename; the host controls confirmation and saving. Each outcome is worded as the host reports it ([capabilities](#what-the-viewer-does-with-each-host-capability)); "Download started." is not proof that a file was saved. Without download support the file controls stay hidden; the viewer never substitutes a direct iframe Blob/anchor download. Source text can still be selected and copied manually.

**Everything runs on the user's machine.** The page bundles `@openpresentation/opf-editor`, `@openpresentation/opf-render` and core's precompiled validators, so the editing, rendering and checking happen in the client, not on the server. The client runs it in a sandboxed iframe with no network, no `eval` and no WebAssembly (the restrictive default CSP of SEP-1865, since the viewer declares no domains), so the page loads nothing: its script, styles and the startup font (Roboto Regular) are inline. Any other face a deck draws comes from the server through the client: the viewer calls the app-only tool `read_font_file`, which serves the installed renderer's files in pieces of 512 KiB, and the renderer checks each file against its pinned SHA-256 before it registers it as bytes (`FontFace` from an `ArrayBuffer`, which needs no `font-src`). Without the renderer beside the server, or on a server that offers no `read_font_file`, the viewer draws those faces with Roboto and names the substitution. Images in a deck draw when they are data URIs; the sandbox blocks a remote image.

**In a client without MCP Apps** (Claude Code, the API), `show_deck` returns the deck's name, slide titles and findings as text, like a short `validate_deck`, and `open_editor` returns its deck and the example slugs.

### What the viewer does with each host capability

Every capability below is the host's to offer, and Claude can limit each one by connector type (several need a remote connector: a custom connector added by URL or a directory listing, not a local server), by organization and by client. Nothing here is available to every user, and none of it was verified in Claude from this repository; the stand-in host in `test/deck-app-tools-browser.mjs` and `test/deck-app-browser.mjs` behaves as Claude's MCP Apps documentation describes. The viewer keeps working without each one.

| Capability | Where the host offers it | Where it does not |
| --- | --- | --- |
| **The viewer's own tools** (`read_deck`, `select_slide`, `edit_deck`) | The model reads the open deck and changes it in place, one undoable edit per call, and the user sees it at once. Claude gets a view's tools from the user's next message after the view opened, and only for a remote connector. | The tools are never called; the model sees the user's edits as context and opens a new viewer with `show_deck` to change the deck. |
| **Model context** (`ui/update-model-context`) | A second after the last edit the whole deck goes to the model, with its revision and the viewer session key. A viewer that `open_editor` opened sends the deck it opened (the starter deck or the example, named) in its first context too. | The footer says nothing about sharing; Send still asks for a turn where messages work. |
| **Messages** (`ui/message`) | **Send to Claude** asks for a turn on the user's click. In Claude: `Sent to Claude for your approval` when Claude took it (not proof that the user approved or the model read it); in another host: `Sent to the assistant`. `Claude didn't take the message` when it was refused, `The message couldn't be confirmed` when the request failed or timed out. Send stays usable to try again. The message is one short sentence; the deck goes as context, never in the message. | No Send button. |
| **Downloads** (`ui/download-file`) | Export and the source pane's Download hand the file to the host: `Download started.`, `The download didn't finish.`, or `The download couldn't be confirmed.` (a rejection or the ten-minute timeout; the host's dialog may still save it). A host that answers "method not found" gets `This host does not offer downloads here. Select the source text to copy it.`, and Download and Export are no longer offered. One request at a time: a click while one waits sends nothing and says so. The file name is the URI's last segment as written (never percent-encoded); the viewer turns / \\ % : " * < > \| ~ # ? into `_` itself, so the name the user sees is the one it chose. The viewer makes only PowerPoint, PDF, PNG, SVG, ZIP and OPF source files, none of a type a host refuses outright. | No Export menu or Download button; the source text can be selected and copied. |
| **A larger view** (`ui/request-display-mode`, `availableDisplayModes: ["inline", "fullscreen"]`) | **Expand** asks from the click itself (Claude honors it only right after a press in the view and opens its side panel or full screen; both report `fullscreen`); the label becomes **Back to the conversation**. A refusal leaves the label as it was and says the host kept the viewer where it was. The content item's `preferredDisplayMode: "fullscreen"` asks Claude to open the side panel when the tool returns; Claude decides. | No Expand button; the viewer stays inline. |
| **Server tools from the view** (`tools/call`) | Fonts (`read_font_file`) and the editor's example picker (`get_catalog_record`). | The deck draws with Roboto in place of faces it cannot get, and the editor offers only its starter deck and Paste. |

**Layout** follows the container the host reports (`containerDimensions`: its width, and a fixed or a maximum height): the side panel and full screen are both `fullscreen` and the side panel can be resized down to about 320px. A fixed height fills the frame, and so does `fullscreen` when the host sends no dimensions with it (borderless); a maximum height keeps the inline view as tall as its slide. The host's `safeAreaInsets` pad the view, and `hostcontextchanged` lays it out again. In the narrowest container (under 400px) every control in the bar, the start row and the footer is at least 44 by 44 CSS pixels, Send has a row of its own, and the footer wraps a long message instead of cutting it short. A status message clears itself after eight seconds.

### The viewer's tools (editing together)

The viewer registers three tools before it connects, and their names, titles, descriptions and schemas never change while it runs (Claude may ask the user to approve a tool again when one does); changing values go in results. Each answers in text, which is what the model reads, and acts on its own view only: with two viewers open, a call reaches one. Inputs a model is likely to get wrong (an unknown `op`, too many operations, a negative or fractional `offset` or `index`, both or neither of `index` and `id`) come back as normal results that say how to fix them, not as validation errors.

| Tool | Arguments | What it does |
| --- | --- | --- |
| `read_deck` | `source?` (`json`, `yaml`, `markdown`), `offset?` | The open deck's `revision` (core's `documentHash`, `sha256:...`), viewer `session`, `name`, `slideCount`, `selected` `{ index, id }`, `outline[]` `{ index, id, title, layout }` (indexes from 0, as in `/slides/0`), `sourceDraft` and `checks` (counts and up to 20 findings). It is bounded whatever the deck: names, ids, titles and finding paths at most 200 characters, finding messages 300, the outline at most 30,000 characters of JSON (then `outlineTruncated: { listed, of }`). With `source`, also the deck's text, in pages that keep the result under 100,000 characters with at least 40,000 characters of text each; pages after the first leave the outline out, a page never starts or ends inside a surrogate pair, and every page carries a `textHash` of the whole text (when it changes between pages, start again at 0). The form open in the source pane comes back as the pane shows it, a draft the deck has not taken included (`draft: true`), and nothing the user is typing is applied by the read. |
| `select_slide` | `index?` (a whole number from 0) or `id?`, exactly one | Shows that slide; the deck does not change. Refused (`busy`) while the user has text open on the slide, since changing slides would commit it. |
| `edit_deck` | `expectedRevision`, `operations` (1 to 100 JSON Patch operations, as `opf edit` takes them; paths may name slides and blocks by id, `/slides/@intro/title`) | Applies the operations through the editor session's `applyPatch` with `expectHash`: all or none, as one undo step, with the source pane, the slide and the model's context following. Refused, changing nothing: a revision that is not the current one (`stale-revision`, read again); an edit while the user is typing, with text open on the slide or typing the source pane has not applied yet (`busy`: the user's edit is never committed for them; try again after their next message); a source draft that is not a valid deck (`source-draft`); an operation on the whole deck, `path` or `from` `""` (`whole-deck`); any operation but `test` whose `path` or `from` is `/slides` itself, that is adding, replacing, removing, moving or copying the whole slides array (`whole-slides`: edit slides one at a time); more than 200,000 characters of operations (`too-large`); and an edit that would make the deck invalid (`invalid-result`, with the findings). The deck in the viewer is always valid in format and references: a JSON deck that is not does not open (the tools answer `not-open`), and YAML or Markdown text that is not stays a draft in Source (`source-draft`). In the source pane, JSON keeps its formatting (only the changed values are rewritten); YAML and Markdown text is written again from the deck, so YAML comments are dropped and the pane says so. This holds for every change made outside the source pane (the Design menu, an edit on the slide, Undo), not only for `edit_deck`. Returns the new `revision`, `previousRevision`, `changed[]` (as the operations addressed them) and the checks. |

Every tool answers with `ok: false` and a `code` (`loading`, `not-open`, `superseded`, `closed`, `busy`, `source-draft`, `stale-revision`, `whole-deck`, `whole-slides`, `too-large`, `invalid-input`, `invalid-result`, ...) and a sentence that says what to do instead, rather than an error, while the deck is loading, when no deck opened (also after the tool call was cancelled), after a newer viewer of the same session replaced the view (which also makes it read-only), and after the host tore the view down.

### Instances and the viewer session

Each tool call mounts its own view, and earlier views stay live. `show_deck` and `open_editor` mint `viewer: { session, createdAt, tie }` in their result; the server keeps nothing and counts nothing. Decision (vetoable, RR111-SESSION-BY-DECK): **one editing session is one deck**: the session key is the caller's `session` when it passes one (letters, digits and `- _ . :`, up to 64), and otherwise it is derived from the deck's own identity, statelessly: OPF has no document id, so it is `deck-` and 32 hex digits of the SHA-256 of the deck's `name`, trimmed, lowercased and with runs of spaces collapsed (a deck without a name gets a random key of its own). So a model that shows a newer version of the same deck replaces the older viewer without passing anything back, a deck with another name stays independent, and `open_editor` derives the key from the starter or example deck it opens. Both tools' descriptions say so. Views of one session meet on a `BroadcastChannel` named by that key and compare the server's keys only: `createdAt` (the server's clock), then `tie` (random, minted per call), then the instance id; never a key a view made up. The older view greys out, becomes read-only, clears its sharing state and any selection, says that a newer viewer is open, and stops sending context, messages and tool edits. A view whose result carries no key, a view where the browser has no `BroadcastChannel`, and every view of another session stay independent. The channel is per conversation because the viewer declares no `ui.domain` (its origin is then the conversation's); a host that gave it a fixed domain would let two conversations with a deck of the same name meet, so that would need the session key to include something the host scopes.

### The direct entry point (`open_editor`)

Where Claude offers it (a remote custom connector or a directory listing, the newer conversation experience, an organization that allows it; not a local server), a user can open the OPF viewer's editor without asking the model: Claude lists it as "OPF deck editor" beside the connector's name and calls `open_editor` with `{}`. The starter deck can be edited at once; the start row under the bar ("A starter deck to edit.", an example picker capped at 280px, and **Paste a deck**, all on one row from 600px) opens a bundled example (through `get_catalog_record`) or pastes a deck. **Paste a deck** switches to Source, selects the whole text and focuses it, so what the user pastes replaces it; where the host lets the view read the clipboard, the deck on it goes in at once. The label goes once the user opens an example, pastes or edits. The model can call it too, with a `title` (with an `example`, the title renames the example deck, and the result says so) or an `example`.

**Not built:** embedding the pptx.dev workspace as a website inside the app. It would need explicit `frameDomains`, framing headers on pptx.dev and a listing that allows embedded sites, and it is a separate review.

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
4. It shows the deck with `show_deck`: in a client with MCP Apps the user sees the slides, can edit them, and the edits come back to the agent. Or it uses `convert` to hand the deck over as YAML or Markdown. In a host that advertises file saving, the viewer's Export menu hands PowerPoint, PDF and PNG files to the host. The local `opf convert deck.opf.json deck.pdf` (or `.pptx`) is another way to write an export.

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

The default entry bundles the viewer, example decks and public documentation. A host that must stay small imports `createOpfMcpServer` from `@openpresentation/mcp/server`, which bundles none of that data, and takes `sources: { docs, examples, skills, whatsNew? }` from wherever it keeps them (KV, R2, static assets): `docs` is `[{ slug, title, markdown }]`, `examples` is `[{ slug, category, file, deck }]`, `skills` maps a skill name to `{ "SKILL.md": text, ... }`. `defaultSources()` and `DOC_SLUGS` (the pages served) are exported from `@openpresentation/mcp`.

**A hosted server that does no deck work.** A tool call always runs on the server the client calls, so a hosted server runs every call on your compute. Pass `processDecks: false` and it does no OPF processing of decks: `show_deck` only opens the viewer, which reads, checks and renders the deck on the user's machine and sends its findings to the model as context; `validate_deck`, `convert` and the `fix_validation_findings` prompt are left out, and `start_here` and the other prompts point to `show_deck`. What stays on the server is the lookups (docs, schemas, catalog, examples), which are small and the same for every caller, and handing over the viewer's HTML. A client without MCP Apps gets no check from such a server. `deckApp: { readFontFile }` gives the viewer font files (the local server reads the installed renderer's); `deckApp: false` leaves the viewer out. The lean `createOpfMcpServer` takes `deckApp: { html }` with `DECK_APP_HTML` from `@openpresentation/mcp`, or a function that returns the same page from storage; the function runs only when a client opens the viewer, so other requests never load the viewer page.

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

- The viewer is about 9.1 MB of UTF-8 HTML (9,064,031 bytes in 0.34; the build prints the exact size), loaded once per conversation or cached by the client. Its `resources/read` frame is 9,390,901 bytes, about 1.1 MB under the default 10 MiB stdio limit, and `test/app-resource-frame.test.mjs` fails when that headroom drops below 1,000,000 bytes. The bundle carries only zod's English messages (`scripts/build-app.mjs`) and core's precompiled validators, whose errors are built by shared helper functions (`packages/javascript/scripts/validators-codegen.mjs`). A client may cap the size of an MCP App or ask the user before it shows one.
- Export needs a client that saves files for the viewer (`ui/download-file`); in one that does not, there is no Export menu. A PowerPoint or PNG export draws an SVG picture through the browser's image decoder from a `data:` URL (`svgSource: "data"` of the renderer's `export-browser`), because the sandbox allows no `blob:` image. The model sees the deck as JSON, not as pictures of the slides.
- The `convert` tool handles JSON, YAML and Markdown. Viewer Export runs in the client and requires its file-saving capability; the local `opf` command can also render and write files.
- `validate_deck` reads no files, so a local image path in a deck is not looked up (the CLI warns with `cli/asset-missing`). Pass images as data URIs or assets.
- Layout is measured with real fonts only under `opf-mcp` with `@openpresentation/opf-render` installed; `checks.layout` says `measured` or `estimated`.
