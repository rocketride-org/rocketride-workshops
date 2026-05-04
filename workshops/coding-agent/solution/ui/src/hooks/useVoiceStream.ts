import { useCallback, useRef, useState } from "react";
import { useChatSocket } from "./useChatSocket";

type Options = {
  onReply: (text: string) => void;
  onError?: (message: string) => void;
};

export function useVoiceStream({ onReply, onError }: Options) {
  const socket = useChatSocket();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) {
          socket.sendBinary(e.data).catch((err: Error) => onError?.(err.message));
        }
      });
      await socket.send({ type: "start" });
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "mic error");
      releaseMic();
      setIsRecording(false);
    }
  }, [onError, releaseMic, socket]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setIsRecording(false);
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
    releaseMic();
    const off = socket.onMessage((event) => {
      if (event.type === "reply") {
        off();
        onReply(event.text);
      } else if (event.type === "error") {
        off();
        onError?.(event.message);
      }
    });
    await socket.send({ type: "end" });
  }, [onError, onReply, releaseMic, socket]);

  return { isRecording, start, stop };
}
