from app.models.schemas import ChatMessage, TranscriptChunk


def build_suggestions_prompt(
    transcript: list[TranscriptChunk],
    prompt_template: str,
    context_window_seconds: int,
) -> tuple[str, str]:
    # TODO: real assembly in the prompt engineering pass.
    _ = (transcript, context_window_seconds)
    return prompt_template, ""


def build_chat_prompt(
    transcript: list[TranscriptChunk],
    messages: list[ChatMessage],
    new_message: str,
    prompt_template: str,
) -> tuple[str, list[dict[str, str]]]:
    # TODO: real assembly in the prompt engineering pass.
    _ = (transcript, messages, new_message)
    return prompt_template, []
