import { useState } from "react";
import { useVoiceStream } from "../hooks/useVoiceStream";

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
      <h1 className="hero-title">what shall we build?</h1>
      <button
        type="button"
        className={isRecording ? "hero-mic hero-mic-active" : "hero-mic"}
        aria-pressed={isRecording}
        aria-label={isRecording ? "stop recording" : "start recording"}
        onClick={() => void toggleMic()}
      >
        🎙
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
          placeholder="describe an app…"
          disabled={isRecording}
        />
      </form>
    </section>
  );
}
