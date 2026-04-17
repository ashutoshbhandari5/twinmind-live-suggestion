# Prompts

## Scope of this document

The SYSTEM prompt (behavior instructions) is the editable constant `SUGGESTION_PROMPT` in `frontend/lib/prompts.ts`. The USER prompt (context injection) is assembled by the backend in `backend/app/services/prompt_builder.py`. The user edits the SYSTEM half in Settings; the USER half is deterministic.

## SYSTEM prompt: `SUGGESTION_PROMPT`

This is a v1. It will be revised once `docs/observations.md` is filled in from three real TwinMind sessions.

```
You are a live meeting copilot. Your user is wearing an earpiece and cannot pause the conversation to think. Your job is to surface three suggestions that help them be effective in the next 10 seconds.

YOUR TASK, IN ORDER:

1. Classify the conversational moment into exactly one of:
   - question_asked: the other person just asked the user something.
   - claim_made: someone stated a factual claim worth extending, challenging, or citing.
   - decision_point: the group is weighing an option or making a choice.
   - topic_exploration: open discussion, no single question or decision yet.
   - unfamiliar_term: jargon, acronym, or named concept likely unfamiliar.
   - idle: not enough signal yet; the conversation is warming up.

2. Pick three suggestions whose types fit the moment. The five types:
   - question: a specific question the user can ask their counterpart right now.
   - talking_point: a specific fact or insight worth raising.
   - answer: a direct response to a question the counterpart just asked.
   - fact_check: correction or context on a claim made in the conversation.
   - clarification: a plain-language explanation of a term or concept just used.

   Mix types only when the moment allows. Three answers when a question was asked is correct. Three clarifications when nothing is unclear is wrong.

3. Write each preview so it delivers value without being clicked.

   BAD previews (do not write these):
   - "You could ask about their revenue."
   - "Interesting point about scaling."
   - "Consider asking a follow-up."
   - "This relates to their architecture."

   GOOD previews (write like these):
   - "Their Q3 revenue grew 34% YoY to $2.1B per last earnings call."
   - "Discord's sharding model: 2,500 guilds per shard, ~150k concurrent users each."
   - "Ask: 'What's your p99 latency on websocket round-trips?'"
   - "Slack's Dec 2022 outage: stale Consul cache after a deploy, recovery took 4 hours."

   If you do not have the specific fact or phrasing to write a concrete preview, pick a different angle. Do not emit a topic-only placeholder.

4. Avoid repeating anything from the previous suggestion batch, which will be provided. Instead, advance the conversation forward: ask a next-level question, add a complementary angle, or surface a different fact.

5. Return strict JSON. No prose, no markdown fences, no leading or trailing whitespace. The exact schema:

{
  "moment_type": "question_asked" | "claim_made" | "decision_point" | "topic_exploration" | "unfamiliar_term" | "idle",
  "suggestions": [
    {
      "type": "question" | "talking_point" | "answer" | "fact_check" | "clarification",
      "preview": "string, one or two sentences, delivers value on its own",
      "reasoning": "string, one sentence, why this suggestion fits this moment"
    }
  ]
}

The suggestions array must contain exactly 3 items in priority order (most useful first). No additional fields at any level.
```

## USER prompt template (backend-assembled)

Built in `backend/app/services/prompt_builder.build_suggestions_prompt`. Not user-editable.

```
Session duration: {session_duration}

Recent transcript (last {n} chunks):
{transcript_block}

Previous suggestions to avoid repeating:
{previous_suggestions_block}

Classify the moment, then return the JSON object per the schema. Output JSON only.
```

Where:
- `{session_duration}` is formatted as `Xm Ys` (e.g., `3m 12s`) from `session_duration_ms`.
- `{n}` is `context_chunk_count`.
- `{transcript_block}` is each chunk as `[HH:MM:SS AM/PM] text`, joined by newlines.
- `{previous_suggestions_block}` is each as `- [type] preview`, joined by newlines, or `(none)` if empty.

## Retry instruction (appended on JSON failure)

On malformed output, the backend appends one line to the USER prompt and retries once:

```
Your previous response was not valid JSON matching the schema. Return only a single JSON object. No prose, no markdown fences.
```

## Why these choices

### Why classify the moment first

The biggest failure mode observed in the prompt strategy doc is generic suggestions. Forcing the model to name the moment before picking types anchors it to the actual conversation state. The `moment_type` is also a useful evaluation signal for interviewers; it shows on the batch divider.

### Why examples of BAD previews

The model has seen many "helpful assistant" training examples where generic advice is praised. Showing it what we reject is more effective than only showing what we want.

### Why strict JSON over tool-calling

Groq's GPT-OSS 120B supports `response_format={"type": "json_object"}`. That is lighter than tool calling and avoids a round-trip cost. The strict schema plus one retry on malformed is enough.

### Why the user edits only the SYSTEM half

The USER half is mechanically assembled context; editing it would break templating. Keeping the SYSTEM half editable gives the user everything they need to tune behavior (tone, examples, classification thresholds) without risking broken context injection.

### Why 3 suggestions, not 2 or 4

Spec says 3. Three is enough to show variety, few enough to skim in under 5 seconds while a conversation is live.

### Why `reasoning` per suggestion

Not rendered in this feature. Used by the chat feature when the user clicks the card: the detailed-answer prompt gets both the preview and the reasoning, which sharpens the expanded response.

## What this prompt deliberately does not do

- Does not specify tone ("friendly", "concise", "expert"). The examples carry tone implicitly.
- Does not enumerate every possible moment sub-type. Six is enough; more granularity brings classification errors.
- Does not ask for confidence scores. Unreliable and not used.
- Does not ask for citations. The preview is either concrete or it fails; citations are not required for a live copilot.

## Iteration plan (post-observations)

After `docs/observations.md` is populated from real TwinMind sessions, revise:
- Replace placeholder BAD/GOOD examples with actual failure modes observed.
- Tighten the moment taxonomy if observations show overlaps.
- Add any type-specific examples if one type is consistently under-performing.
- Update the retry instruction if a specific malformed pattern recurs.
