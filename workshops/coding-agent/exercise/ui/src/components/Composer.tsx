import { MicIcon } from "./MicIcon";
import { SendIcon } from "./SendIcon";

type Props = {
  onUserText: (text: string) => Promise<void> | void;
  onUserVoice: () => void;
  onAgentReply: (text: string) => void;
  onError?: (message: string) => void;
};

// TODO: wire up text input + send + mic toggle (start/stop voice stream).
// Append a user message via onUserText / onUserVoice, deliver agent reply via onAgentReply.
export function Composer(_props: Props) {
  return (
    <form className="composer">
      <button type="button" className="mic" disabled>
        <MicIcon size={26} />
      </button>
      <input className="composer-input" placeholder="TODO Composer — message Cody Rider" disabled />
      <button type="submit" className="send" disabled>
        <SendIcon size={22} />
      </button>
    </form>
  );
}
