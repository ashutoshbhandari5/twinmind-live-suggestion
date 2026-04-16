from fastapi import APIRouter, File, Header, UploadFile

from app.models.schemas import TranscribeResponse

router = APIRouter()


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    x_groq_api_key: str = Header(default=""),
) -> TranscribeResponse:
    # TODO: call Groq Whisper Large V3 via GroqClient.transcribe in the Groq pass.
    _ = (file, x_groq_api_key)
    return TranscribeResponse(text="", duration_ms=0)
