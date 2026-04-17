from collections.abc import AsyncIterator

import httpx

from app.config import (
    CHAT_TIMEOUT_SECONDS,
    GROQ_API_BASE,
    GROQ_CHAT_MODEL,
    GROQ_WHISPER_MODEL,
    SUGGESTIONS_TIMEOUT_SECONDS,
    TRANSCRIBE_TIMEOUT_SECONDS,
)


class GroqClient:
    """Async Groq wrapper.

    The API key is passed per-request and never stored on the instance.
    """

    def __init__(self, api_key: str) -> None:
        # Held for the lifetime of a request only. Never logged.
        self._api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"}

    async def transcribe(
        self, audio_bytes: bytes, filename: str, content_type: str
    ) -> str:
        # response_format=text is cheaper to parse than verbose_json. If we
        # later need segment timestamps, switch to verbose_json and read .text.
        async with httpx.AsyncClient(timeout=TRANSCRIBE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{GROQ_API_BASE}/audio/transcriptions",
                headers=self._headers(),
                files={"file": (filename, audio_bytes, content_type)},
                data={
                    "model": GROQ_WHISPER_MODEL,
                    "response_format": "text",
                },
            )
            response.raise_for_status()
            return response.text

    async def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        # Temperature 0.3 balances variety across batches against factual
        # grounding. Exposed-in-Settings is out of scope (see prompts.md).
        async with httpx.AsyncClient(timeout=SUGGESTIONS_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{GROQ_API_BASE}/chat/completions",
                headers={**self._headers(), "Content-Type": "application/json"},
                json={
                    "model": GROQ_CHAT_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            data = response.json()
            return str(data["choices"][0]["message"]["content"])

    async def stream_chat(
        self, system_prompt: str, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        # TODO: POST /chat/completions with stream=True, yield token deltas.
        _ = (system_prompt, messages, GROQ_CHAT_MODEL, CHAT_TIMEOUT_SECONDS, GROQ_API_BASE)
        if False:
            yield ""
        raise NotImplementedError
