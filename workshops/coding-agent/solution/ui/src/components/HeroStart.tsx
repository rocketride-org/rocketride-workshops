import { useCallback, useState } from "react";
import { useVoiceStream } from "../hooks/useVoiceStream";
import type { PendingAttachment } from "../lib/types";
import { MicIcon } from "./MicIcon";

type Props = {
  onUserText: (text: string) => Promise<void> | void;
  onUserAttachment: (attachment: PendingAttachment, text?: string) => Promise<void> | void;
  onError?: (message: string) => void;
  // When false, every input disables — pipeline isn't ready to accept
  // turns. Default true so callers that don't care opt in.
  pipelineReady?: boolean;
};

export function HeroStart({ onUserText, onUserAttachment, onError, pipelineReady = true }: Props) {
  const [draft, setDraft] = useState("");

  const handleCaptured = useCallback(
    (blob: Blob, mimetype: string) => {
      const previewUrl = URL.createObjectURL(blob);
      const attachment: PendingAttachment = {
        kind: "audio",
        blob,
        mimetype,
        name: `recording-${Date.now()}.webm`,
        previewUrl,
      };
      void onUserAttachment(attachment);
    },
    [onUserAttachment],
  );

  const { isRecording, start, stop } = useVoiceStream({
    onCaptured: handleCaptured,
    onError,
  });

  async function submitText() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft("");
    await onUserText(trimmed);
  }

  async function toggleMic() {
    if (isRecording) {
      await stop();
    } else {
      await start();
    }
  }

  return (
    <section className="hero">
      <div className="hero-brand">
        <img src="/rocketride-icon-dark.svg" alt="RocketRide" />
        <p className="hero-brand-name">Cody Rider</p>
      </div>
      <h1 className="hero-title">what shall we build?</h1>
      <button
        type="button"
        className={isRecording ? "hero-mic hero-mic-active" : "hero-mic"}
        aria-pressed={isRecording}
        aria-label={isRecording ? "stop recording" : "start recording"}
        disabled={!pipelineReady}
        onClick={() => void toggleMic()}
      >
        <MicIcon size={38} />
      </button>
      <p className="hero-caption">
        {isRecording ? "listening — click mic to send" : "click mic to speak · or type below"}
      </p>
      <form
        className="hero-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submitText();
        }}
      >
        <input
          className="hero-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="tell Cody Rider what to build…"
          disabled={isRecording || !pipelineReady}
        />
      </form>
    </section>
  );
}
