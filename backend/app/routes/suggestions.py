import json
import re
import time
import uuid

import httpx
from fastapi import APIRouter, Header, HTTPException

from app.models.schemas import (
    MomentType,
    Suggestion,
    SuggestionsRequest,
    SuggestionsResponse,
)
from app.services.groq_client import GroqClient
from app.services.prompt_builder import build_suggestions_prompt

router = APIRouter()

_VALID_MOMENTS: set[str] = {
    "question_asked",
    "claim_made",
    "decision_point",
    "topic_exploration",
    "unfamiliar_term",
    "idle",
}

_VALID_TYPES: set[str] = {
    "question",
    "talking_point",
    "answer",
    "fact_check",
    "clarification",
}

_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)

_RETRY_INSTRUCTION = (
    "\n\nYour previous response was not valid JSON matching the schema. "
    "Return only a single JSON object. No prose, no markdown fences."
)


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = _FENCE_PATTERN.sub("", text)
    return text.strip()


class _MalformedError(ValueError):
    """Raised when Groq returns content that does not match the schema."""


def _parse_and_validate(raw: str) -> tuple[MomentType, list[Suggestion]]:
    try:
        data = json.loads(_strip_fences(raw))
    except json.JSONDecodeError as err:
        raise _MalformedError("not valid json") from err

    if not isinstance(data, dict):
        raise _MalformedError("top level is not an object")

    moment = data.get("moment_type")
    if moment not in _VALID_MOMENTS:
        raise _MalformedError(f"bad moment_type: {moment!r}")

    suggestions_raw = data.get("suggestions")
    if not isinstance(suggestions_raw, list) or not (1 <= len(suggestions_raw) <= 3):
        raise _MalformedError("suggestions must be a list of 1 to 3 items")

    result: list[Suggestion] = []
    for item in suggestions_raw:
        if not isinstance(item, dict):
            raise _MalformedError("suggestion is not an object")
        stype = item.get("type")
        preview = item.get("preview")
        reasoning = item.get("reasoning", "")
        if stype not in _VALID_TYPES:
            raise _MalformedError(f"bad suggestion type: {stype!r}")
        if not isinstance(preview, str) or not preview.strip():
            raise _MalformedError("preview must be a non-empty string")
        if not isinstance(reasoning, str):
            raise _MalformedError("reasoning must be a string")
        result.append(
            Suggestion(
                id=f"s_{uuid.uuid4().hex[:8]}",
                type=stype,
                preview=preview.strip(),
                reasoning=reasoning.strip(),
            )
        )

    return moment, result


def _map_status_error(err: httpx.HTTPStatusError) -> HTTPException:
    status = err.response.status_code
    if status == 401:
        return HTTPException(401, "groq rejected the request")
    if status == 413:
        return HTTPException(413, "request too large")
    if status == 429:
        return HTTPException(429, "rate limited")
    return HTTPException(502, "groq upstream failed")


@router.post("/suggestions", response_model=SuggestionsResponse)
async def suggestions(
    body: SuggestionsRequest,
    x_groq_api_key: str = Header(default=""),
) -> SuggestionsResponse:
    if not x_groq_api_key:
        raise HTTPException(401, "missing groq key")
    if not body.prompt_template.strip():
        raise HTTPException(400, "prompt template is empty")
    if not body.transcript:
        raise HTTPException(400, "transcript is empty")

    # Clamp defensively. Frontend enforces [1, 50] too.
    chunk_count = max(1, min(50, body.context_chunk_count))
    recent = body.transcript[-chunk_count:]

    system, user = build_suggestions_prompt(
        transcript=recent,
        prompt_template=body.prompt_template,
        session_duration_ms=body.session_duration_ms,
        previous_suggestions=body.previous_suggestions,
    )

    client = GroqClient(x_groq_api_key)

    async def _call(user_msg: str) -> str:
        try:
            return await client.complete_json(system, user_msg)
        except httpx.TimeoutException:
            raise HTTPException(504, "groq timed out") from None
        except httpx.HTTPStatusError as err:
            raise _map_status_error(err) from err
        except httpx.HTTPError:
            raise HTTPException(502, "groq upstream failed") from None

    # Attempt 1.
    raw = await _call(user)
    try:
        moment, suggestions_list = _parse_and_validate(raw)
    except _MalformedError:
        # Attempt 2 with stricter instruction.
        raw = await _call(user + _RETRY_INSTRUCTION)
        try:
            moment, suggestions_list = _parse_and_validate(raw)
        except _MalformedError as err:
            raise HTTPException(502, "suggestions malformed") from err

    return SuggestionsResponse(
        batch_id=f"b_{uuid.uuid4().hex[:8]}",
        timestamp=int(time.time() * 1000),
        moment_type=moment,
        suggestions=suggestions_list,
    )
