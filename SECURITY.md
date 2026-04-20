# Security policy

This app processes microphone audio, transcripts, and a user-supplied Groq API
key. The policy below describes how each of those is handled, what the backend
stores, and how to report an issue.

## Data handling

### Groq API key

- The key is pasted into the in-app Settings page.
- It is persisted only in the browser, via `zustand/middleware/persist` backed
  by `localStorage`, so it survives a refresh on the same device.
- On every outbound call it is attached as a request header,
  `x-groq-api-key: <key>`.
- The backend reads the header, forwards it to Groq, and drops it. The key is
  never stored, cached, logged, or echoed in a response body.
- The key is never written to error messages. Backend errors return generic
  strings (`groq rejected the request`, `rate limited`, `groq upstream failed`).

If you rotate your Groq key, clear the Settings field and the app stops using
the old one on the next request.

### Microphone audio

- Audio is captured in the browser via `MediaRecorder` as short WebM chunks
  (default 30 seconds).
- Each chunk is uploaded to `POST /transcribe`, forwarded to Groq, and the
  server-side buffer is released as soon as the Groq call returns.
- The backend does not write chunks to disk. It does not keep an in-memory
  cache of prior chunks. Each request stands alone.

### Transcript, suggestions, chat history

- All three live in a Zustand store in the browser. The store is persisted to
  `localStorage` so you can refresh without losing the session.
- The backend is stateless. It reads what the client sends on each call and
  returns a response. It does not maintain per-user state.
- "Clear session" in the UI wipes the Zustand store for that device.

### Logging

The backend does not log request bodies, headers, or response bodies. Only
standard FastAPI and Uvicorn access logs are emitted. Those contain path,
status code, and latency. No transcript text, no suggestion text, no API key.

## Threat model and what this project does not defend against

- **Shared-device risk.** `localStorage` means anyone with access to the same
  browser profile can read the key. Use a dedicated profile for demos.
- **Network observer on plaintext HTTP.** Use HTTPS in production. The Vercel
  and Railway defaults provide this.
- **Compromised Groq credentials.** This app does not rate-limit, monitor, or
  alert on unusual usage of your key. Rotate your key if you suspect leakage.
- **Multi-user isolation.** This is a single-user demo app. There are no
  accounts, sessions, or permissions on the backend.

## Reporting a vulnerability

Open a GitHub issue with the `security` label, or email the repo owner. Please
do not include your real Groq API key in the report; a redacted key prefix
(`gsk_...`) and a reproduction are enough.
