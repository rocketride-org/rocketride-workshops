import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../lib/types";
import { MicIcon } from "./MicIcon";

export function MessageBubble({ message }: { message: Message }) {
  const isVoice = message.kind === "voice";
  const roleClass = message.role === "user" ? "bubble-user" : "bubble-agent";
  const className = isVoice ? `bubble ${roleClass} bubble-voice` : `bubble ${roleClass}`;
  const renderMarkdown = message.role === "agent" && !isVoice;

  return (
    <div className={className}>
      {isVoice && <MicIcon size={16} />}
      {renderMarkdown ? (
        <div className="bubble-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
      ) : (
        <span>{message.text}</span>
      )}
    </div>
  );
}
