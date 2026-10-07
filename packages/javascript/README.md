# @openpresentation/opf

Canonical Open Presentation Format package for JavaScript and TypeScript.

Publishes the OPF schemas, catalog presets, raw spec files, generated TypeScript types, examples, docs, and local validation helpers. The schema is pre-stable (0.x — expect breaking changes between minor versions until 1.0). This package does not render PowerPoint files, parse `.pptx`, fetch remote catalogs, call hosted APIs, provide telemetry, or use AI.

The canonical npm package remains `@openpresentation/opf`; a separate `@openpresentation/opf-spec` package is not used for v0.2.0 so existing downstream imports stay stable. The packed npm artifact includes package-addressable OPF schemas, catalogs, reference files, and an optional downstream-service reference `openapi.yaml` under `spec/`.

Repository: https://github.com/OpenPresentation/opf

## File naming

Use `*.opf.json` for complete Open Presentation Format documents, such as `deck.opf.json`.

OPF documents are plain JSON, and the `.opf.json` suffix keeps that visible to editors, validators, agents, and repository tooling. Avoid bare `*.opf` for OPF JSON because that extension is already used by other document and project formats.

## Install

```sh
pnpm add @openpresentation/opf
# or: npm install @openpresentation/opf
# or: yarn add @openpresentation/opf
```

Requires Node 22 or later (`engines.node` `>=22`) from the release after 0.12.1. Versions 0.10.0 to 0.12.1 declared `24.x`, so npm on Node 22 or 26 silently installed an older release that matched (RR-20). Earlier published versions retain their recorded runtime requirements.

## Usage

Use the common root API for most application code:

```ts
import {
  presentation,
  audiences,
  tones,
  catalogs,
  validate,
  validateCatalogRecord,
} from "@openpresentation/opf";

import type { Presentation } from "@openpresentation/opf";

const deck: Presentation = {
  name: "Quarterly Review",
  slides: [{ title: "Quarterly Review", items: ["Revenue", "Product", "Hiring"] }],
};

console.log(presentation.$id);
console.log(validate(deck).valid);
console.log(validateCatalogRecord("tones", tones[0]).valid);
console.log(audiences.map((audience) => audience.id));
console.log(Object.keys(catalogs));
```

Use focused imports when you only need one surface:

```ts
import { presentation, audience } from "@openpresentation/opf/schemas";
import { audiences, tones } from "@openpresentation/opf/catalogs";
import { specFileEntries } from "@openpresentation/opf/spec-files";
import { validate, assertValid, validationRules } from "@openpresentation/opf/validator";
import {
  layoutPreviews,
  getLayoutPreview,
  hasLayoutPreview,
} from "@openpresentation/opf/previews";
import type { Presentation, Audience, Tone } from "@openpresentation/opf/types";
```

The root entry holds the application-level API: schemas, catalogs, validation, variables, pagination, data helpers, font policy, `stats` and `resolveSlideContext`. Prefer the focused subpaths above when a package consumer only needs one surface, so the root bundle's full catalog/schema payload is not loaded unnecessarily.

The layout engine's names are not on the root. `composeSlide`, `fitText`, `layoutQuote` and the other `layoutX`/`fitX` functions, numbering, footnotes and citations, colour contrast, code syntax, pattern fills, metric trends, chart options, script fonts and text direction come from `@openpresentation/opf/composition`; the symbol-font tables come from `@openpresentation/opf/symbol-font-encodings`.

### Facts, slide context and the fonts handle

`stats(presentation, options?)` reports neutral facts about a deck (structure, words, notes, images, charts, tables, datasets, citations, variables, assets, fonts) without composing, measuring or validating; see [the stats guide](../../docs/stats.md). `resolveSlideContext(presentation, index, { fonts })` resolves one slide's canvas, layout, theme and font families (slide design, then deck design, then theme, then the default font scheme) into the `ComposeSlideOptions` that `composeSlide` takes, with `unresolved-font-scheme`, `unresolved-layout` and `unresolved-theme` diagnostics. Deck-level verbs take `{ fonts }`, a handle whose `textMeasurement` is how wide the host's real fonts draw text (`paginate(deck, { fonts })`); the renderer's font loader returns a richer handle that extends it. `composeSlide` itself is engine-level and takes `textMeasurement` and `fontFamilies` (`{ heading, body, code, accent? }`) directly.

### Content conversions

`@openpresentation/opf/convert` converts one payload between text, list, quote, metric, code, timeline, chart, table and a group of metric blocks (`convertContent`, `contentConversionTargets`), nests list items, groups blocks, moves an image between the content and the slide design, and splits or merges slides (`splitSlide`, `splitSlideOnOverflow`, `mergeSlides`, `unpaginate`). Every function is pure, never invents content, reports `lossless` and `loss`, refuses with a reason and validates its output. See the [conversions guide](../../docs/conversions.md). Not in releases before the one that lists it in the changelog.

### Markdown and outlines

`@openpresentation/opf/markdown` reads and writes a deck as Markdown in a small documented dialect (YAML front matter, `---` between slides, `#` title, `##` subtitle, lists, quotes, tables, images, `chart`, `metric` and `timeline` fences, `Note:` speaker notes). `fromMarkdown(markdown, { split, defaults, validate })` returns `{ presentation, valid, findings, counts }` with findings (the shared `Finding` format) that carry the line and column of the Markdown; `toMarkdown(presentation, { unsupported })` writes any valid deck, embedding what the dialect has no syntax for as YAML (or dropping it into `report.loss`), and the Markdown it writes converts back to the same deck. Deterministic and offline. Reads front matter with the `yaml` package. See the [Markdown guide](../../docs/markdown.md). Not in releases before the one that lists it in the changelog.

### OPF as YAML

`@openpresentation/opf/yaml` reads and writes a deck as YAML, the authoring form of the same data (JSON stays canonical). `fromYaml(text, { aliases, validate })` reads strict JSON-compatible YAML 1.2 (one document, a mapping at the root, no custom tags, duplicate keys or non-finite numbers; anchors, aliases and merge keys only with `aliases: true`) and returns `{ presentation, valid, findings, counts, schemaValid, checks }`: the `validate` report of the deck, with every finding (the shared `Finding` format, YAML syntax errors as `yaml/<rule>` findings) located at the line and column of the YAML. `toYaml(presentation, { schemaComment })` writes canonical YAML (schema key order, block style, ambiguous strings quoted) that reads back to the same deck, and throws `OPFYamlError` for an invalid one. `parseYamlData` and `scanYamlComments` are the helpers. See [the YAML guide](../../docs/yaml.md).

### Validate (0.14.0)

`validate(input, options?)` is the one checker, from the root and from `@openpresentation/opf/validator`. `input` is a parsed presentation or strict JSON text; the result is a `ValidationReport` whose `findings` (the shared `Finding` format, `spec/schemas/finding.schema.json`) each have a stable `opf/<rule>` id, a severity and one of six categories: `format` (JSON syntax, duplicate keys, schema), `references` (catalog ids, assets, citations, datasets), `policy` (host `contracts`), `accessibility` (contrast, alt text, reading order, links), `layout` (overflow, type size, image resolution, fonts) and `content` (placeholders, empty slides, non-numeric chart cells). `valid` means no finding has severity `error`, which by default only `format`, `references` and `policy` findings can have. Text input adds line and column; `only`, `ignore` and `severity` pick and promote rules or categories; composition is lazy, so `validate(deck, { only: ["format"] })` costs what a schema check costs. Read-only and deterministic: no remote resources are fetched. See [the validate guide](../../docs/validate.md). A clean report does not certify layout, fonts, or native export fidelity.

### Patch, diff, merge and format (0.12.0)

Added in 0.12.0 (not in 0.11.4 or earlier): `@openpresentation/opf/patch` is the one RFC 6902 implementation the CLI and the editor share (`applyPatch`, `applyPatchWithInverse`, `invertPatch`, strict pointer helpers, optional schema validation of the result); `@openpresentation/opf/diff` has `diff` (slide matching by id, content and similarity, moves, a readable report and a JSON Patch) and `merge` (three-way merge with conflict objects that never drop a side); `@openpresentation/opf/format` has `format` (canonical key order and layout, idempotent). See [the guide](../../docs/patch-diff-merge-format.md).

### Layout previews

`@openpresentation/opf/previews` ships pre-rendered HTML thumbnails for the
slide layouts catalogued at pptx.gallery. Each preview is a Tailwind-styled
fragment sized to fill a 16:9 container and only depends on the standard
`--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`,
`--accent`, and `--border` CSS variables.

```tsx
import { getLayoutPreview } from "@openpresentation/opf/previews";

export function LayoutThumbnail({ slug }: { slug: string }) {
  const html = getLayoutPreview(slug);
  if (!html) return null;
  return (
    <div
      className="aspect-[16/9] overflow-hidden rounded-lg border border-border bg-card"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

Raw HTML source-of-truth lives under `spec/previews/layouts/<slug>.html` and is
also addressable via `@openpresentation/opf/spec/previews/layouts/<slug>.html`.

### Example decks

`@openpresentation/opf/examples` ships every `.opf.json` file from `examples/`
in the upstream repo, already parsed and validated against the presentation
schema at build time.

```ts
import {
  examples,
  galleries,
  getExample,
  getExamplesByGallery,
} from "@openpresentation/opf/examples";

const compliance = getExample("compliance-readiness-review");
const businessDecks = getExamplesByGallery("business-functions");

console.log(`${examples.length} example decks across ${galleries.length} galleries`);
```

Each `ExampleRecord` includes the parsed `Presentation` object plus its
repo-relative path, top-level category (`gallery`, `technical`, …), and
gallery slug when applicable.

### Documentation pages

`@openpresentation/opf/docs` ships the top-level `docs/*.md` reference pages
(`schema-reference`, `catalog-schema-reference`, `content-payloads`,
`content-item-design-overrides`, `examples`). Subdirectories like
`docs/migrations` and `docs/plans` are intentionally excluded — those move too
quickly to ship inside a pinned npm release.

```ts
import { docs, getDoc } from "@openpresentation/opf/docs";

for (const doc of docs) {
  console.log(`${doc.title} — ${doc.file}`);
}

const schemaRef = getDoc("schema-reference");
console.log(schemaRef?.markdown.slice(0, 200));
```

### Upstream README

`@openpresentation/opf/repo-readme` exposes the raw markdown of the upstream
`OpenPresentation/opf` README.md at the version pinned by this release. Use it
when you want to mirror the canonical README inside another site or app
without doing a network fetch.

```ts
import { repoReadme } from "@openpresentation/opf/repo-readme";

console.log(repoReadme.split("\n").slice(0, 3).join("\n"));
```

Validation reports carry `findings`. A finding with severity `error` is a
structural problem that makes `valid` false; `warning` and `info` findings are
advisory, such as an unknown catalog id in `narrative`, `design`, or a chart
`type` reference (`opf/catalog-reference`) or a missing alt text. An id that a
matching inline `catalogs.<kind>.records[]` entry defines is known, and a custom
`catalogs.<kind>.source` exempts that kind's ids from unknown-id warnings
unless the host loads the source's records and passes them as `catalogs`.

```ts
const report = validate(deck);
if (!report.valid) console.error(report.findings.filter((finding) => finding.severity === "error"));
for (const finding of report.findings) console.warn(finding.ruleId, finding.path, finding.message);
```

Validate catalog records locally:

```ts
import { audiences, validateCatalogRecord } from "@openpresentation/opf";

for (const record of audiences) {
  const result = validateCatalogRecord("audiences", record);
  if (!result.valid) {
    console.error(result.findings);
  }
}
```

Raw canonical JSON is published under `spec/`:

```ts
import presentationSchema from "@openpresentation/opf/spec/schemas/opf.schema.json" with {
  type: "json",
};
```

The raw spec manifest exposes typed package paths for files that should be resolved from npm instead of GitHub. `openapi.yaml` is a reference contract for downstream services that choose to expose OPF over HTTP; OpenPresentation does not host that API.

```ts
import { specFileEntries } from "@openpresentation/opf/spec-files";

const openApi = specFileEntries.find((entry) => entry.path === "openapi.yaml");
console.log(openApi?.packagePath);
```

Package-addressable catalog paths can be used by OPF catalog resolvers:

```json
{
  "catalogs": {
    "narratives": {
      "source": "pkg:@openpresentation/opf/spec/catalogs/narratives"
    }
  }
}
```

## Development

```sh
pnpm --filter @openpresentation/opf typecheck
pnpm --filter @openpresentation/opf test
pnpm --filter @openpresentation/opf pack:dry-run
```

`src/generated/` and `dist/` are generated from the root `spec/` directory and are intentionally ignored by git.
