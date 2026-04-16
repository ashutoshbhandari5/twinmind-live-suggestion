from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import API_KEY_HEADER, allowed_origins
from app.routes import chat, export, suggestions, transcribe

app = FastAPI(title="TwinMind Live Suggestions")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", API_KEY_HEADER],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(transcribe.router)
app.include_router(suggestions.router)
app.include_router(chat.router)
app.include_router(export.router)
