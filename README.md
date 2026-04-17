# TwinMind Live Suggestions

Take-home assignment. A web app that listens to live audio from the user's mic
and surfaces 3 useful suggestions every 30 seconds, with a chat column for
detailed follow-ups.

## Live demo

- App: TBD (Vercel)
- API: TBD (Railway)

## Repo

- GitHub: TBD

## Stack

- Frontend: Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui, Zustand, React Query
- Testing: Vitest with React Testing Library and jsdom (frontend), pytest (backend)
- Backend: FastAPI, Python 3.11, httpx
- Models: Groq Whisper Large V3 (transcription), Groq GPT-OSS 120B (suggestions and chat)
- Deploy: Vercel (frontend), Railway (backend)

## Setup

Frontend:

```
cd frontend
npm install
npm run dev
```

Backend:

```
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend does not hold an API key. Paste your Groq key into the Settings
page in the app. The key is sent per-request in the `x-groq-api-key` header.

## Architecture

```
Browser (Next.js)
  mic capture → MediaRecorder 30s chunks → POST /transcribe
  every 30s                              → POST /suggestions (recent transcript)
  suggestion click or typed message      → POST /chat (SSE stream)

FastAPI (stateless)
  forwards each call to Groq with the user's key from the header
```

Client holds all session state in Zustand. Backend stores nothing.

## Prompt strategy

TODO: lands in the prompt engineering pass. See `docs/prompt-strategy.md`.

## Tradeoffs and decisions

TODO.

## What I would do with more time

TODO.

## Notes on TwinMind product usage

TODO: see `docs/observations.md`.
