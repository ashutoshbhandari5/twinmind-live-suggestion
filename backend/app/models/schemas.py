from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SuggestionType = Literal[
    "question", "talking_point", "answer", "fact_check", "clarification"
]

MomentType = Literal[
    "question_asked",
    "claim_made",
    "decision_point",
    "topic_exploration",
    "unfamiliar_term",
    "idle",
]


class TranscriptChunk(BaseModel):
    id: str
    text: str
    timestamp: int


class Suggestion(BaseModel):
    id: str
    type: SuggestionType
    preview: str
    reasoning: str


class PreviousSuggestion(BaseModel):
    type: SuggestionType
    preview: str


class SuggestionBatch(BaseModel):
    id: str
    timestamp: int
    moment_type: MomentType
    suggestions: list[Suggestion]


class ChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    timestamp: int
    sourceSuggestion: dict[str, str] | None = None


class TranscribeResponse(BaseModel):
    text: str
    duration_ms: int


class SuggestionsRequest(BaseModel):
    transcript: list[TranscriptChunk] = Field(default_factory=list)
    prompt_template: str = ""
    context_chunk_count: int = 3
    session_duration_ms: int = 0
    previous_suggestions: list[PreviousSuggestion] = Field(default_factory=list)


class SuggestionsResponse(BaseModel):
    batch_id: str
    timestamp: int
    moment_type: MomentType
    suggestions: list[Suggestion]


class ChatRequestSourceSuggestion(BaseModel):
    type: SuggestionType
    preview: str
    reasoning: str = ""


class ChatRequest(BaseModel):
    transcript: list[TranscriptChunk] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)
    new_message: str = ""
    source_suggestion: ChatRequestSourceSuggestion | None = None
    prompt_template: str = ""


class ExportRequest(BaseModel):
    transcript: list[TranscriptChunk] = Field(default_factory=list)
    suggestionBatches: list[SuggestionBatch] = Field(default_factory=list)
    chatMessages: list[ChatMessage] = Field(default_factory=list)
    sessionStartedAt: int | None = None


class ExportResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    payload: str = Field(serialization_alias="json")
