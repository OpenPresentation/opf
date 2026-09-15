# OPF lint for humans and agents

The **unreleased source checkout** adds `opf lint` and the browser-safe `@openpresentation/opf/lint` entrypoint. Published core 0.9.0 and CLI 0.7.0 do not include them. Build the checkout or use a verified coordinated candidate; check `opf --help` before asking an installed CLI to lint.

```sh
node packages/cli/dist/index.js lint deck.opf.json
node packages/cli/dist/index.js lint deck.opf.json --config brand-lint.json --strict
```

Lint is read-only and local. It returns JSON diagnostics with stable rule IDs, severity, JSON Pointer paths, original-source UTF-16 ranges, one-based line/column, explanations, contextual suggestions, and schema/catalog definitions. The CLI includes the original file SHA-256 and the bundled core version. A supplied configuration file has its own path and hash. No AI call, account, remote catalog fetch, source normalization, or automatic fix is involved.

| Check | Behavior |
| --- | --- |
| Strict JSON syntax | Reports malformed tokens, comments and trailing commas with source ranges |
| Duplicate JSON keys | Reports both escaped and literal spellings of the same key; an earlier value cannot silently disappear into `JSON.parse` |
| OPF schema and semantic constraints | Retains the full validator issue, including all union alternatives, and points to the actual schema |
| Catalog references | Uses document records over supplied loaded records over built-ins; unknown IDs are advisory, including engine-defined layouts |
| Catalog definitions | Validates supplied and inline records; rejects duplicate IDs within one catalog and reports invalid overrides |
| Asset references | Reports missing document registry IDs and cyclic `asset:` references; does not fetch resource bytes |
| Explicit contracts | Reports existing fields outside the allowed values in a host-supplied policy |

Free-form audience/purpose descriptions and arbitrary extension data do not become catalog references because of their spelling. An inline custom tone/narrative remains distinct from a string catalog reference. External catalog sources remain visible as informational diagnostics; URL and `pkg:` records are not resolved by this local lint pass. Suggestions name records actually present in the supplied context and never silently replace authored values.

`valid` means no lint errors. `schemaValid` separately reports structural validation, and is `null` when malformed JSON prevented validation. Exit code 0 means no lint errors; 1 means lint errors, or warnings with `--strict`; 2 means a usage, configuration or I/O failure. The existing `opf validate` command retains its existing report and exit behavior.

## Catalog context and design contracts

An explicit local JSON file may contain `catalogs` and `contracts`. It is host configuration, separate from the OPF document. Fields under document `extensions` are data and cannot install lint policy.

```json
{
  "catalogs": {
    "layouts": [
      {"id":"partner-title","name":"Partner title","placeholders":[{"type":"title"}]}
    ]
  },
  "contracts": [
    {
      "path":"/slides/*/layout",
      "allowedValues":["partner-title","text-1x"],
      "message":"Use the brand layouts {{allowed}} at {{path}}. See {{file}}.",
      "documentation":"brand-guide.md#layouts",
      "severity":"error"
    }
  ]
}
```

Contract paths are JSON Pointer patterns: `~0` escapes `~`, `~1` escapes `/`, and a whole `*` segment matches one property or array index. Contracts check existing fields; they do not require an omitted field or insert defaults. Allowed values are JSON primitives. Optional message placeholders are `{{path}}`, `{{value}}`, `{{allowed}}`, and `{{file}}`. Invalid or misspelled configuration keys fail instead of being ignored. Messages and catalog labels are data, not executable instructions.

## Library use and repair

```js
import { lintSource, lintPresentation } from '@openpresentation/opf/lint';
const report = lintSource(source, {catalogs: loadedCatalogRecords, contracts});
const objectReport = lintPresentation(document, {catalogs: loadedCatalogRecords});
```

The object API has no source ranges and does not claim to inspect original JSON spelling. `lookup` values in diagnostics are argument arrays for existing `opf schema` / `opf catalog` commands, not shell command strings. Use the same package version when looking up a definition.

Inspect a suggested change, preserve unrelated content, then apply a guarded edit with the existing `opf edit --expect-sha256 ... --dry-run` workflow. Rerun lint and render the candidate before saving. Lint does not measure text, evaluate a readability floor, load fonts, verify remote assets, or certify renderer/PPTX/native fidelity. Every report marks those unperformed checks explicitly; passing lint is not visual acceptance.
