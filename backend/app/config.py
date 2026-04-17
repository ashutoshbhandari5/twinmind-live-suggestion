import os

DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"]


def allowed_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    if not raw:
        return DEFAULT_ALLOWED_ORIGINS
    return [o.strip() for o in raw.split(",") if o.strip()]


GROQ_API_BASE = "https://api.groq.com/openai/v1"
GROQ_WHISPER_MODEL = "whisper-large-v3"
GROQ_CHAT_MODEL = "openai/gpt-oss-120b"

TRANSCRIBE_TIMEOUT_SECONDS = 30.0
SUGGESTIONS_TIMEOUT_SECONDS = 15.0
CHAT_TIMEOUT_SECONDS = 60.0

API_KEY_HEADER = "x-groq-api-key"

# Whisper Large V3 fills silent or low-signal chunks with phrases scraped from
# its training data. Compared against text.strip().lower(); full-text match only
# to avoid silencing real transcription that happens to mention "thank you".
WHISPER_HALLUCINATIONS: frozenset[str] = frozenset(
    {
        "thank you.",
        "thanks for watching.",
        "thanks for watching!",
        "subtitles by the amara.org community",
        "you",
        ".",
        "",
    }
)

# Client enforces this; backend tolerates shorter but such chunks are almost
# always empty or pure hallucination after the filter runs.
MIN_CHUNK_DURATION_MS: int = 2000
