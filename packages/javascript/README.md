# @dataadvantage/opf

Canonical Open Presentation Format package for JavaScript and TypeScript.

This package is currently private while the OPF schema is being stabilized. It is intended to publish the OPF schemas, catalog presets, generated TypeScript types, and local validation helpers. It does not call PPTX.dev, render PowerPoint files, parse `.pptx`, fetch remote catalogs, or use AI.

## File naming

Use `*.opf.json` for complete Open Presentation Format documents, such as `deck.opf.json`.

OPF documents are plain JSON, and the `.opf.json` suffix keeps that visible to editors, validators, agents, and repository tooling. Avoid bare `*.opf` for OPF JSON because that extension is already used by other document and project formats.

## Expected Usage

Build the workspace package first:

```sh
pnpm install
pnpm --filter @dataadvantage/opf build
```

Use the common root API for most application code:

```ts
import {
  presentation,
  audiences,
  tones,
  catalogs,
  validate,
  validatePresentation,
} from "@dataadvantage/opf";

import type { Presentation } from "@dataadvantage/opf";

const deck: Presentation = {
  $schema: "https://pptx.dev/schema/opf/v1",
  meta: { title: "Quarterly Review" },
  design: {},
  slides: [{ id: "title", layout: "title-left", elements: [] }],
};

console.log(presentation.$id);
console.log(validatePresentation(deck).valid);
console.log(validate(tones[0], "tones").valid);
console.log(audiences.map((audience) => audience.id));
console.log(Object.keys(catalogs));
```

Use focused imports when you only need one surface:

```ts
import { presentation, audience } from "@dataadvantage/opf/schemas";
import { audiences, tones } from "@dataadvantage/opf/catalogs";
import { validate, assertValid } from "@dataadvantage/opf/validator";
import type { Presentation, Audience, Tone } from "@dataadvantage/opf/types";
```

Validate catalog records locally:

```ts
import { audiences, validateCatalogRecord } from "@dataadvantage/opf";

for (const record of audiences) {
  const result = validateCatalogRecord("audiences", record);
  if (!result.valid) {
    console.error(result.errors);
  }
}
```

Raw canonical JSON is published under `spec/`:

```ts
import presentationSchema from "@dataadvantage/opf/spec/presentation.schema.json" with {
  type: "json",
};
```

Package-addressable catalog paths can be used by OPF catalog resolvers:

```json
{
  "catalogs": {
    "narratives": {
      "source": "pkg:@dataadvantage/opf/spec/narratives"
    }
  }
}
```

## Development

```sh
pnpm --filter @dataadvantage/opf typecheck
pnpm --filter @dataadvantage/opf test
pnpm --filter @dataadvantage/opf pack:dry-run
```

`src/generated/` and `dist/` are generated from the root `spec/` directory and are intentionally ignored by git.
