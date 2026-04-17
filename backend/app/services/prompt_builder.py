from datetime import UTC, datetime

from app.models.schemas import (
    ChatMessage,
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


def build_suggestions_prompt(
    transcript: list[TranscriptChunk],
    prompt_template: str,
    session_duration_ms: int,
    previous_suggestions: list[PreviousSuggestion],
) -> tuple[str, str]:
    transcript_block = "\n".join(
        f"[{_format_clock(c.timestamp)}] {c.text}" for c in transcript
    ) or "(no transcript yet)"

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
    prompt_template: str,
) -> tuple[str, list[dict[str, str]]]:
    # TODO: real assembly in the chat feature.
    _ = (transcript, messages, new_message)
    return prompt_template, []
