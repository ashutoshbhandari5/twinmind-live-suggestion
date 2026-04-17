import json
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.groq_client import GroqClient

client = TestClient(app)


def _valid_payload() -> dict[str, Any]:
    return {
        "transcript": [
            {"id": "c_1", "text": "Let's talk about scaling.", "timestamp": 0},
            {"id": "c_2", "text": "What's your p99 latency?", "timestamp": 1},
        ],
        "prompt_template": "You are a meeting copilot.",
        "context_chunk_count": 3,
        "session_duration_ms": 60000,
        "previous_suggestions": [],
    }


def _valid_groq_json(moment: str = "question_asked") -> str:
    return json.dumps(
        {
            "moment_type": moment,
            "suggestions": [
                {
                    "type": "answer",
                    "preview": "Our p99 is 120ms on websockets.",
                    "reasoning": "directly answers the question",
                },
                {
                    "type": "question",
                    "preview": "Ask: what's your fanout pattern?",
                    "reasoning": "natural follow-up",
                },
                {
                    "type": "talking_point",
                    "preview": "Discord shards by guild ID at 2500/shard.",
                    "reasoning": "concrete reference they can use",
                },
            ],
        }
    )


def _status_error(code: int) -> httpx.HTTPStatusError:
    return httpx.HTTPStatusError(
        f"{code}",
        request=httpx.Request("POST", "https://api.groq.com/test"),
        response=httpx.Response(code),
    )


def test_missing_api_key_returns_401() -> None:
    response = client.post("/suggestions", json=_valid_payload())
    assert response.status_code == 401


def test_empty_prompt_returns_400(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=_valid_groq_json())
    )
    payload = _valid_payload()
    payload["prompt_template"] = ""
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=payload,
    )
    assert response.status_code == 400


def test_whitespace_only_prompt_returns_400(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=_valid_groq_json())
    )
    payload = _valid_payload()
    payload["prompt_template"] = "   \n\t  "
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=payload,
    )
    assert response.status_code == 400


def test_empty_transcript_returns_400(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=_valid_groq_json())
    )
    payload = _valid_payload()
    payload["transcript"] = []
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=payload,
    )
    assert response.status_code == 400


def test_happy_path_parses_valid_json(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=_valid_groq_json())
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["moment_type"] == "question_asked"
    assert len(body["suggestions"]) == 3
    assert body["suggestions"][0]["type"] == "answer"
    assert body["suggestions"][0]["preview"] == "Our p99 is 120ms on websockets."
    assert body["batch_id"].startswith("b_")
    assert body["suggestions"][0]["id"].startswith("s_")
    assert isinstance(body["timestamp"], int)


def test_markdown_fenced_json_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    fenced = f"```json\n{_valid_groq_json()}\n```"
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=fenced)
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200


def test_unfenced_prefix_also_works(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient,
        "complete_json",
        AsyncMock(return_value=f"```\n{_valid_groq_json()}\n```"),
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200


def test_malformed_json_retries_and_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(side_effect=["not json at all", _valid_groq_json()])
    monkeypatch.setattr(GroqClient, "complete_json", mock)
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    assert mock.await_count == 2


def test_malformed_json_twice_returns_502(monkeypatch: pytest.MonkeyPatch) -> None:
    mock = AsyncMock(side_effect=["not json", "still not json"])
    monkeypatch.setattr(GroqClient, "complete_json", mock)
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 502
    assert mock.await_count == 2


@pytest.mark.parametrize(
    "bad_moment",
    ["other", "", "QUESTION_ASKED", "unknown", None],
)
def test_invalid_moment_type_counts_as_malformed(
    monkeypatch: pytest.MonkeyPatch, bad_moment: Any
) -> None:
    bad = json.dumps(
        {
            "moment_type": bad_moment,
            "suggestions": [
                {"type": "answer", "preview": "p", "reasoning": "r"},
            ],
        }
    )
    mock = AsyncMock(side_effect=[bad, bad])
    monkeypatch.setattr(GroqClient, "complete_json", mock)
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 502


@pytest.mark.parametrize("count", [0, 4, 5, 10])
def test_wrong_suggestion_count_is_malformed(
    monkeypatch: pytest.MonkeyPatch, count: int
) -> None:
    bad = json.dumps(
        {
            "moment_type": "idle",
            "suggestions": [
                {"type": "answer", "preview": "p", "reasoning": "r"}
                for _ in range(count)
            ],
        }
    )
    mock = AsyncMock(side_effect=[bad, bad])
    monkeypatch.setattr(GroqClient, "complete_json", mock)
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 502


def test_one_or_two_suggestions_is_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    one = json.dumps(
        {
            "moment_type": "idle",
            "suggestions": [
                {"type": "answer", "preview": "p", "reasoning": "r"},
            ],
        }
    )
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=one)
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    assert len(response.json()["suggestions"]) == 1


def test_invalid_suggestion_type_is_malformed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bad = json.dumps(
        {
            "moment_type": "idle",
            "suggestions": [
                {"type": "recommendation", "preview": "p", "reasoning": "r"},
            ],
        }
    )
    mock = AsyncMock(side_effect=[bad, bad])
    monkeypatch.setattr(GroqClient, "complete_json", mock)
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 502


def test_empty_preview_is_malformed(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = json.dumps(
        {
            "moment_type": "idle",
            "suggestions": [
                {"type": "answer", "preview": "", "reasoning": "r"},
            ],
        }
    )
    mock = AsyncMock(side_effect=[bad, bad])
    monkeypatch.setattr(GroqClient, "complete_json", mock)
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 502


def test_missing_reasoning_defaults_to_empty_string(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    minimal = json.dumps(
        {
            "moment_type": "idle",
            "suggestions": [
                {"type": "answer", "preview": "ok"},
            ],
        }
    )
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=minimal)
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 200
    assert response.json()["suggestions"][0]["reasoning"] == ""


def test_context_chunk_count_clamps_low(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Zero or negative clamps to 1 (route defensive behavior).
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=_valid_groq_json())
    )
    payload = _valid_payload()
    payload["context_chunk_count"] = 0
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=payload,
    )
    assert response.status_code == 200


def test_context_chunk_count_clamps_high(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        GroqClient, "complete_json", AsyncMock(return_value=_valid_groq_json())
    )
    payload = _valid_payload()
    payload["context_chunk_count"] = 10_000
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=payload,
    )
    assert response.status_code == 200


@pytest.mark.parametrize(
    "upstream_code,expected_code",
    [
        (401, 401),
        (413, 413),
        (429, 429),
        (500, 502),
        (502, 502),
        (503, 502),
    ],
)
def test_upstream_status_errors_map_correctly(
    monkeypatch: pytest.MonkeyPatch, upstream_code: int, expected_code: int
) -> None:
    monkeypatch.setattr(
        GroqClient,
        "complete_json",
        AsyncMock(side_effect=_status_error(upstream_code)),
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == expected_code


def test_upstream_timeout_maps_to_504(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient,
        "complete_json",
        AsyncMock(side_effect=httpx.TimeoutException("timed out")),
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 504


def test_generic_http_error_maps_to_502(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient,
        "complete_json",
        AsyncMock(side_effect=httpx.ConnectError("boom")),
    )
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=_valid_payload(),
    )
    assert response.status_code == 502


def test_previous_suggestions_are_passed_to_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Verify the user prompt includes the previous-batch block. We capture the
    # user message passed to complete_json and inspect it.
    captured: dict[str, str] = {}

    async def fake(self: GroqClient, system: str, user: str) -> str:
        captured["system"] = system
        captured["user"] = user
        return _valid_groq_json()

    monkeypatch.setattr(GroqClient, "complete_json", fake)
    payload = _valid_payload()
    payload["previous_suggestions"] = [
        {"type": "answer", "preview": "our p99 is 120ms"},
    ]
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=payload,
    )
    assert response.status_code == 200
    assert "our p99 is 120ms" in captured["user"]
    assert "Previous suggestions" in captured["user"]


def test_session_duration_formatted_in_user_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    async def fake(self: GroqClient, system: str, user: str) -> str:
        captured["user"] = user
        return _valid_groq_json()

    monkeypatch.setattr(GroqClient, "complete_json", fake)
    payload = _valid_payload()
    payload["session_duration_ms"] = 3 * 60_000 + 12_000
    response = client.post(
        "/suggestions",
        headers={"x-groq-api-key": "sk"},
        json=payload,
    )
    assert response.status_code == 200
    assert "3m 12s" in captured["user"]
