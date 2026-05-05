import type { Message } from "../lib/types";
import { MicIcon } from "./MicIcon";

export function MessageBubble({ message }: { message: Message }) {
  const isVoice = message.kind === "voice";
  const roleClass = message.role === "user" ? "bubble-user" : "bubble-agent";
  const className = isVoice ? `bubble ${roleClass} bubble-voice` : `bubble ${roleClass}`;

  return (
    <div className={className}>
      {isVoice && <MicIcon size={16} />}
      <span>{message.text}</span>
    </div>
  );
}
