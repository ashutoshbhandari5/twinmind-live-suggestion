from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.groq_client import GroqClient

client = TestClient(app)


def _valid_payload() -> dict[str, Any]:
    return {
        "transcript": [
            {"id": "c_1", "text": "Let's scale this.", "timestamp": 0}
        ],
        "messages": [],
        "new_message": "What is your p99 latency?",
        "source_suggestion": None,
        "prompt_template": "You are a meeting copilot.",
    }


def _suggestion_payload() -> dict[str, Any]:
    p = _valid_payload()
    p["new_message"] = ""
    p["source_suggestion"] = {
        "type": "answer",
        "preview": "Our p99 is 120ms.",
        "reasoning": "directly addresses the question",
    }
    return p


def _stream_yielding(tokens: list[str]):
    async def gen(self: GroqClient, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        for t in tokens:
            yield t
        _ = messages

    return gen


def _stream_raises_on_open(exc: Exception):
    async def gen(self: GroqClient, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        raise exc
        yield  # makes this an async generator

    return gen


def _stream_raises_after_first(exc: Exception):
    async def gen(self: GroqClient, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        yield "first"
        raise exc

    return gen


def _status_error(code: int) -> httpx.HTTPStatusError:
    return httpx.HTTPStatusError(
        f"{code}",
        request=httpx.Request("POST", "https://api.groq.com/test"),
        response=httpx.Response(code),
    )


def test_missing_key_returns_401() -> None:
    response = client.post("/chat", json=_valid_payload())
    assert response.status_code == 401


def test_empty_prompt_returns_400() -> None:
    payload = _valid_payload()
    payload["prompt_template"] = ""
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=payload
    )
    assert response.status_code == 400


def test_whitespace_only_prompt_returns_400() -> None:
    payload = _valid_payload()
    payload["prompt_template"] = "   \n  "
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=payload
    )
    assert response.status_code == 400


def test_empty_new_message_no_source_returns_400() -> None:
    payload = _valid_payload()
    payload["new_message"] = ""
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=payload
    )
    assert response.status_code == 400


def test_empty_new_message_with_source_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(GroqClient, "stream_chat", _stream_yielding(["hi"]))
    response = client.post(
        "/chat",
        headers={"x-groq-api-key": "sk"},
        json=_suggestion_payload(),
    )
    assert response.status_code == 200
    assert response.text == "hi"


def test_happy_path_streams_concatenated_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        GroqClient, "stream_chat", _stream_yielding(["Hello", " ", "world"])
    )
    response = client.post(
        "/chat",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    assert response.text == "Hello world"
    assert response.headers["content-type"].startswith("text/plain")


def test_empty_stream_returns_200_with_empty_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(GroqClient, "stream_chat", _stream_yielding([]))
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=_valid_payload()
    )
    assert response.status_code == 200
    assert response.text == ""


@pytest.mark.parametrize(
    "code,expected",
    [(401, 401), (413, 413), (429, 429), (500, 502), (502, 502), (503, 502)],
)
def test_open_time_status_errors_map(
    monkeypatch: pytest.MonkeyPatch, code: int, expected: int
) -> None:
    monkeypatch.setattr(
        GroqClient,
        "stream_chat",
        _stream_raises_on_open(_status_error(code)),
    )
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=_valid_payload()
    )
    assert response.status_code == expected


def test_open_time_timeout_maps_to_504(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient,
        "stream_chat",
        _stream_raises_on_open(httpx.TimeoutException("timed out")),
    )
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=_valid_payload()
    )
    assert response.status_code == 504


def test_open_time_generic_error_maps_to_502(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        GroqClient,
        "stream_chat",
        _stream_raises_on_open(httpx.ConnectError("boom")),
    )
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=_valid_payload()
    )
    assert response.status_code == 502


def test_mid_stream_error_silently_closes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Errors after the first token close the stream silently. The client
    detects early connection close and shows the interrupted pill."""
    monkeypatch.setattr(
        GroqClient,
        "stream_chat",
        _stream_raises_after_first(httpx.ConnectError("late boom")),
    )
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=_valid_payload()
    )
    assert response.status_code == 200
    assert response.text == "first"


def test_source_suggestion_synthesizes_user_turn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, list[dict[str, str]]] = {}

    async def fake(
        self: GroqClient, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        captured["messages"] = messages
        yield "ok"

    monkeypatch.setattr(GroqClient, "stream_chat", fake)
    response = client.post(
        "/chat",
        headers={"x-groq-api-key": "sk"},
        json=_suggestion_payload(),
    )
    assert response.status_code == 200
    last = captured["messages"][-1]
    assert last["role"] == "user"
    assert "Click-through:" in last["content"]
    assert "Our p99 is 120ms." in last["content"]
    assert "directly addresses the question" in last["content"]


def test_typed_message_uses_new_message_verbatim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, list[dict[str, str]]] = {}

    async def fake(
        self: GroqClient, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        captured["messages"] = messages
        yield "ok"

    monkeypatch.setattr(GroqClient, "stream_chat", fake)
    response = client.post(
        "/chat",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    last = captured["messages"][-1]
    assert last["role"] == "user"
    assert last["content"] == "What is your p99 latency?"


def test_transcript_appears_in_system_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, list[dict[str, str]]] = {}

    async def fake(
        self: GroqClient, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        captured["messages"] = messages
        yield "ok"

    monkeypatch.setattr(GroqClient, "stream_chat", fake)
    response = client.post(
        "/chat",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    system = captured["messages"][0]
    assert system["role"] == "system"
    assert "Live meeting transcript" in system["content"]
    assert "Let's scale this." in system["content"]


def test_no_transcript_uses_placeholder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, list[dict[str, str]]] = {}

    async def fake(
        self: GroqClient, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        captured["messages"] = messages
        yield "ok"

    monkeypatch.setattr(GroqClient, "stream_chat", fake)
    payload = _valid_payload()
    payload["transcript"] = []
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=payload
    )
    assert response.status_code == 200
    assert "(no transcript yet)" in captured["messages"][0]["content"]


def test_prior_chat_history_passed_as_turns(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, list[dict[str, str]]] = {}

    async def fake(
        self: GroqClient, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        captured["messages"] = messages
        yield "ok"

    monkeypatch.setattr(GroqClient, "stream_chat", fake)
    payload = _valid_payload()
    payload["messages"] = [
        {
            "id": "m1",
            "role": "user",
            "content": "earlier q",
            "timestamp": 0,
        },
        {
            "id": "m2",
            "role": "assistant",
            "content": "earlier a",
            "timestamp": 1,
        },
    ]
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=payload
    )
    assert response.status_code == 200
    msgs = captured["messages"]
    # System + 2 prior + 1 final
    assert len(msgs) == 4
    assert msgs[1] == {"role": "user", "content": "earlier q"}
    assert msgs[2] == {"role": "assistant", "content": "earlier a"}


def test_empty_content_messages_are_skipped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, list[dict[str, str]]] = {}

    async def fake(
        self: GroqClient, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        captured["messages"] = messages
        yield "ok"

    monkeypatch.setattr(GroqClient, "stream_chat", fake)
    payload = _valid_payload()
    payload["messages"] = [
        {"id": "m1", "role": "user", "content": "earlier q", "timestamp": 0},
        {"id": "m2", "role": "assistant", "content": "", "timestamp": 1},
        {"id": "m3", "role": "assistant", "content": "  ", "timestamp": 2},
    ]
    response = client.post(
        "/chat", headers={"x-groq-api-key": "sk"}, json=payload
    )
    assert response.status_code == 200
    msgs = captured["messages"]
    # System + 1 non-empty prior + final = 3
    assert len(msgs) == 3
