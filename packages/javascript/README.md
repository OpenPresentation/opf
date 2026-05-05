# @openpresentation/opf

Canonical Open Presentation Format package for JavaScript and TypeScript.

This package is currently private while the OPF schema is being stabilized. It is intended to publish the OPF schemas, catalog presets, generated TypeScript types, and local validation helpers. It does not call PPTX.dev, render PowerPoint files, parse `.pptx`, fetch remote catalogs, or use AI.

## File naming

Use `*.opf.json` for complete Open Presentation Format documents, such as `deck.opf.json`.

OPF documents are plain JSON, and the `.opf.json` suffix keeps that visible to editors, validators, agents, and repository tooling. Avoid bare `*.opf` for OPF JSON because that extension is already used by other document and project formats.

## Expected Usage

Build the workspace package first:

```sh
pnpm install
pnpm --filter @openpresentation/opf build
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
import { validate, assertValid } from "@openpresentation/opf/validator";
import type { Presentation, Audience, Tone } from "@openpresentation/opf/types";
```

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
