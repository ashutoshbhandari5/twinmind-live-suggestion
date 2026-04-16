import time
import uuid

from fastapi import APIRouter, Header

from app.models.schemas import Suggestion, SuggestionsRequest, SuggestionsResponse

router = APIRouter()


@router.post("/suggestions", response_model=SuggestionsResponse)
async def suggestions(
    body: SuggestionsRequest,
    x_groq_api_key: str = Header(default=""),
) -> SuggestionsResponse:
    # TODO: assemble prompt, call Groq GPT-OSS 120B, parse JSON in the Groq pass.
    _ = (body, x_groq_api_key)
    now_ms = int(time.time() * 1000)
    mock = [
        Suggestion(
            id=f"s_{uuid.uuid4().hex[:8]}",
            type="question",
            preview="mock preview 1",
            reasoning="mock reasoning",
        ),
        Suggestion(
            id=f"s_{uuid.uuid4().hex[:8]}",
            type="talking_point",
            preview="mock preview 2",
            reasoning="mock reasoning",
        ),
        Suggestion(
            id=f"s_{uuid.uuid4().hex[:8]}",
            type="fact_check",
            preview="mock preview 3",
            reasoning="mock reasoning",
        ),
    ]
    return SuggestionsResponse(
        batch_id=f"b_{uuid.uuid4().hex[:8]}", timestamp=now_ms, suggestions=mock
    )
