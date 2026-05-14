# @openpresentation/opf

Canonical Open Presentation Format package for JavaScript and TypeScript.

Publishes the OPF schemas, catalog presets, raw spec files, generated TypeScript types, and local validation helpers. The schema is pre-stable (0.x — expect breaking changes between minor versions until 1.0). This package does not render PowerPoint files, parse `.pptx`, fetch remote catalogs, or use AI.

The canonical npm package remains `@openpresentation/opf`; a separate `@openpresentation/opf-spec` package is not used for v0.2.0 so existing downstream imports stay stable. The packed npm artifact includes package-addressable OPF schemas, catalogs, reference files, and `openapi.yaml` under `spec/`.

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

Requires Node 20 or later.

## Usage

Use the common root API for most application code:

```ts
import {
  presentation,
  audiences,
  tones,
  catalogs,
  validate,
  validatePresentation,
} from "@openpresentation/opf";

import type { Presentation } from "@openpresentation/opf";

const deck: Presentation = {
  name: "Quarterly Review",
  slides: [{ title: "Quarterly Review", items: ["Revenue", "Product", "Hiring"] }],
};

console.log(presentation.$id);
console.log(validatePresentation(deck).valid);
console.log(validate(tones[0], "tones").valid);
console.log(audiences.map((audience) => audience.id));
console.log(Object.keys(catalogs));
```

Use focused imports when you only need one surface:

```ts
import { presentation, audience } from "@openpresentation/opf/schemas";
import { audiences, tones } from "@openpresentation/opf/catalogs";
import { specFileEntries } from "@openpresentation/opf/spec-files";
import { validate, assertValid } from "@openpresentation/opf/validator";
import {
  layoutPreviews,
  getLayoutPreview,
  hasLayoutPreview,
} from "@openpresentation/opf/previews";
import type { Presentation, Audience, Tone } from "@openpresentation/opf/types";
```

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

Validate catalog records locally:

```ts
import { audiences, validateCatalogRecord } from "@openpresentation/opf";

for (const record of audiences) {
  const result = validateCatalogRecord("audiences", record);
  if (!result.valid) {
    console.error(result.errors);
  }
}
```

Raw canonical JSON is published under `spec/`:

```ts
import presentationSchema from "@openpresentation/opf/spec/schemas/opf.schema.json" with {
  type: "json",
};
```

The raw spec manifest exposes typed package paths for files that should be resolved from npm instead of GitHub:

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
