import { useState } from "react";
import { useVoiceStream } from "../hooks/useVoiceStream";
import { MicIcon } from "./MicIcon";

type Props = {
  onUserText: (text: string) => Promise<void> | void;
  onUserVoice: () => void;
  onAgentReply: (text: string) => void;
  onError?: (message: string) => void;
};

export function HeroStart({ onUserText, onUserVoice, onAgentReply, onError }: Props) {
  const [draft, setDraft] = useState("");
  const { isRecording, start, stop } = useVoiceStream({
    onReply: onAgentReply,
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
      onUserVoice();
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
          disabled={isRecording}
        />
      </form>
    </section>
  );
}
