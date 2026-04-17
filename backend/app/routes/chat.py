from collections.abc import AsyncIterator

from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest

router = APIRouter()


async def _mock_stream(prompt: str) -> AsyncIterator[bytes]:
    # TODO: replace with GroqClient.stream_chat in the Groq pass.
    for word in ["ok ", "(mock ", "chat ", "stream)"]:
        yield word.encode("utf-8")
    _ = prompt


@router.post("/chat")
async def chat(
    body: ChatRequest,
    x_groq_api_key: str = Header(default=""),
) -> StreamingResponse:
    _ = x_groq_api_key
    return StreamingResponse(
        _mock_stream(body.new_message),
        media_type="text/plain; charset=utf-8",
    )
