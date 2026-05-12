// One submit button drives two turn shapes: text-only or attachment-only.
// Text and attachments are mutually exclusive per message — typing
// disables the attach/mic buttons, and a pending attachment disables the
// text input. Pending attachments stage locally (audio recording or
// picked image/audio file) until the user hits send.

import { useCallback, useRef, useState } from "react";
import { useVoiceStream } from "../hooks/useVoiceStream";
import type { PendingAttachment } from "../lib/types";
import { AttachIcon } from "./AttachIcon";
import { MicIcon } from "./MicIcon";
import { SendIcon } from "./SendIcon";

type Props = {
  onUserText: (text: string) => Promise<void> | void;
  onUserAttachment: (attachment: PendingAttachment) => Promise<void> | void;
  onError?: (message: string) => void;
};

export function Composer({ onUserText, onUserAttachment, onError }: Props) {
  const [inputDraft, setInputDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCaptured = useCallback((blob: Blob, mimetype: string) => {
    const previewUrl = URL.createObjectURL(blob);
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
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
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
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

  function fileExt(file: File): string {
    return file.name.toLowerCase().split(".").pop() ?? "";
  }

  function isImageFile(file: File): boolean {
    if (file.type.startsWith("image/")) return true;
    // Fallback by extension when MIME is missing or non-standard.
    return ["svg", "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif"].includes(
      fileExt(file),
    );
  }

  function isAudioFile(file: File): boolean {
    if (file.type.startsWith("audio/")) return true;
    return ["mp3", "wav", "m4a", "ogg", "oga", "opus", "flac", "aac", "webm"].includes(
      fileExt(file),
    );
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (isAudioFile(file)) {
      const previewUrl = URL.createObjectURL(file);
      setPendingAttachment((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return {
          kind: "audio",
          blob: file,
          mimetype: file.type || "audio/webm",
          name: file.name,
          previewUrl,
        };
      });
      return;
    }

    if (isImageFile(file)) {
      const previewUrl = URL.createObjectURL(file);
      const isSvg = fileExt(file) === "svg" || file.type === "image/svg+xml";
      const mimetype = file.type || (isSvg ? "image/svg+xml" : "application/octet-stream");
      setPendingAttachment((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return {
          kind: "image",
          blob: file,
          mimetype,
          name: file.name,
          previewUrl,
        };
      });
      return;
    }

    onError?.(`unsupported file type: ${file.type || file.name}`);
  }

  async function submit() {
    if (pendingAttachment) {
      const attachment = pendingAttachment;
      setPendingAttachment(null);
      // Caller takes over previewUrl ownership (shows up in the sent bubble);
      // we deliberately don't revoke it here.
      await onUserAttachment(attachment);
      return;
    }
    const trimmedText = inputDraft.trim();
    if (!trimmedText) return;
    setInputDraft("");
    await onUserText(trimmedText);
  }

  // Mutex: an attachment and typed text are mutually exclusive per message.
  // Server-side path can't carry both, so the composer locks one out as soon
  // as the other becomes non-empty.
  const hasText = inputDraft.trim().length > 0;
  const hasAttachment = pendingAttachment !== null;
  const canSend = !isRecording && (hasText || hasAttachment);
  const attachLocked = isRecording || hasText;
  const inputLocked = isRecording || hasAttachment;

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
        accept="image/*,audio/*,.svg,.png,.jpg,.jpeg,.gif,.webp,.bmp,.ico,.avif,.mp3,.wav,.m4a,.ogg,.oga,.opus,.flac,.aac,.webm"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="attach"
        aria-label="attach file"
        disabled={attachLocked}
        onClick={openImagePicker}
      >
        <AttachIcon size={22} />
      </button>
      <button
        type="button"
        className={isRecording ? "mic mic-active" : "mic"}
        aria-pressed={isRecording}
        aria-label={isRecording ? "stop recording" : "start recording"}
        disabled={hasText && !isRecording}
        onClick={() => void toggleMic()}
      >
        <MicIcon size={26} />
      </button>
      <div className="composer-main">
        {pendingAttachment && (
          <div className="composer-attachment" aria-label={`attached ${pendingAttachment.kind}`}>
            {pendingAttachment.kind === "image" && pendingAttachment.previewUrl ? (
              <img
                className="composer-attachment-thumb"
                src={pendingAttachment.previewUrl}
                alt="attachment"
              />
            ) : (
              <span className="composer-attachment-chip">
                <MicIcon size={14} />
                <span>
                  {pendingAttachment.name && !pendingAttachment.name.startsWith("recording-")
                    ? pendingAttachment.name
                    : "voice clip ready"}
                </span>
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
                ? "clear the attachment to type a message"
                : "message Cody Rider…"
          }
          disabled={inputLocked}
        />
      </div>
      <button type="submit" className="send" disabled={!canSend} aria-label="send">
        <SendIcon size={22} />
      </button>
    </form>
  );
}
