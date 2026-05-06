import { useState } from "react";
import { useVoiceStream } from "../hooks/useVoiceStream";
import { MicIcon } from "./MicIcon";
import { SendIcon } from "./SendIcon";

type Props = {
  onUserText: (text: string) => Promise<void> | void;
  onUserVoice: () => void;
  onAgentReply: (text: string) => void;
  onError?: (message: string) => void;
};

export function Composer({ onUserText, onUserVoice, onAgentReply, onError }: Props) {
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
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submitText();
      }}
    >
      <button
        type="button"
        className={isRecording ? "mic mic-active" : "mic"}
        aria-pressed={isRecording}
        aria-label={isRecording ? "stop recording" : "start recording"}
        onClick={() => void toggleMic()}
      >
        <MicIcon size={26} />
      </button>
      <input
        className="composer-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={isRecording ? "listening — click mic to send" : "message Cody Rider…"}
        disabled={isRecording}
      />
      <button
        type="submit"
        className="send"
        disabled={isRecording || draft.trim().length === 0}
        aria-label="send"
      >
        <SendIcon size={22} />
      </button>
    </form>
  );
}
