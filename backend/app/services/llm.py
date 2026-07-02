"""LLM provider seam (ADR-0019): messages in -> async stream of events out.

Only the chat service imports providers; routers and schemas never do.
"""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


@dataclass(frozen=True)
class Delta:
    text: str


@dataclass(frozen=True)
class Usage:
    input_tokens: int | None
    output_tokens: int | None


StreamEvent = Delta | Usage


class ProviderError(Exception):
    """Any upstream failure: network, non-200, timeout, missing key."""


class LLMProvider(Protocol):
    def stream_chat(self, messages: list[dict]) -> AsyncIterator[StreamEvent]: ...


def parse_stream_line(line: str) -> StreamEvent | None:
    """Parse one OpenAI-compatible SSE line. None = nothing usable on it.

    A chunk carrying usage is treated as usage-only (OpenRouter sends usage in
    a final chunk with an empty delta).
    """
    if not line.startswith("data: "):
        return None
    payload = line[6:].strip()
    if payload == "[DONE]":
        return None
    try:
        obj = json.loads(payload)
    except json.JSONDecodeError:
        return None
    if usage := obj.get("usage"):
        return Usage(usage.get("prompt_tokens"), usage.get("completion_tokens"))
    choices = obj.get("choices") or []
    if choices:
        text = (choices[0].get("delta") or {}).get("content")
        if text:
            return Delta(text)
    return None


class OpenRouterProvider:
    async def stream_chat(self, messages: list[dict]) -> AsyncIterator[StreamEvent]:
        if not settings.OPENROUTER_API_KEY:
            raise ProviderError("no_api_key")
        body = {
            "model": settings.LLM_MODEL,
            "messages": messages,
            "stream": True,
            "max_tokens": settings.LLM_MAX_OUTPUT_TOKENS,
            "usage": {"include": True},
        }
        headers = {"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"}
        timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", OPENROUTER_URL, json=body, headers=headers
                ) as resp:
                    if resp.status_code != 200:
                        raise ProviderError(f"status_{resp.status_code}")
                    async for line in resp.aiter_lines():
                        event = parse_stream_line(line)
                        if event is not None:
                            yield event
        except httpx.HTTPError as exc:
            raise ProviderError(str(exc)) from exc
