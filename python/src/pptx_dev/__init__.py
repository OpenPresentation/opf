"""Official Python SDK for pptx.dev.

Generate, parse, validate, convert, and render PowerPoint presentations via
the OPF (Open Presentation Format) REST API at ``https://api.pptx.dev``.

Quick start::

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
                    {"id": "h1", "type": "text", "content": {"text": "Hello"}},
                ],
            }
        ],
    })
    print(result["valid"])
"""

from __future__ import annotations

from .async_client import AsyncPptx
from .client import OPFDocumentInput, Pptx, PptxFileLike
from .errors import (
    PptxApiError,
    PptxError,
    PptxNetworkError,
    PptxRateLimitError,
    PptxValidationError,
)
from .opf import (
    OPFDesign,
    OPFDocument,
    OPFElement,
    OPFMeta,
    OPFSlide,
    OPFTextContent,
    OPFTextElement,
)

__version__ = "0.1.0"

__all__ = [
    "AsyncPptx",
    "OPFDesign",
    "OPFDocument",
    "OPFDocumentInput",
    "OPFElement",
    "OPFMeta",
    "OPFSlide",
    "OPFTextContent",
    "OPFTextElement",
    "Pptx",
    "PptxApiError",
    "PptxError",
    "PptxFileLike",
    "PptxNetworkError",
    "PptxRateLimitError",
    "PptxValidationError",
    "__version__",
]
