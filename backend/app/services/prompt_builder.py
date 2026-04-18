from datetime import UTC, datetime

from app.models.schemas import (
    ChatMessage,
    ChatRequestSourceSuggestion,
    PreviousSuggestion,
    TranscriptChunk,
)


def _format_duration(ms: int) -> str:
    total_seconds = max(0, ms // 1000)
    minutes, seconds = divmod(total_seconds, 60)
    return f"{minutes}m {seconds}s"


def _format_clock(ms: int) -> str:
    # UTC is fine for the USER prompt; the model only uses these for ordering.
    dt = datetime.fromtimestamp(ms / 1000, tz=UTC)
    return dt.strftime("%I:%M:%S %p")


def _transcript_block(transcript: list[TranscriptChunk]) -> str:
    if not transcript:
        return "(no transcript yet)"
    return "\n".join(
        f"[{_format_clock(c.timestamp)}] {c.text}" for c in transcript
    )


def build_suggestions_prompt(
    transcript: list[TranscriptChunk],
    prompt_template: str,
    session_duration_ms: int,
    previous_suggestions: list[PreviousSuggestion],
) -> tuple[str, str]:
    transcript_block = _transcript_block(transcript)

    prev_block = (
        "\n".join(f"- [{s.type}] {s.preview}" for s in previous_suggestions)
        if previous_suggestions
        else "(none)"
    )

    user_prompt = (
        f"Session duration: {_format_duration(session_duration_ms)}\n"
        f"\n"
        f"Recent transcript:\n{transcript_block}\n"
        f"\n"
        f"Previous suggestions to avoid repeating:\n{prev_block}\n"
        f"\n"
        f"Classify the moment, then return the JSON object per the schema. "
        f"Output JSON only."
    )
    return prompt_template, user_prompt


def build_chat_prompt(
    transcript: list[TranscriptChunk],
    messages: list[ChatMessage],
    new_message: str,
    source_suggestion: ChatRequestSourceSuggestion | None,
    prompt_template: str,
) -> list[dict[str, str]]:
    """Assemble OpenAI-compatible chat messages for Groq.

    Transcript lives in the system message (static context). Prior chat
    history is sent as real turns. The final user turn is synthesized for
    suggestion clicks; raw new_message otherwise.
    """
    system = (
        f"{prompt_template}\n\n"
        f"[Live meeting transcript]\n"
        f"{_transcript_block(transcript)}"
    )

    out: list[dict[str, str]] = [{"role": "system", "content": system}]

    for m in messages:
        if not m.content.strip():
            # Skip the placeholder assistant bubble or any empty turn.
            continue
        out.append({"role": m.role, "content": m.content})

    if source_suggestion is not None:
        final_content = (
            f"Click-through: [{source_suggestion.type}] "
            f"{source_suggestion.preview}\n"
            f"Internal reasoning: {source_suggestion.reasoning}\n"
            f"Explain in depth using the transcript and prior chat as context."
        )
    else:
        final_content = new_message

    out.append({"role": "user", "content": final_content})
    return out
