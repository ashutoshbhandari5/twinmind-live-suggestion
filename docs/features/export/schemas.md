# Schemas

## File format

The downloaded `.json` file conforms to this shape. Pretty-printed with 2-space indent.

```json
{
  "exportedAt": 1700000000000,
  "exportedAtReadable": "04/17/2026, 10:30:15 PM",
  "appVersion": "0.1.0",
  "sessionStartedAt": 1699999500000,
  "sessionStartedAtReadable": "04/17/2026, 10:21:40 PM",
  "sessionDurationMs": 515000,
  "note": "No session data recorded",
  "transcript": [
    {
      "id": "c_...",
      "text": "string",
      "timestamp": 1699999530000,
      "timestampReadable": "04/17/2026, 10:22:10 PM"
    }
  ],
  "suggestionBatches": [
    {
      "id": "b_...",
      "timestamp": 1699999535000,
      "timestampReadable": "04/17/2026, 10:22:15 PM",
      "momentType": "question_asked",
      "suggestions": [
        {
          "id": "s_...",
          "type": "answer",
          "preview": "string",
          "reasoning": "string"
        }
      ]
    }
  ],
  "chatMessages": [
    {
      "id": "m_...",
      "role": "user",
      "content": "string",
      "timestamp": 1699999540000,
      "timestampReadable": "04/17/2026, 10:22:20 PM",
      "sourceSuggestion": {
        "type": "answer",
        "preview": "string",
        "reasoning": "string"
      }
    }
  ]
}
```

### Field rules

- `exportedAt`: ms since epoch at the moment the user clicked Export.
- `exportedAtReadable`: same instant as a local-clock string formatted via `Intl.DateTimeFormat("en-US", {month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true})`.
- `appVersion`: hardcoded constant in `lib/export.ts`. Currently `"0.1.0"`.
- `sessionStartedAt`: snapshot of `useSessionStore.recordingStartedAt`. May be `null`.
- `sessionStartedAtReadable`: `null` when `sessionStartedAt` is `null`. Otherwise the readable string.
- `sessionDurationMs`: `0` when `sessionStartedAt` is `null`. Otherwise `exportedAt - sessionStartedAt`.
- `note`: present only when `transcript`, `suggestionBatches`, AND `chatMessages` are all empty arrays. Value is exactly `"No session data recorded"`.
- `transcript[].timestamp`, `suggestionBatches[].timestamp`, `chatMessages[].timestamp`: copied verbatim from the store.
- `transcript[].timestampReadable` etc.: derived from each `timestamp` via the same formatter.
- `chatMessages[].sourceSuggestion`: present only when set. Standard `JSON.stringify` omits `undefined` properties.
- `chatMessages[].sourceSuggestion.reasoning`: optional. Present only when the message was created after the chat feature was deployed (older suggestion clicks may lack it).

## TypeScript types

`frontend/lib/export.ts`:

```ts
export type ExportTranscriptChunk = {
  id: string;
  text: string;
  timestamp: number;
  timestampReadable: string;
};

export type ExportSuggestionBatch = {
  id: string;
  timestamp: number;
  timestampReadable: string;
  momentType: MomentType;
  suggestions: Array<{
    id: string;
    type: SuggestionType;
    preview: string;
    reasoning: string;
  }>;
};

export type ExportChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  timestampReadable: string;
  sourceSuggestion?: { type: SuggestionType; preview: string; reasoning?: string };
};

export type ExportFile = {
  exportedAt: number;
  exportedAtReadable: string;
  appVersion: string;
  sessionStartedAt: number | null;
  sessionStartedAtReadable: string | null;
  sessionDurationMs: number;
  note?: string;
  transcript: ExportTranscriptChunk[];
  suggestionBatches: ExportSuggestionBatch[];
  chatMessages: ExportChatMessage[];
};
```

## Backend changes

None. `/export` endpoint remains untouched. Existing `ExportPayload` and `ExportResponse` Pydantic models are unchanged. Nothing in this feature calls them.

## Filename schema

```
twinmind-session-YYYY-MM-DD-HHMM.json
```

- `YYYY`: 4-digit local year.
- `MM`: 2-digit local month (1-indexed, zero-padded).
- `DD`: 2-digit local day, zero-padded.
- `HH`: 2-digit local hour (24-hour clock), zero-padded.
- `MM` (final): 2-digit local minutes, zero-padded.

Examples:
- `twinmind-session-2026-04-17-2230.json` (10:30 PM, April 17, 2026)
- `twinmind-session-2026-01-03-0905.json` (9:05 AM, January 3, 2026)

Note: the first `MM` is month, the trailing `MM` is minutes. They are not confusable in the formatted filename because they sit in different positions and the surrounding digits anchor them.
