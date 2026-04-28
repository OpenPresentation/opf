# @pptx/sdk

Official TypeScript SDK for [pptx.dev](https://www.pptx.dev) — the AI-native presentation engine.

Generate, parse, validate, convert, and render PowerPoint presentations via the **OPF (Open Presentation Format)**, a JSON contract designed for AI agents and developers.

- ✔ Dual ESM / CJS build with proper `exports` map
- ✔ Works in Node 20+, Next.js (App Router, server + client), Bun, modern browsers
- ✔ Typed OPF document types + typed request/response types
- ✔ Typed errors (network vs. 4xx vs. 5xx vs. validation vs. rate-limit)
- ✔ Auth via constructor option or `PPTX_API_KEY` environment variable

## Install

```sh
npm i @pptx/sdk
# or
pnpm add @pptx/sdk
# or
bun add @pptx/sdk
```

## First call

```ts
import { PptxClient } from "@pptx/sdk";

const pptx = new PptxClient({ apiKey: process.env.PPTX_API_KEY });

const result = await pptx.opf.validate({
  $schema: "https://pptx.dev/schema/opf/v1",
  meta: { title: "Hello" },
  design: { theme: "corporate-minimal" },
  slides: [
    {
      id: "s1",
      layout: "title-slide",
      elements: [
        { id: "h1", type: "text", content: { text: "Hello, world" } },
      ],
    },
  ],
});

console.log(result.valid, result.errors, result.warnings);
```

## Generate a .pptx from OPF

```ts
import { PptxClient, type OPFDocument } from "@pptx/sdk";

const pptx = new PptxClient();

const doc: OPFDocument = {
  $schema: "https://pptx.dev/schema/opf/v1",
  meta: { title: "Q1 Review" },
  design: { theme: "corporate-minimal" },
  slides: [
    {
      id: "title",
      layout: "title-slide",
      elements: [
        { id: "h1", type: "text", content: { text: "Q1 Review" } },
      ],
    },
  ],
};

const job = await pptx.opf.generate(doc, { format: "pptx" });
console.log(job.status, job.slideCount);
```

## Parse an existing .pptx

```ts
import { readFile } from "node:fs/promises";
import { PptxClient } from "@pptx/sdk";

const pptx = new PptxClient();
const bytes = await readFile("deck.pptx");

const { parseId, slideCount } = await pptx.parse.upload({
  data: bytes,
  filename: "deck.pptx",
});

const slide0 = await pptx.parse.slide(parseId, 0);
console.log(slide0.textRuns);
```

## Convert .pptx → OPF

```ts
const opf = await pptx.convert.pptxToOpf({ data: bytes, filename: "deck.pptx" });
```

## Render to web / SVG / PNG

```ts
const web = await pptx.render.web({ data: bytes, filename: "deck.pptx" });
console.log(web.viewerUrl);

const svg = await pptx.render.export({ data: bytes }, "svg", { slides: [1, 2] });
```

## Authentication

The client looks for a bearer token in this order:

1. The `apiKey` option passed to the constructor.
2. The `PPTX_API_KEY` environment variable (Node / Bun runtimes only).

```ts
const pptx = new PptxClient({ apiKey: "ppx_..." });
```

## Custom base URL

Useful for local development against a Next.js dev server, or for self-hosted deployments.

```ts
const pptx = new PptxClient({ baseUrl: "http://localhost:3000/api" });
```

## Error handling

All errors inherit from `PptxError`.

| Error                  | When                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `PptxNetworkError`     | `fetch` threw (DNS, TLS, timeout, aborted)                           |
| `PptxApiError`         | HTTP 4xx / 5xx response with JSON or text body                       |
| `PptxValidationError`  | HTTP 422 with `error.details.errors` (exposed as `validationErrors`) |
| `PptxRateLimitError`   | HTTP 429 (exposes `retryAfterSeconds` from the `Retry-After` header) |

```ts
import {
  PptxClient,
  PptxValidationError,
  PptxRateLimitError,
} from "@pptx/sdk";

try {
  await pptx.opf.generate(badDoc);
} catch (err) {
  if (err instanceof PptxValidationError) {
    console.error("OPF schema errors:", err.validationErrors);
  } else if (err instanceof PptxRateLimitError) {
    console.error("Retry after:", err.retryAfterSeconds, "seconds");
  } else {
    throw err;
  }
}
```

Every error exposes `requestId` when the server returned an `X-Request-Id` header, which makes it easy to report issues back to pptx.dev support.

## OPF types

The full OPF type tree is available as a subpath export:

```ts
import type { OPFDocument, OPFSlide, OPFElement } from "@pptx/sdk/opf";
```

Or from the root entry:

```ts
import type { OPFDocument } from "@pptx/sdk";
```

## References

- REST API reference: [pptx.dev/docs](https://www.pptx.dev/docs)
- OPF schema: [pptx.dev/schema/opf/v1](https://pptx.dev/schema/opf/v1)
- OpenAPI spec: [api.pptx.dev/openapi.json](https://api.pptx.dev/openapi.json)

## License

MIT — see [LICENSE](./LICENSE).
