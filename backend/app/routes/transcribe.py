import httpx
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from app.config import WHISPER_HALLUCINATIONS
from app.models.schemas import TranscribeResponse
from app.services.groq_client import GroqClient

router = APIRouter()


def _map_status_error(err: httpx.HTTPStatusError) -> HTTPException:
    status = err.response.status_code
    if status == 401:
        return HTTPException(401, "groq rejected the request")
    if status == 413:
        return HTTPException(413, "audio too large")
    if status == 429:
        return HTTPException(429, "rate limited")
    return HTTPException(502, "groq upstream failed")


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    duration_ms: int = Form(0),
    x_groq_api_key: str = Header(default=""),
) -> TranscribeResponse:
    if not x_groq_api_key:
        raise HTTPException(401, "missing groq key")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "empty audio file")

    client = GroqClient(x_groq_api_key)
    try:
        raw = await client.transcribe(
            audio_bytes,
            file.filename or "chunk.webm",
            file.content_type or "audio/webm",
        )
    except httpx.TimeoutException:
        raise HTTPException(504, "groq timed out") from None
    except httpx.HTTPStatusError as err:
        raise _map_status_error(err) from err
    except httpx.HTTPError:
        raise HTTPException(502, "groq upstream failed") from None

    trimmed = raw.strip()
    filtered = "" if trimmed.lower() in WHISPER_HALLUCINATIONS else trimmed
    # duration_ms is echoed from the client. Trusted; backend does not decode.
    return TranscribeResponse(text=filtered, duration_ms=duration_ms)
