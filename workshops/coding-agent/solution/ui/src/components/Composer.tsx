// One submit button drives three turn shapes: text-only, attachment-only,
// or text + attachment together. Pending attachments stage locally — an
// audio recording or a picked image — until the user hits send.

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
  const [inputDraft, setInputDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCaptured = useCallback((blob: Blob, mimetype: string) => {
    const previewUrl = URL.createObjectURL(blob);
    setPendingAttachment((prev) => {
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

  function clearPendingAttachment() {
    if (pendingAttachment) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
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
    setPendingAttachment((prev) => {
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
    const trimmedText = inputDraft.trim();
    if (pendingAttachment) {
      const attachment = pendingAttachment;
      setPendingAttachment(null);
      setInputDraft("");
      // The caller takes over previewUrl ownership (it shows up in the
      // sent bubble) — we deliberately don't revoke it here.
      await onUserAttachment(attachment, trimmedText || undefined);
      return;
    }
    if (!trimmedText) return;
    setInputDraft("");
    await onUserText(trimmedText);
  }

  const canSend = !isRecording && (inputDraft.trim().length > 0 || pendingAttachment !== null);

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
        {pendingAttachment && (
          <div className="composer-attachment" aria-label={`attached ${pendingAttachment.kind}`}>
            {pendingAttachment.kind === "image" ? (
              <img
                className="composer-attachment-thumb"
                src={pendingAttachment.previewUrl}
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
              onClick={clearPendingAttachment}
            >
              ×
            </button>
          </div>
        )}
        <input
          className="composer-input"
          value={inputDraft}
          onChange={(e) => setInputDraft(e.target.value)}
          placeholder={
            isRecording
              ? "listening — click mic to stop"
              : pendingAttachment
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
