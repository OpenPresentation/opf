"""LangChain tool adapters for pptx.dev.

Requires ``langchain-core>=0.2``. Install with::

    pip install "pptx-dev[langchain]"

Usage::

    from pptx_dev import Pptx
    from pptx_dev.integrations.langchain import pptx_toolkit

    pptx = Pptx()
    tools = pptx_toolkit(pptx)
    # pass `tools` to a LangChain agent
"""

from __future__ import annotations

import json
from typing import Any

try:
    from langchain_core.tools import StructuredTool
except ImportError as exc:  # pragma: no cover - import guard
    raise ImportError(
        "langchain-core is required for pptx_dev.integrations.langchain. "
        'Install with `pip install "pptx-dev[langchain]"`.'
    ) from exc

from pydantic import BaseModel, Field

from ..client import Pptx


class _ValidateInput(BaseModel):
    """JSON-serialized OPF document to validate."""

    document_json: str = Field(
        description=(
            "A JSON-encoded OPF document. Must include `$schema`, `meta`, "
            "`design`, and `slides`."
        )
    )


class _GenerateInput(BaseModel):
    """JSON-serialized OPF document to render."""

    document_json: str = Field(
        description="A JSON-encoded OPF document to render into a .pptx file."
    )
    format: str = Field(
        default="pptx",
        description="Output format: one of 'pptx', 'pdf', 'png', 'svg'.",
    )


class _ParseSlideInput(BaseModel):
    parse_id: str = Field(description="Parse ID returned by /v1/parse upload.")
    index: int = Field(description="Zero-based slide index.")


def _parse_document(payload: str) -> Any:
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"document_json is not valid JSON: {exc}") from exc


def pptx_validate_tool(client: Pptx) -> StructuredTool:
    """Return a LangChain ``StructuredTool`` that validates an OPF document."""

    def _run(document_json: str) -> str:
        doc = _parse_document(document_json)
        result = client.opf.validate(doc)
        return json.dumps(result)

    return StructuredTool.from_function(
        name="pptx_opf_validate",
        description=(
            "Validate an OPF (Open Presentation Format) document against the "
            "pptx.dev schema. Returns JSON with `valid`, `errors`, and `warnings`. "
            "Validation is free and does not consume credits."
        ),
        func=_run,
        args_schema=_ValidateInput,
    )


def pptx_generate_tool(client: Pptx) -> StructuredTool:
    """Return a LangChain ``StructuredTool`` that submits an OPF document to
    pptx.dev for generation."""

    def _run(document_json: str, format: str = "pptx") -> str:
        doc = _parse_document(document_json)
        result = client.opf.generate(doc, format=format)  # type: ignore[arg-type]
        return json.dumps(result)

    return StructuredTool.from_function(
        name="pptx_opf_generate",
        description=(
            "Submit an OPF document to pptx.dev to generate a .pptx (or pdf/png/"
            "svg) file. Returns job metadata including slide count and validation "
            "warnings."
        ),
        func=_run,
        args_schema=_GenerateInput,
    )


def pptx_parse_slide_tool(client: Pptx) -> StructuredTool:
    """Return a LangChain ``StructuredTool`` that fetches a parsed slide by
    index. Call after uploading a .pptx to ``/v1/parse``."""

    def _run(parse_id: str, index: int) -> str:
        result = client.parse.slide(parse_id, index)
        return json.dumps(result)

    return StructuredTool.from_function(
        name="pptx_parse_slide",
        description=(
            "Read a single slide from a previously parsed .pptx file. Returns "
            "text runs, speaker notes, and slide metadata."
        ),
        func=_run,
        args_schema=_ParseSlideInput,
    )


def pptx_toolkit(client: Pptx) -> list[StructuredTool]:
    """Return the default set of pptx.dev LangChain tools."""
    return [
        pptx_validate_tool(client),
        pptx_generate_tool(client),
        pptx_parse_slide_tool(client),
    ]


__all__ = [
    "pptx_generate_tool",
    "pptx_parse_slide_tool",
    "pptx_toolkit",
    "pptx_validate_tool",
]
