"""Smoke tests — no network, validates import + serialization paths."""

from __future__ import annotations

import json

import httpx
import pytest

from pptx_dev import (
    AsyncPptx,
    OPFDocument,
    Pptx,
    PptxApiError,
    PptxRateLimitError,
    PptxValidationError,
)


def _mock_transport(handler: httpx.MockTransport) -> httpx.Client:
    return httpx.Client(transport=handler, base_url="https://api.pptx.dev")


def test_package_importable_and_versioned() -> None:
    import pptx_dev

    assert pptx_dev.__version__
    assert hasattr(pptx_dev, "Pptx")
    assert hasattr(pptx_dev, "AsyncPptx")


def test_opf_document_roundtrip_camel_case() -> None:
    doc = OPFDocument.model_validate(
        {
            "$schema": "https://pptx.dev/schema/opf/v1",
            "meta": {"title": "Hello", "createdAt": "2026-01-01"},
            "design": {"theme": "corporate-minimal"},
            "slides": [
                {
                    "id": "s1",
                    "layout": "title-slide",
                    "elements": [
                        {
                            "id": "h1",
                            "type": "text",
                            "content": {"text": "Hello, world"},
                        }
                    ],
                }
            ],
        }
    )

    payload = doc.model_dump(mode="json", by_alias=True, exclude_none=True)

    assert payload["$schema"] == "https://pptx.dev/schema/opf/v1"
    assert payload["meta"]["createdAt"] == "2026-01-01"
    assert payload["slides"][0]["elements"][0]["type"] == "text"


def test_validate_happy_path() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(
            200,
            json={"valid": True, "errors": [], "warnings": []},
        )

    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport)

    pptx = Pptx(api_key="ppx_test", http_client=client)
    result = pptx.opf.validate(
        {
            "$schema": "https://pptx.dev/schema/opf/v1",
            "meta": {"title": "T"},
            "design": {},
            "slides": [],
        }
    )

    assert result["valid"] is True
    assert captured["url"] == "https://api.pptx.dev/v1/validate"
    assert captured["auth"] == "Bearer ppx_test"


def test_validation_error_raised() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            422,
            json={
                "error": {
                    "code": "invalid_request",
                    "message": "Invalid OPF document",
                    "details": {
                        "errors": [
                            {
                                "path": "$.meta.title",
                                "message": "required",
                            }
                        ]
                    },
                    "requestId": "req_body",
                },
            },
            headers={"x-request-id": "req_123"},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    pptx = Pptx(api_key="ppx_test", http_client=client)

    with pytest.raises(PptxValidationError) as exc:
        pptx.opf.generate({"meta": {}, "design": {}, "slides": []})

    assert exc.value.status == 422
    assert exc.value.code == "invalid_request"
    assert exc.value.request_id == "req_123"
    assert exc.value.validation_errors == ["$.meta.title: required"]


def test_rate_limit_error_exposes_retry_after() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            json={
                "error": {
                    "code": "rate_limited",
                    "message": "Rate limit exceeded. Retry after the window resets.",
                    "details": {"retryAfterSeconds": 42},
                    "requestId": "req_rl_body",
                },
            },
            headers={"retry-after": "42", "x-request-id": "req_rl"},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    pptx = Pptx(api_key="ppx_test", http_client=client)

    with pytest.raises(PptxRateLimitError) as exc:
        pptx.health()

    assert exc.value.retry_after_seconds == 42
    assert exc.value.code == "rate_limited"
    assert exc.value.request_id == "req_rl"


def test_generic_api_error_passthrough() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="upstream exploded")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    pptx = Pptx(api_key="ppx_test", http_client=client)

    with pytest.raises(PptxApiError) as exc:
        pptx.health()

    assert exc.value.status == 500
    assert exc.value.body == "upstream exploded"


@pytest.mark.asyncio
async def test_async_health() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "ok", "version": "1"})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler)
    ) as http_client:
        pptx = AsyncPptx(api_key="ppx_test", http_client=http_client)
        info = await pptx.health()
        assert info["status"] == "ok"


def test_file_upload_multipart() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["content_type"] = request.headers.get("content-type", "")
        captured["body_len"] = len(request.content)
        return httpx.Response(
            200,
            json={"parseId": "p_1", "slideCount": 3, "width": 960, "height": 540},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    pptx = Pptx(api_key="ppx_test", http_client=client)

    result = pptx.parse.upload(b"PK\x03\x04fakepptx", filename="demo.pptx")
    assert result["parseId"] == "p_1"
    assert "multipart/form-data" in str(captured["content_type"])
    assert isinstance(captured["body_len"], int) and captured["body_len"] > 0


def test_env_api_key_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str | None] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"status": "ok"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    monkeypatch.setenv("PPTX_API_KEY", "ppx_from_env")

    pptx = Pptx(http_client=client)
    pptx.health()
    assert captured["auth"] == "Bearer ppx_from_env"
