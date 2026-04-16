# Prompt strategy

This is the primary evaluation criterion. Fill this in AFTER using TwinMind product and observing live suggestions.

## Principles

1. **Classify the moment before generating.** Force the model to decide what is happening in the conversation right now (question asked, claim made, topic shift, decision point, idle) before choosing suggestion types.
2. **Previews deliver value unclicked.** The single most common failure mode is generic previews. Every preview must pass the "would I click or ignore?" test.
3. **Mix types when the moment allows, not when it does not.** If a question was just asked, 3 answers can be right. If the conversation is exploring a topic, mix question + talking_point + fact_check.
4. **Strict JSON output.** Retry on malformed once, then fail gracefully.

## Context windows

- Suggestions: last 90 seconds of transcript + rolling summary (regenerated every 2-3 min when session > 5 min)
- Detailed answer: full transcript (configurable to windowed)
- Chat: full transcript + full chat history

## Suggestion types

- `question`: proactive question user can ask their counterpart
- `talking_point`: specific fact or insight to raise
- `answer`: response to a question the counterpart just asked
- `fact_check`: correction or context on a claim made in the conversation
- `clarification`: simpler explanation of a term or concept mentioned

## Preview quality bar

BAD: "You could ask about their revenue."
GOOD: "Their Q3 revenue grew 34% YoY to $2.1B per last earnings call."

BAD: "Interesting point about scaling."
GOOD: "Discord's sharding model: 2,500 guilds per shard, ~150k concurrent users each."

BAD: "Consider asking a follow-up."
GOOD: "Ask: 'What's your p99 latency on websocket round-trips?'"

## Failure modes to prevent (fill after product usage)

Observations from using TwinMind's live suggestions feature:

1. [Failure mode observed] → [Prompt rule to prevent it]
2. ...
3. ...

## Suggestion prompt skeleton

```
SYSTEM:
You are a conversation copilot assisting someone in a live meeting.
Surface 3 suggestions that help them be more effective right now.

CONTEXT:
- Session started: {session_duration} ago
- Recent transcript (last {window}s): {recent_transcript}
- Earlier summary: {rolling_summary}

TASK:
1. Identify the conversational moment:
   - Question asked → answer it
   - Claim made → fact-check or add context
   - Decision point → surface tradeoffs
   - Topic exploration → questions or talking points
   - Unfamiliar term → clarify

2. Generate 3 suggestions. Mix types when the moment allows.

3. Each suggestion:
   - type: one of [question, talking_point, answer, fact_check, clarification]
   - preview: 1-2 sentences, delivers value on its own
   - reasoning: one line, why this suggestion fits this moment

OUTPUT (strict JSON):
{
  "moment_type": "...",
  "suggestions": [
    { "type": "...", "preview": "...", "reasoning": "..." }
  ]
}
```

## Detailed answer prompt skeleton

```
SYSTEM:
You are a knowledgeable colleague helping with a conversation in progress.
The user clicked a suggestion. Answer it in depth using the transcript for context.

CONTEXT:
- Full transcript: {transcript}
- Clicked suggestion: {suggestion}

TASK:
Provide a detailed, useful answer. Markdown formatting. Cite relevant moments from the transcript when it sharpens your answer.
```

## Chat prompt skeleton

```
SYSTEM:
You are an assistant helping during a live conversation.
The user has typed a direct question.

CONTEXT:
- Full transcript: {transcript}
- Chat history: {messages}
- New question: {new_message}

TASK:
Answer directly. Reference the transcript when relevant.
```

## Tradeoffs to document in README

- Why 90s context window for suggestions and not 60 or 120
- Why rolling summary kicks in at 5 min
- Why full transcript for detailed answers
- Why retry-once on malformed JSON vs more attempts
- Why strict JSON over freeform text
