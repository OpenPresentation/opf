# OPF MCP server

`@openpresentation/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server for OPF, so an agent or editor that speaks MCP can learn the format, look things up and check a deck without shelling out and parsing text. It teaches OPF (documentation, schemas, the default catalog, example decks and the six agent skills, all as resources, with a `start_here` tool that gives a path for a goal), and it runs the checks the CLI runs (`validate_deck`, `convert`).

It keeps no state, reads no file (everything it serves is bundled in the package, and tools work on the text you pass in), fetches nothing and has no network access. It runs two ways: locally over stdio (this page), and hosted on an edge runtime (the same server definition over Streamable HTTP; a hosted URL at `openpresentation.org/mcp` is coming). The local server is the only one that can measure layout with the real fonts, when `@openpresentation/opf-render` is installed.

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
| Claude Desktop | Add the JSON above to `claude_desktop_config.json` |
| Any other client | Run `npx -y @openpresentation/mcp` as a stdio server (installed, the binary is `opf-mcp`) |

Check it with the official inspector: `npx @modelcontextprotocol/inspector npx -y @openpresentation/mcp`.

`opf mcp` of the CLI is a convenience: it runs this server when `@openpresentation/mcp` is installed beside the CLI or in the working directory, and otherwise prints `npx -y @openpresentation/mcp` and exits with 2. The CLI itself carries no MCP code.

## Tools

Every tool takes JSON arguments and returns structured JSON (`structuredContent`, with the same JSON as text for clients that read only text). A failure comes back with `isError: true` and a text report `{ ok: false, code, error, ... }` (no structured content), with a stable `code` (`unknown-id`, `invalid-document`, ...) and, where it helps, a suggestion ("Did you mean two-column?"). All tools are read-only.

| Tool | Arguments | Returns |
| --- | --- | --- |
| `start_here` | `goal?` (what you are trying to do, in your own words) | `{ goal, summary, steps[], docs[], skills[], examples[], layouts[], themes[], validate }`: a short ordered path. Which documentation pages and skill to read, two or three example decks, layouts and themes from the catalog, and the validate step (`validate_deck` with `failOn: "warning"`). With no goal, the general learning path. Everything it names is a resource URI or a tool to call next. |
| `validate_deck` | `document` (a JSON object, or deck text), `format?` (`json`, `yaml`, `markdown`; default JSON), `failOn?` (`error`, `warning`, `info`; default `error`) | `{ ok, valid, schemaValid, failOn, format, counts, findings[], checks, hint? }`. The findings are the ones `opf validate` reports (rule id, severity, category, JSON Pointer `path`, message, `help`, `fixes`, and a `location` with line and column for JSON, YAML and Markdown text). `ok` is false when a finding is at or above `failOn`. It does not look for local image files (it reads none). |
| `get_schema` | `name?` (a schema such as `presentation` or `layout`, or a `$defs` name such as `Chart`), `pointer?` (a JSON Pointer into the schema, or a `$defs` name) | `{ name, pointer, id, schema, opfVersion }`, like `opf schema`. `$ref`s stay as written. A whole schema names the `@openpresentation/opf` release it came from in its `$comment`; a part is as it is. |
| `search_catalog` | `kind` (`layouts`, `themes`, `color-schemes`, `font-schemes`, `narratives`, `audiences`, `purposes`, `tones`, `chart-types`, `languages`, `social-platforms`, `examples`), `query?`, `limit?` | `{ kind, total, returned, records[] }`: short records (id, name, summary, description, tags), best match first. |
| `get_catalog_record` | `kind`, `id` | `{ kind, id, uri, record }`: the record in full, like `opf catalog <kind> <id>`. |
| `convert` | `document`, `from?`, `to` (`json`, `yaml`, `markdown`) | `{ ok, from, to, text, findings, counts }`, like `opf convert`. The deck must be valid; otherwise nothing is converted and the findings are returned. Text formats only: PDF, PPTX, PNG and SVG need the local `opf convert`. |
| `search_docs` | `query`, `limit?` | `{ total, results[] }`: ranked pages and skills, each with `uri`, `title`, the `heading` the snippet sits under, a `snippet` and a `score`. |
| `list_examples` | `category?`, `query?` | `{ total, categories, examples[] }`: slug, name, category, slide count and `uri` for each bundled example deck. |

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

Skill scripts and agent manifests are not served; the server runs no code from them.

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
4. It uses `convert` to hand the deck over as YAML or Markdown. Rendering and PPTX export are outside this server: the local `opf convert deck.opf.json deck.pdf` (or `.pptx`) does them.

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

`createOpfServer({ version, opfVersion?, sources?, checkText? })` returns an SDK `McpServer`. `sources` replaces any of the bundled `docs`, `examples`, `skills` and `whatsNew`. `checkText` replaces the check behind `validate_deck`; `opf-mcp` passes the one that measures layout with the fonts `opf convert` draws with. Without it, layout is estimated and the report's `hint` says so.

The bundled data is most of the size of a Worker bundle (about 12 MB minified, 5.6 MB gzipped, of which the example decks are 7 MB and the documentation 1.4 MB). A host that must stay small imports `createOpfMcpServer` from `@openpresentation/mcp/server`, which bundles none of it (about 3.5 MB minified, 0.7 MB gzipped), and takes `sources: { docs, examples, skills, whatsNew? }` from wherever it keeps them (KV, R2, static assets): `docs` is `[{ slug, title, markdown }]`, `examples` is `[{ slug, category, file, deck }]`, `skills` maps a skill name to `{ "SKILL.md": text, ... }`. `defaultSources()` and `DOC_SLUGS` (the pages served) are exported from `@openpresentation/mcp`.

## Limits

- Text formats only for `convert`. Rendering and PowerPoint need the local `opf` command, which can write files.
- `validate_deck` reads no files, so a local image path in a deck is not looked up (the CLI warns with `cli/asset-missing`). Pass images as data URIs or assets.
- Layout is measured with real fonts only under `opf-mcp` with `@openpresentation/opf-render` installed; `checks.layout` says `measured` or `estimated`.
