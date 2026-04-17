import { useRef } from "react";
import { toast } from "sonner";
import { transcribeAudio } from "@/lib/api";
import {
  MIN_CHUNK_DURATION_MS,
  pickRecorderMimeType,
  startMicStream,
} from "@/lib/audio";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";

const CHUNK_INTERVAL_MS = 30_000;
const RETRY_DELAY_MS = 500;
const MAX_CONSECUTIVE_FAILURES = 3;

export type RecorderHandle = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  flushNow: () => Promise<void>;
};

export function useRecorder(): RecorderHandle {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkStartRef = useRef<number>(0);
  const failureCountRef = useRef<number>(0);
  const mimeRef = useRef<string>("");
  const isStartingRef = useRef<boolean>(false);

  function closeRecorderForBlob(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(new Blob([], { type: mimeRef.current }));
        return;
      }
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        resolve(new Blob(chunks, { type: mimeRef.current }));
      };
      try {
        rec.stop();
      } catch {
        resolve(new Blob(chunks, { type: mimeRef.current }));
      }
    });
  }

  function openRecorder(): void {
    const stream = streamRef.current;
    if (!stream) return;
    const rec = new MediaRecorder(stream, { mimeType: mimeRef.current });
    recorderRef.current = rec;
    chunkStartRef.current = Date.now();
    rec.start();
  }

  function releaseStream(): void {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    recorderRef.current = null;
  }

  function clearRotationInterval(): void {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function postChunk(blob: Blob, durationMs: number): Promise<void> {
    if (blob.size === 0 || durationMs < MIN_CHUNK_DURATION_MS) return;
    const apiKey = useSettingsStore.getState().groqApiKey;
    if (!apiKey) return;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await transcribeAudio({
          apiKey,
          audio: blob,
          durationMs,
        });
        if (result.text.length > 0) {
          useSessionStore.getState().addTranscriptChunk({
            id: crypto.randomUUID(),
            text: result.text,
            timestamp: Date.now(),
          });
        }
        failureCountRef.current = 0;
        return;
      } catch {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }

    failureCountRef.current += 1;
    toast.error(
      "Failed to transcribe last 30 seconds. Check connection or key.",
    );

    // Only auto-stop if recording is still active. Final-chunk failures
    // during a voluntary stop must not flip us into the error state.
    const stillRecording = useSessionStore.getState().isRecording;
    if (stillRecording && failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
      clearRotationInterval();
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {
        /* already stopped */
      }
      releaseStream();
      useSessionStore.getState().stopRecording();
      useSessionStore.getState().setRecorderError("auto-stopped");
    }
  }

  async function rotate(): Promise<void> {
    const blob = await closeRecorderForBlob();
    const durationMs = Date.now() - chunkStartRef.current;
    // Start the next chunk immediately so the recording gap at the boundary
    // stays in the tens of milliseconds, not a full round-trip.
    if (useSessionStore.getState().isRecording) {
      openRecorder();
    }
    await postChunk(blob, durationMs);
  }

  async function start(): Promise<void> {
    if (isStartingRef.current || useSessionStore.getState().isRecording) return;
    isStartingRef.current = true;
    try {
      const apiKey = useSettingsStore.getState().groqApiKey;
      if (!apiKey) {
        toast.error("Add your Groq API key in Settings to start recording.");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await startMicStream();
      } catch {
        useSessionStore.getState().setMicPermission("denied");
        toast.error(
          "Microphone access denied. Enable it in browser settings.",
        );
        return;
      }

      streamRef.current = stream;
      try {
        mimeRef.current = pickRecorderMimeType();
      } catch {
        releaseStream();
        toast.error("This browser does not support audio recording.");
        return;
      }

      failureCountRef.current = 0;
      useSessionStore.getState().setMicPermission("granted");
      useSessionStore.getState().setRecorderError("none");
      useSessionStore.getState().startRecording();
      openRecorder();
      intervalRef.current = setInterval(() => {
        void rotate();
      }, CHUNK_INTERVAL_MS);
    } finally {
      isStartingRef.current = false;
    }
  }

  async function stop(): Promise<void> {
    if (!useSessionStore.getState().isRecording) return;
    clearRotationInterval();
    // Mark stopped first so any in-flight rotate() sees the flag and avoids
    // opening a new recorder behind us.
    useSessionStore.getState().stopRecording();
    const blob = await closeRecorderForBlob();
    const durationMs = Date.now() - chunkStartRef.current;
    releaseStream();
    await postChunk(blob, durationMs);
  }

  // Close the current chunk early, open a fresh recorder, and post the chunk.
  // Used by the live-suggestions manual refresh so we can surface the
  // freshest possible transcript before asking for a new batch.
  async function flushNow(): Promise<void> {
    if (!useSessionStore.getState().isRecording) return;
    clearRotationInterval();
    const blob = await closeRecorderForBlob();
    const durationMs = Date.now() - chunkStartRef.current;
    if (useSessionStore.getState().isRecording) {
      openRecorder();
      intervalRef.current = setInterval(() => {
        void rotate();
      }, CHUNK_INTERVAL_MS);
    }
    await postChunk(blob, durationMs);
  }

  return { start, stop, flushNow };
}
