import { useCallback, useRef, useState } from "react";
import { useVoiceStream } from "../hooks/useVoiceStream";
import type { PendingAttachment } from "../lib/types";
import { AttachIcon } from "./AttachIcon";
import { MicIcon } from "./MicIcon";
import { SendIcon } from "./SendIcon";

type Props = {
  onUserText: (text: string) => Promise<void> | void;
  onUserAttachment: (attachment: PendingAttachment, text?: string) => Promise<void> | void;
  onError?: (message: string) => void;
};

export function Composer({ onUserText, onUserAttachment, onError }: Props) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCaptured = useCallback((blob: Blob, mimetype: string) => {
    const previewUrl = URL.createObjectURL(blob);
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return {
        kind: "audio",
        blob,
        mimetype,
        name: `recording-${Date.now()}.webm`,
        previewUrl,
      };
    });
  }, []);

  const { isRecording, start, stop } = useVoiceStream({
    onCaptured: handleCaptured,
    onError,
  });

  function clearPending() {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  }

  async function toggleMic() {
    if (isRecording) {
      await stop();
    } else {
      await start();
    }
  }

  function openImagePicker() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return {
        kind: "image",
        blob: file,
        mimetype: file.type || "application/octet-stream",
        name: file.name,
        previewUrl,
      };
    });
  }

  async function submit() {
    const trimmed = draft.trim();
    if (pending) {
      const attachment = pending;
      setPending(null);
      setDraft("");
      await onUserAttachment(attachment, trimmed || undefined);
      // ownership of previewUrl transfers to the bubble; do NOT revoke here
      return;
    }
    if (!trimmed) return;
    setDraft("");
    await onUserText(trimmed);
  }

  const canSend = !isRecording && (draft.trim().length > 0 || pending !== null);

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="attach"
        aria-label="attach image"
        disabled={isRecording}
        onClick={openImagePicker}
      >
        <AttachIcon size={22} />
      </button>
      <button
        type="button"
        className={isRecording ? "mic mic-active" : "mic"}
        aria-pressed={isRecording}
        aria-label={isRecording ? "stop recording" : "start recording"}
        onClick={() => void toggleMic()}
      >
        <MicIcon size={26} />
      </button>
      <div className="composer-main">
        {pending && (
          <div className="composer-attachment" aria-label={`attached ${pending.kind}`}>
            {pending.kind === "image" ? (
              <img
                className="composer-attachment-thumb"
                src={pending.previewUrl}
                alt="attachment"
              />
            ) : (
              <span className="composer-attachment-chip">
                <MicIcon size={14} />
                <span>voice clip ready</span>
              </span>
            )}
            <button
              type="button"
              className="composer-attachment-clear"
              aria-label="remove attachment"
              onClick={clearPending}
            >
              ×
            </button>
          </div>
        )}
        <input
          className="composer-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            isRecording
              ? "listening — click mic to stop"
              : pending
                ? "add a caption (optional)…"
                : "message Cody Rider…"
          }
          disabled={isRecording}
        />
      </div>
      <button type="submit" className="send" disabled={!canSend} aria-label="send">
        <SendIcon size={22} />
      </button>
    </form>
  );
}
