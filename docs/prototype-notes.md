# Prototype UI spec

Extracted from reference mockup screenshots. Match this layout.

## Color palette

- Background: zinc-950
- Borders: zinc-800
- Card background: zinc-900
- Text primary: zinc-100
- Text muted: zinc-500
- Mic idle: blue-500
- Mic recording: red-500 with pulse animation

## Suggestion type colors (badge + optional card border)

- question: blue
- talking_point: purple
- answer: green
- fact_check: amber
- clarification: cyan

## Layout

Top bar:

- Title left: "TwinMind — Live Suggestions"
- Right: Settings link, Export button
- (Prototype shows 3-column breadcrumbs on right, replace with functional buttons)

Three columns, equal width, vertical dividers between them.

## Column 1: Mic & Transcript

Header:

- Left: "1. MIC & TRANSCRIPT"
- Right: status "IDLE" or "• RECORDING" (red dot when recording)

Body:

- Circular mic button (blue idle, red pulsing when recording)
- Status text: "Stopped. Click to resume." or "Listening... transcript updates every 30s."
- Hint card (muted bordered box) explaining the feature
- Transcript feed: each chunk is timestamped "01:07:54 PM" in muted gray, then text
- Auto-scrolls to latest

## Column 2: Live Suggestions

Header:

- Left: "2. LIVE SUGGESTIONS"
- Right: "N BATCHES" count

Below header:

- Outlined "↻ Reload suggestions" button, top-left
- "auto-refresh in Ns" countdown on right (updates every second)

Body:

- Hint card explaining the feature
- Empty state: "Suggestions appear here once recording starts."
- Suggestion cards stacked, newest batch at top:
  - Type badge (uppercase pill, colored)
  - Preview text below badge
  - Whole card is clickable
- Batch separator: "— BATCH 1 · 01:08:04 PM —" centered, with horizontal lines

## Column 3: Chat

Header:

- Left: "3. CHAT (DETAILED ANSWERS)"
- Right: "SESSION-ONLY"

Body:

- Hint card at top
- Empty state: "Click a suggestion or type a question below."
- When populated: alternating blocks
  - YOU block: small "YOU · [TYPE]" header (or just "YOU" for typed), message in bordered card
  - ASSISTANT block: "ASSISTANT" header, response in card with markdown paragraphs
- Fixed bottom input: "Ask anything..." text field + blue "Send" button

## Interactions

- Mic button: two states, idle (solid blue) and recording (red with pulse)
- Countdown timer: updates every second, "29s → 28s → ..."
- Chat auto-scrolls to newest on new message
- Suggestion click: YOU block appears instantly, ASSISTANT streams in
- Settings and Export buttons in top bar (not in prototype, add them)

## What the prototype does NOT show

- Export button (assignment requires it, add to top bar)
- Settings page (assignment requires it, add separate route)
- Error states (API key invalid, mic blocked, Groq fail)
