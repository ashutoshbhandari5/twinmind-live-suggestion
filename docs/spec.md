# Spec

Pulled from the TwinMind assignment PDF. Read this once. Reference as needed.

## Functional requirements

### Mic + transcript (left column)

- Start/stop mic button
- Transcript appends in chunks roughly every 30 seconds while recording
- Auto-scrolls to latest line

### Live suggestions (middle column)

- Transcript and suggestions refresh automatically every ~30 seconds
- Manual refresh button updates transcript then suggestions when tapped
- Each refresh produces exactly 3 fresh suggestions based on recent transcript
- New batch appears at top, older batches stay visible below
- Each suggestion is a tappable card with a short useful preview
- Preview alone delivers value even if not clicked
- Clicking provides more useful details
- Suggestions vary by context: question to ask, talking point, answer, fact-check, clarification
- Mix of types is encouraged when context allows

### Chat (right column)

- Clicking a suggestion adds it to the chat and returns a detailed answer
- Users can also type questions directly
- One continuous chat per session
- No login, no data persistence on reload

### Export

- Button to export full session: transcript + every suggestion batch + full chat history
- Timestamps on all items
- JSON or plain text

## Technical requirements

- Models: Groq only. Whisper Large V3 for transcription. GPT-OSS 120B for suggestions and chat.
- API key: Settings screen where user pastes their own Groq key. Never hardcode.
- Settings: editable fields for prompts (suggestion, detailed answer, chat) and context window sizes. Hardcoded optimal defaults.
- Hosting: Vercel or Railway or similar, public URL required.

## Evaluation priority (from spec)

1. Quality of live suggestions: useful, well-timed, varied by context
2. Quality of detailed chat answers when clicked
3. Prompt engineering: what context, how structured, when to surface what
4. Full-stack engineering: frontend polish, backend structure, audio chunking, API integration, error handling
5. Code quality: clean, readable, sensible abstractions, no dead code, useful README
6. Latency: reload to suggestions rendered, chat click to first token
7. Overall experience: responsive and trustworthy during real conversation

## Deliverables

- Deployed web app URL, public, working end-to-end after API key paste
- GitHub repo link with README covering setup, stack, prompt strategy, tradeoffs

## Deadline

10 days from receipt.

## Interview format

Candidate shares screen, opens deployed app, interviewers use it live during conversation.
