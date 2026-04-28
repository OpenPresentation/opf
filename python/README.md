# pptx-dev

Official Python SDK for [pptx.dev](https://www.pptx.dev) — the AI-native presentation engine.

Generate, parse, validate, convert, and render PowerPoint presentations via the **OPF (Open Presentation Format)**, a JSON contract designed for AI agents and developers.

- ✔ Sync and async clients (both built on `httpx`)
- ✔ Typed OPF document models (Pydantic v2)
- ✔ Typed errors (network vs. 4xx vs. 5xx vs. validation vs. rate-limit)
- ✔ Auth via constructor option or `PPTX_API_KEY` environment variable
- ✔ Drop-in LangChain and LlamaIndex tool helpers
- ✔ Python 3.10+

## Install

```sh
pip install pptx-dev
```

With optional framework adapters:

```sh
pip install "pptx-dev[langchain]"
pip install "pptx-dev[llamaindex]"
```

## First call (sync)

```python
from pptx_dev import Pptx

pptx = Pptx()  # reads PPTX_API_KEY from env

result = pptx.opf.validate({
    "$schema": "https://pptx.dev/schema/opf/v1",
    "meta": {"title": "Hello"},
    "design": {"theme": "corporate-minimal"},
    "slides": [
        {
            "id": "s1",
            "layout": "title-slide",
            "elements": [
                {"id": "h1", "type": "text", "content": {"text": "Hello, world"}},
            ],
        }
    ],
})

print(result["valid"], result["errors"], result["warnings"])
```

## First call (async)

```python
import asyncio
from pptx_dev import AsyncPptx

async def main() -> None:
    async with AsyncPptx() as pptx:
        info = await pptx.health()
        print(info)

asyncio.run(main())
```

## Typed OPF documents

Import Pydantic v2 models and let `pptx.opf.generate` serialize them:

```python
from pptx_dev import Pptx
from pptx_dev.opf import OPFDocument, OPFSlide, OPFTextElement, OPFTextContent

doc = OPFDocument(
    meta={"title": "Q1 Review"},
    design={"theme": "corporate-minimal"},
    slides=[
        OPFSlide(
            id="title",
            layout="title-slide",
            elements=[
                OPFTextElement(id="h1", content=OPFTextContent(text="Q1 Review")),
            ],
        )
    ],
)

pptx = Pptx()
job = pptx.opf.generate(doc, format="pptx")
print(job["status"], job["slideCount"])
```

Plain `dict` input is also accepted anywhere an `OPFDocument` is expected.

## Parse an existing .pptx

```python
from pathlib import Path
from pptx_dev import Pptx

pptx = Pptx()
data = Path("deck.pptx").read_bytes()

upload = pptx.parse.upload(data, filename="deck.pptx")
slide0 = pptx.parse.slide(upload["parseId"], 0)
print(slide0["textRuns"])
```

## Convert .pptx → OPF

```python
opf = pptx.convert.pptx_to_opf(data, filename="deck.pptx")
```

## Render to web / SVG / PNG

```python
web = pptx.render.web(data, filename="deck.pptx")
print(web["viewerUrl"])

svg = pptx.render.export(data, "svg", slides=[1, 2])
```

## Authentication

The client resolves a bearer token in this order:

1. `api_key=...` passed to the constructor.
2. `PPTX_API_KEY` environment variable.

```python
from pptx_dev import Pptx

pptx = Pptx(api_key="ppx_...")
```

Get your API key from the [API Keys](https://www.pptx.dev/account/api-keys) page.

## Custom base URL

Useful for local development or self-hosted deployments:

```python
pptx = Pptx(base_url="http://localhost:3000/api")
```

## Error handling

All errors inherit from `PptxError`.

| Error                  | When                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `PptxNetworkError`     | `httpx` raised (DNS, TLS, timeout, connection reset)                 |
| `PptxApiError`         | HTTP 4xx / 5xx response with JSON or text body                       |
| `PptxValidationError`  | HTTP 422 with `error.details.errors` (exposed as `validation_errors`) |
| `PptxRateLimitError`   | HTTP 429 (exposes `retry_after_seconds` from the `Retry-After` header) |

```python
from pptx_dev import Pptx, PptxValidationError, PptxRateLimitError

pptx = Pptx()

try:
    pptx.opf.generate(bad_doc)
except PptxValidationError as err:
    print("OPF schema errors:", err.validation_errors)
except PptxRateLimitError as err:
    print("Retry after:", err.retry_after_seconds, "seconds")
```

Every error exposes `request_id` when the server returned an `X-Request-Id` header — makes it easy to report issues back to pptx.dev support.

## LangChain

```python
from pptx_dev import Pptx
from pptx_dev.integrations.langchain import pptx_toolkit

pptx = Pptx()
tools = pptx_toolkit(pptx)
# pass `tools` to a LangChain agent
```

Tools exposed: `pptx_opf_validate`, `pptx_opf_generate`, `pptx_parse_slide`.

## LlamaIndex

```python
from pptx_dev import Pptx
from pptx_dev.integrations.llamaindex import pptx_tool_spec

pptx = Pptx()
tools = pptx_tool_spec(pptx).to_tool_list()
# pass `tools` to a LlamaIndex agent
```

## References

- REST API reference: [pptx.dev/docs](https://www.pptx.dev/docs)
- OPF schema: [pptx.dev/schema/opf/v1](https://pptx.dev/schema/opf/v1)
- OpenAPI spec: [api.pptx.dev/openapi.json](https://api.pptx.dev/openapi.json)
- TypeScript SDK: [`@pptx/sdk`](https://www.npmjs.com/package/@pptx/sdk)

## License

MIT — see [LICENSE](./LICENSE).
