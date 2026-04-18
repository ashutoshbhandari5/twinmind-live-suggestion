from collections.abc import AsyncIterator

import httpx
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest
from app.services.groq_client import GroqClient
from app.services.prompt_builder import build_chat_prompt

router = APIRouter()


def _map_status_error(err: httpx.HTTPStatusError) -> HTTPException:
    status = err.response.status_code
    if status == 401:
        return HTTPException(401, "groq rejected the request")
    if status == 413:
        return HTTPException(413, "request too large")
    if status == 429:
        return HTTPException(429, "rate limited")
    return HTTPException(502, "groq upstream failed")


@router.post("/chat")
async def chat(
    body: ChatRequest,
    x_groq_api_key: str = Header(default=""),
) -> StreamingResponse:
    if not x_groq_api_key:
        raise HTTPException(401, "missing groq key")
    if not body.prompt_template.strip():
        raise HTTPException(400, "prompt template is empty")
    if not body.new_message.strip() and body.source_suggestion is None:
        raise HTTPException(400, "new_message is empty")

    messages = build_chat_prompt(
        transcript=body.transcript,
        messages=body.messages,
        new_message=body.new_message,
        source_suggestion=body.source_suggestion,
        prompt_template=body.prompt_template,
    )

    client = GroqClient(x_groq_api_key)
    iterator = client.stream_chat(messages).__aiter__()

    # Prime the upstream so we can map open-time errors to HTTPException
    # BEFORE any response headers are sent. Once StreamingResponse starts,
    # we cannot raise an HTTPException from inside the generator.
    first: str | None
    try:
        first = await iterator.__anext__()
    except StopAsyncIteration:
        first = None
    except httpx.TimeoutException:
        raise HTTPException(504, "groq timed out") from None
    except httpx.HTTPStatusError as err:
        raise _map_status_error(err) from err
    except httpx.HTTPError:
        raise HTTPException(502, "groq upstream failed") from None

    async def gen() -> AsyncIterator[bytes]:
        if first is not None:
            yield first.encode("utf-8")
        try:
            async for token in iterator:
                yield token.encode("utf-8")
        except Exception:
            # Any error after the first token closes the stream silently.
            # The client treats early connection close as "interrupted".
            return

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")
