import { useEffect } from "react";
import { toast } from "sonner";
import { transcribeAudio } from "@/lib/api";
import {
  MIN_CHUNK_DURATION_MS,
  pickRecorderMimeType,
  startMicStream,
} from "@/lib/audio";
import { useSessionStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";

// Chunk interval is user-tunable via Settings.refreshIntervalSeconds. We clamp
// to MIN to stay safely above the 2s hallucination-filter floor in lib/audio,
// and to MAX to avoid absurdly long chunks that would make Whisper struggle.
const MIN_CHUNK_INTERVAL_MS = 5_000;
const MAX_CHUNK_INTERVAL_MS = 120_000;
const DEFAULT_CHUNK_INTERVAL_MS = 30_000;
const RETRY_DELAY_MS = 500;
const MAX_CONSECUTIVE_FAILURES = 3;

function chunkIntervalMs(): number {
  const raw = useSettingsStore.getState().refreshIntervalSeconds;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_CHUNK_INTERVAL_MS;
  }
  return Math.max(MIN_CHUNK_INTERVAL_MS, Math.min(MAX_CHUNK_INTERVAL_MS, raw * 1000));
}

export type RecorderHandle = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  flushNow: () => Promise<void>;
  getChunkStart: () => number | null;
};

// Module-level singleton state. Recorder lifecycle outlives any single React
// component instance, so navigating between routes (Home → Settings → Home)
// does not orphan the MediaRecorder or reset the chunk-start anchor that
// drives the suggestions countdown.
const state = {
  stream: null as MediaStream | null,
  recorder: null as MediaRecorder | null,
  timeout: null as ReturnType<typeof setTimeout> | null,
  chunkStart: 0,
  failureCount: 0,
  mime: "",
  isStarting: false,
  // Last interval we've actually scheduled against. Used to no-op the
  // reschedule effect on remounts where the setting has not changed.
  lastAppliedIntervalMs: 0,
};

function closeRecorderForBlob(): Promise<Blob> {
  return new Promise((resolve) => {
    const rec = state.recorder;
    if (!rec || rec.state === "inactive") {
      resolve(new Blob([], { type: state.mime }));
      return;
    }
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      resolve(new Blob(chunks, { type: state.mime }));
    };
    try {
      rec.stop();
    } catch {
      resolve(new Blob(chunks, { type: state.mime }));
    }
  });
}

function openRecorder(): void {
  const stream = state.stream;
  if (!stream) return;
  const rec = new MediaRecorder(stream, { mimeType: state.mime });
  state.recorder = rec;
  state.chunkStart = Date.now();
  rec.start();
}

function releaseStream(): void {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
  }
  state.stream = null;
  state.recorder = null;
}

function clearRotationInterval(): void {
  if (state.timeout !== null) {
    clearTimeout(state.timeout);
    state.timeout = null;
  }
}

function scheduleNextRotation(): void {
  const intervalMs = chunkIntervalMs();
  state.lastAppliedIntervalMs = intervalMs;
  state.timeout = setTimeout(() => {
    void (async () => {
      await rotate();
      if (useSessionStore.getState().isRecording) {
        scheduleNextRotation();
      }
    })();
  }, intervalMs);
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
      state.failureCount = 0;
      return;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  state.failureCount += 1;
  toast.error(
    "Failed to transcribe last 30 seconds. Check connection or key.",
  );

  // Only auto-stop if recording is still active. Final-chunk failures
  // during a voluntary stop must not flip us into the error state.
  const stillRecording = useSessionStore.getState().isRecording;
  if (stillRecording && state.failureCount >= MAX_CONSECUTIVE_FAILURES) {
    clearRotationInterval();
    try {
      if (state.recorder && state.recorder.state !== "inactive") {
        state.recorder.stop();
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
  const durationMs = Date.now() - state.chunkStart;
  // Start the next chunk immediately so the recording gap at the boundary
  // stays in the tens of milliseconds, not a full round-trip.
  if (useSessionStore.getState().isRecording) {
    openRecorder();
  }
  await postChunk(blob, durationMs);
}

async function start(): Promise<void> {
  if (state.isStarting || useSessionStore.getState().isRecording) return;
  state.isStarting = true;
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

    state.stream = stream;
    try {
      state.mime = pickRecorderMimeType();
    } catch {
      releaseStream();
      toast.error("This browser does not support audio recording.");
      return;
    }

    state.failureCount = 0;
    useSessionStore.getState().setMicPermission("granted");
    useSessionStore.getState().setRecorderError("none");
    useSessionStore.getState().startRecording();
    openRecorder();
    scheduleNextRotation();
  } finally {
    state.isStarting = false;
  }
}

async function stop(): Promise<void> {
  if (!useSessionStore.getState().isRecording) return;
  clearRotationInterval();
  // Mark stopped first so any in-flight rotate() sees the flag and avoids
  // opening a new recorder behind us.
  useSessionStore.getState().stopRecording();
  const blob = await closeRecorderForBlob();
  const durationMs = Date.now() - state.chunkStart;
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
  const durationMs = Date.now() - state.chunkStart;
  if (useSessionStore.getState().isRecording) {
    openRecorder();
    scheduleNextRotation();
  }
  await postChunk(blob, durationMs);
}

function getChunkStart(): number | null {
  // Anchor for the suggestions countdown. Only valid while recording; the
  // module retains the last value across stop/start otherwise.
  return useSessionStore.getState().isRecording ? state.chunkStart : null;
}

// Stable handle. Same identity across remounts so downstream effects keyed on
// recorder identity do not needlessly re-run.
const handle: RecorderHandle = { start, stop, flushNow, getChunkStart };

export function useRecorder(): RecorderHandle {
  // React to mid-session changes to refreshIntervalSeconds. Without this the
  // currently-scheduled timeout would still fire at the old interval; each
  // rotation re-reads the new value only on the _next_ schedule. The
  // lastAppliedIntervalMs guard prevents re-entrant reschedules on harmless
  // remounts (e.g. navigating back to Home after Settings).
  const refreshIntervalSeconds = useSettingsStore(
    (s) => s.refreshIntervalSeconds,
  );
  useEffect(() => {
    if (!useSessionStore.getState().isRecording) return;
    const newIntervalMs = chunkIntervalMs();
    if (newIntervalMs === state.lastAppliedIntervalMs) return;

    const elapsed = Date.now() - state.chunkStart;
    clearRotationInterval();
    state.lastAppliedIntervalMs = newIntervalMs;
    if (elapsed >= newIntervalMs) {
      // The new window has already elapsed. Rotate now, then resume the
      // normal self-rescheduling cadence at the new interval.
      void (async () => {
        await rotate();
        if (useSessionStore.getState().isRecording) {
          scheduleNextRotation();
        }
      })();
    } else {
      // Still inside the new window. Reschedule the pending rotation to
      // fire at chunkStart + newInterval.
      state.timeout = setTimeout(() => {
        void (async () => {
          await rotate();
          if (useSessionStore.getState().isRecording) {
            scheduleNextRotation();
          }
        })();
      }, newIntervalMs - elapsed);
    }
  }, [refreshIntervalSeconds]);

  return handle;
}
