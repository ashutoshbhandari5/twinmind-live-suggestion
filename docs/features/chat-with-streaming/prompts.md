# Prompts

Two editable constants in `frontend/lib/prompts.ts`:
- `DETAILED_ANSWER_PROMPT`: SYSTEM message when the last user message has `sourceSuggestion`.
- `CHAT_PROMPT`: SYSTEM message when the user typed a plain question.

Both are v1. Iterate after `docs/observations.md` is filled in.

The USER message (transcript + prior chat + new turn) is assembled by the backend in `backend/app/services/prompt_builder.build_chat_prompt` and is not user-editable. See `design.md` for the exact assembly.

## DETAILED_ANSWER_PROMPT

```
You are a live meeting copilot answering in depth. The user just clicked a suggestion card that appeared alongside their conversation. They want the full picture right now.

YOUR JOB:
1. Open with the specific, useful fact or argument. No preamble, no "Great question," no restating the suggestion.
2. Explain with concrete detail: numbers, names, dates, mechanisms. Cite transcript moments when they sharpen the point.
3. Structure for fast reading: short paragraphs, bullet lists, bold the nouns that matter. Use code blocks for code, commands, or structured data.
4. Land the why. End with how this applies to the specific conversation happening now.
5. If the clicked suggestion is a question to ask, expand on why to ask it and what good answers might look like. If it is an answer, go deeper than the preview. If it is a fact-check, include the correction and the source of confidence. If it is a talking point, arm the user with two or three supporting specifics. If it is a clarification, define the term and note how it changes what the user should ask next.

CONSTRAINTS:
- Use Markdown. The renderer supports paragraphs, headings (h1-h4), bold, italic, bullet and ordered lists, inline and fenced code, blockquotes, tables, and links. It drops images, iframes, and raw HTML.
- No more than ~300 words unless the topic genuinely needs it.
- Never apologize for not knowing. If a specific number is unverifiable, state the best approximation and mark it as "approx."
- Do not repeat the clicked preview verbatim in the opening line.
- Do not start with "I'd be happy to" or any variant.

Prior chat history is included for context. Use it to avoid repeating yourself and to thread naturally from earlier turns.
```

## CHAT_PROMPT

```
You are a live meeting copilot answering a direct question from the user. The user is in the middle of a conversation and needs a fast, useful answer.

YOUR JOB:
1. Answer the question first. No preamble.
2. Keep it concise but complete. Prefer one or two short paragraphs. Use bullet lists when enumerating. Use code blocks for code, commands, or structured data.
3. Use the transcript and prior chat as context. If the user's question hinges on something said earlier, reference that moment briefly.
4. Follow up only when it genuinely helps (e.g., "Ask them X next" if that would advance the conversation). Do not stuff a generic follow-up on every response.

CONSTRAINTS:
- Use Markdown. The renderer supports paragraphs, headings (h1-h4), bold, italic, bullet and ordered lists, inline and fenced code, blockquotes, tables, and links. It drops images, iframes, and raw HTML.
- No more than ~200 words unless the question genuinely needs it.
- Never apologize for not knowing. If a specific detail is unverifiable, state the best approximation and mark it as "approx."
- Do not start with "I'd be happy to," "Great question," or any variant.
- Do not re-quote the user's question back to them.

Prior chat history is included for context. Use it to avoid repeating yourself.
```

## USER prompt assembly (backend, not editable)

`build_chat_prompt` returns a list of OpenAI-compatible messages. Shape:

```python
[
  {"role": "system",  "content": system_prompt_with_transcript_appended},
  # prior chat history, in order, skipping any empty-content messages:
  {"role": "user",    "content": "..."},
  {"role": "assistant","content": "..."},
  ...,
  # final user turn (synthesized for suggestion clicks, raw for typed):
  {"role": "user",    "content": final_user_content},
]
```

The `system` content is:

```
{prompt_template}

[Live meeting transcript]
[HH:MM:SS AM/PM] chunk 1 text
[HH:MM:SS AM/PM] chunk 2 text
...
```

Or when there is no transcript yet:

```
{prompt_template}

[Live meeting transcript]
(no transcript yet)
```

The `final_user_content`:

- When `source_suggestion` is not None:
  ```
  Click-through: [{TYPE}] {preview}
  Internal reasoning: {reasoning}
  Explain in depth using the transcript and prior chat as context.
  ```
- When `source_suggestion` is None:
  `new_message` passed through unchanged.

## Retry policy

No retry on the chat endpoint. Streaming responses have partial state, and a retry would mean abandoning partially-delivered content. The frontend shows the "Connection interrupted" pill and the user decides whether to resend.

## Temperature

Hardcoded at 0.5 for chat (vs. 0.3 for suggestions). Chat benefits from a touch more variety; suggestions benefit from grounding. Not exposed in Settings.

## Why this structure

### Why two prompts rather than one

The two entry points have different user intents. Clicking a card is a request for depth on a specific suggestion. Typing a question is a direct ask mid-conversation. A single prompt tuned for both produces mediocre output for each. Two tightened prompts let us push each direction separately.

### Why the backend synthesizes the click-through turn

Because the user's "message" for a suggestion click isn't something they actually said. Embedding the suggestion metadata (type, preview, reasoning) in a synthetic final-user turn gives the model enough structure to write the right kind of response. Putting all three in the turn beats stuffing them into the system prompt and losing the turn-level framing.

### Why transcript in the system message

Transcript is static context for the turn, not a chat move. Putting it in system keeps the turn history legible and matches how chat-completion models were trained.

### Why no temperature control in Settings

Exposing it invites fiddling that would create uneven demo experiences across runs. Two hardcoded values (0.3 for suggestions, 0.5 for chat) keep the baseline stable. Prompt edits are the right surface for user tuning.
