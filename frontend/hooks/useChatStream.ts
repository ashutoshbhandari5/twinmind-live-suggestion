"use client";

import { useEffect, useRef } from "react";
import { streamChat } from "@/lib/api";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";
import type { ChatMessage } from "@/lib/types";

const FLUSH_INTERVAL_MS = 50;

// Subscribe-and-fire dispatch. Watches chatMessages.length; when the latest
// is a user message and we are not already streaming, fires the assistant
// response. lastHandledIdRef guarantees one fire per user message even
// across React Strict Mode double-invokes.
export function useChatStream(): void {
  const lastHandledIdRef = useRef<string | null>(null);
  const bufferRef = useRef<string>("");
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesLength = useSessionStore((s) => s.chatMessages.length);

  useEffect(() => {
    void maybeFire();
    // doRefresh reads stores via getState; deps are intentionally only length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLength]);

  async function maybeFire(): Promise<void> {
    const session = useSessionStore.getState();
    if (session.isStreamingChat) return;
    const last = session.chatMessages[session.chatMessages.length - 1];
    if (!last) return;
    if (last.role !== "user") return;
    if (lastHandledIdRef.current === last.id) return;

    lastHandledIdRef.current = last.id;
    await fire(last);

    // Post-stream nudge: a user message may have queued during streaming.
    // Re-check once we are idle so it does not get orphaned.
    const after = useSessionStore.getState();
    const newest = after.chatMessages[after.chatMessages.length - 1];
    if (
      newest &&
      newest.role === "user" &&
      newest.id !== lastHandledIdRef.current
    ) {
      void maybeFire();
    }
  }

  function flushFinal(assistantId: string): void {
    if (bufferRef.current.length > 0) {
      const chunk = bufferRef.current;
      bufferRef.current = "";
      useSessionStore.getState().appendChatToken(assistantId, chunk);
    }
  }

  async function fire(userMsg: ChatMessage): Promise<void> {
    const session = useSessionStore.getState();
    const settings = useSettingsStore.getState();

    session.setChatError("none");

    const isDetailed = !!userMsg.sourceSuggestion;
    const promptTemplate = isDetailed
      ? settings.detailedAnswerPrompt
      : settings.chatPrompt;
    const apiKey = settings.groqApiKey;

    if (!apiKey || !promptTemplate.trim()) {
      // Fail fast: append empty assistant + interrupted pill so the user
      // sees that something tried to happen and tells them why.
      session.addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });
      session.setChatError("interrupted");
      return;
    }

    const assistantId = crypto.randomUUID();
    session.addChatMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    });
    session.setStreamingChat(true);

    bufferRef.current = "";
    flushIntervalRef.current = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const chunk = bufferRef.current;
      bufferRef.current = "";
      useSessionStore.getState().appendChatToken(assistantId, chunk);
    }, FLUSH_INTERVAL_MS);

    try {
      const stateAtFire = useSessionStore.getState();
      const priorMessages = stateAtFire.chatMessages.filter(
        (m) => m.id !== assistantId,
      );
      const sourceSuggestion = userMsg.sourceSuggestion
        ? {
            type: userMsg.sourceSuggestion.type,
            preview: userMsg.sourceSuggestion.preview,
            reasoning: userMsg.sourceSuggestion.reasoning ?? "",
          }
        : null;

      await streamChat({
        apiKey,
        transcript: stateAtFire.transcript,
        messages: priorMessages,
        newMessage: userMsg.content,
        sourceSuggestion,
        promptTemplate,
        onToken: (tok) => {
          bufferRef.current += tok;
        },
      });
      flushFinal(assistantId);
    } catch {
      flushFinal(assistantId);
      useSessionStore.getState().setChatError("interrupted");
    } finally {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      useSessionStore.getState().setStreamingChat(false);
    }
  }
}
