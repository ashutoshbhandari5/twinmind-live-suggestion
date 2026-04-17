import io
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.groq_client import GroqClient

client = TestClient(app)


def _audio(body: bytes = b"fake-audio-bytes") -> tuple[str, io.BytesIO, str]:
    return ("chunk.webm", io.BytesIO(body), "audio/webm")


def _status_error(code: int) -> httpx.HTTPStatusError:
    return httpx.HTTPStatusError(
        f"{code}",
        request=httpx.Request("POST", "https://api.groq.com/test"),
        response=httpx.Response(code),
    )


def test_missing_api_key_returns_401() -> None:
    response = client.post(
        "/transcribe",
        files={"file": _audio()},
        data={"duration_ms": 5000},
    )
    assert response.status_code == 401


def test_empty_audio_returns_400() -> None:
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio(b"")},
        data={"duration_ms": 5000},
    )
    assert response.status_code == 400


def test_happy_path_trims_and_echoes_duration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient,
        "transcribe",
        AsyncMock(return_value="  Hello world  "),
    )
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio()},
        data={"duration_ms": 7500},
    )
    assert response.status_code == 200
    assert response.json() == {"text": "Hello world", "duration_ms": 7500}


def test_default_duration_ms_is_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(GroqClient, "transcribe", AsyncMock(return_value="hi"))
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio()},
    )
    assert response.status_code == 200
    assert response.json() == {"text": "hi", "duration_ms": 0}


@pytest.mark.parametrize(
    "phrase",
    [
        "Thank you.",
        "THANK YOU.",
        "thank you.",
        "Thanks for watching.",
        "Thanks for watching!",
        "Subtitles by the Amara.org community",
        "subtitles by the amara.org community",
        "you",
        ".",
        "",
        "   ",
    ],
)
def test_hallucinations_are_filtered(
    monkeypatch: pytest.MonkeyPatch, phrase: str
) -> None:
    monkeypatch.setattr(GroqClient, "transcribe", AsyncMock(return_value=phrase))
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio()},
        data={"duration_ms": 5000},
    )
    assert response.status_code == 200
    assert response.json()["text"] == ""


def test_mixed_output_passes_through(monkeypatch: pytest.MonkeyPatch) -> None:
    # Precision over recall: if Whisper returns a hallucination phrase embedded
    # in real speech, we keep the whole string rather than risk silencing the
    # real content.
    monkeypatch.setattr(
        GroqClient,
        "transcribe",
        AsyncMock(return_value="Thanks for watching. Q3 numbers grew 34%."),
    )
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio()},
        data={"duration_ms": 5000},
    )
    assert response.status_code == 200
    assert response.json()["text"] == "Thanks for watching. Q3 numbers grew 34%."


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
        "transcribe",
        AsyncMock(side_effect=_status_error(upstream_code)),
    )
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio()},
        data={"duration_ms": 5000},
    )
    assert response.status_code == expected_code


def test_upstream_timeout_maps_to_504(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient,
        "transcribe",
        AsyncMock(side_effect=httpx.TimeoutException("timed out")),
    )
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio()},
        data={"duration_ms": 5000},
    )
    assert response.status_code == 504


def test_generic_http_error_maps_to_502(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        GroqClient,
        "transcribe",
        AsyncMock(side_effect=httpx.ConnectError("boom")),
    )
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": _audio()},
        data={"duration_ms": 5000},
    )
    assert response.status_code == 502


def test_content_type_is_forwarded_to_groq(monkeypatch: pytest.MonkeyPatch) -> None:
    # Safari ships audio/mp4; the upstream call must receive it, not a default.
    captured: dict[str, object] = {}

    async def fake(
        self: GroqClient, audio_bytes: bytes, filename: str, content_type: str
    ) -> str:
        captured["filename"] = filename
        captured["content_type"] = content_type
        return "hi"

    monkeypatch.setattr(GroqClient, "transcribe", fake)
    response = client.post(
        "/transcribe",
        headers={"x-groq-api-key": "sk"},
        files={"file": ("safari.mp4", io.BytesIO(b"x"), "audio/mp4")},
        data={"duration_ms": 5000},
    )
    assert response.status_code == 200
    assert captured["content_type"] == "audio/mp4"
    assert captured["filename"] == "safari.mp4"
