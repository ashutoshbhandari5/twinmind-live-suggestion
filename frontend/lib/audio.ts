// Client-side minimum to skip pointless round-trips. Anything shorter is
// almost always silence or a single filler word that Whisper hallucinates on.
export const MIN_CHUNK_DURATION_MS = 2000;

export async function startMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

export function pickRecorderMimeType(): string {
  // Ordered by preference. Chromium prefers opus; Safari only supports mp4.
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  throw new Error("No supported MediaRecorder MIME type on this browser");
}
