# Backend

FastAPI service that proxies the browser's requests to Groq. Stateless by
design: no database, no session storage, no API key persistence.

## Stack

- FastAPI 0.115 + Uvicorn
- Python 3.11
- httpx (async) for every outbound call
- Pydantic v2 for request and response shapes
- pytest + ruff + mypy (strict)

## Run locally

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Check it is up with `curl http://localhost:8000/health`.

For test and lint tooling use the dev requirements:

```bash
pip install -r requirements-dev.txt
ruff check app
mypy app
pytest
```

## Project layout

```
backend/
├── app/
│   ├── main.py                 FastAPI app, CORS, router wiring
│   ├── config.py               model ids, timeouts, hallucination filter,
│   │                           allowed origins, header name
│   ├── routes/
│   │   ├── transcribe.py       multipart audio -> Groq Whisper
│   │   ├── suggestions.py      JSON transcript -> strict JSON (with retry)
│   │   ├── chat.py             streamed plain-text response
│   │   └── export.py           echo the session bundle as a JSON string
│   ├── services/
│   │   ├── groq_client.py      httpx client, handles auth, retries on status
│   │   └── prompt_builder.py   assembles SYSTEM + USER messages
│   └── models/
│       └── schemas.py          Pydantic request and response types
├── tests/                      pytest suite, one file per route
├── Dockerfile                  Railway deploy target
├── Procfile                    Heroku-style fallback
├── railway.toml                build + healthcheck config
├── pyproject.toml              ruff, mypy, pytest config
├── requirements.txt            runtime deps
└── requirements-dev.txt        adds pytest, mypy, ruff
```

## Environment variables

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` | Comma-separated origins for CORS. Set this to the deployed frontend URL in production. |
| `PORT` | runtime only | `8000` | Railway injects this. |

The Groq API key is **never** an environment variable on the backend. It is
sent per request by the client in the `x-groq-api-key` header. See
[`../SECURITY.md`](../SECURITY.md).

## Endpoints

All endpoints except `/health` and `/export` require the `x-groq-api-key`
header. Status codes: 400 bad input, 401 missing or invalid key, 413 too
large, 429 rate limited, 502 upstream failure, 504 timeout.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness probe. |
| POST | `/transcribe` | Transcribe one audio chunk (multipart). |
| POST | `/suggestions` | Produce a batch of 3 suggestions as strict JSON. |
| POST | `/chat` | Streamed plain-text answer for a typed question or suggestion click. |
| POST | `/export` | Echo the session bundle as a JSON string. |

Full request and response shapes: [`../README.md#api-reference`](../README.md#api-reference)
and [`app/models/schemas.py`](./app/models/schemas.py).

## Conventions

- Every function is `async`. Every outbound call uses `httpx.AsyncClient`.
- Pydantic models for request and response bodies. No ad-hoc dicts on the
  boundary.
- Errors map to `HTTPException` with generic messages. Never include the Groq
  key or raw upstream body in the error string.
- `ruff` with rules `E F I UP B`, line length 100.
- `mypy` strict.

## Testing

```bash
pytest                       # all
pytest tests/test_chat.py    # single file
pytest -k suggestions        # by keyword
```

Each route has a test file. Tests cover happy path, input validation,
upstream error mapping, and timeouts. See
[`../docs/features/`](../docs/features/) for per-feature edge case lists.

## Deployment

See [`../README.md#deployment`](../README.md#deployment). Railway builds from
the `Dockerfile` and hits `/health` for its liveness check.
