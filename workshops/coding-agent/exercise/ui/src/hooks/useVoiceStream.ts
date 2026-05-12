import { useCallback, useRef, useState } from "react";

type Options = {
  onCaptured: (blob: Blob, mimetype: string) => void;
  onError?: (message: string) => void;
};

const AUDIO_MIMETYPE = "audio/webm;codecs=opus";

export function useVoiceStream({ onCaptured, onError }: Options) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: AUDIO_MIMETYPE });
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "mic error");
      releaseMic();
      setIsRecording(false);
    }
  }, [onError, releaseMic]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setIsRecording(false);
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
    const chunks = chunksRef.current.slice();
    releaseMic();
    if (chunks.length === 0) {
      onError?.("no audio captured");
      return;
    }
    const blob = new Blob(chunks, { type: AUDIO_MIMETYPE });
    onCaptured(blob, AUDIO_MIMETYPE);
  }, [onCaptured, onError, releaseMic]);

  return { isRecording, start, stop };
}
