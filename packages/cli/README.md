# @openpresentation/cli

Local-only CLI source for OPF. This is not a published package in v0.2.0, and it is not a PPTX.dev client. It does not render, parse, generate, call remote APIs, fetch catalogs, or use AI.

Native Mac/Linux/Windows distribution and npm CLI publishing are intentionally deferred until a separate CLI package is approved.

## Expected Usage

Build the CLI from the workspace:

```sh
pnpm install
pnpm --filter @openpresentation/cli build
```

Run the built CLI directly during development:

```sh
node packages/cli/dist/index.js schemas
node packages/cli/dist/index.js catalogs
node packages/cli/dist/index.js validate path/to/deck.opf.json
```

Expected commands:

```text
opf schemas
opf catalogs
opf validate <file>
```

Current behavior:

- `schemas` lists bundled OPF schema names, source files, and `$id` values.
- `catalogs` lists bundled catalog kinds and record counts.
- `validate <file>` validates a top-level OPF `Presentation` JSON file locally.

Planned local-only responsibilities:

- validate OPF presentation JSON
- list bundled catalog presets
- inspect bundled schemas
- format OPF JSON
