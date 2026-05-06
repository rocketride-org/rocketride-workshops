import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../lib/types";
import { MicIcon } from "./MicIcon";

export function MessageBubble({ message }: { message: Message }) {
  if (message.pending) {
    return (
      <div className="agent-pending" aria-label="agent is typing">
        {message.hint && <span className="agent-pending-hint">{message.hint}</span>}
        <span className="agent-pending-dots" aria-hidden="true">
          <span className="agent-pending-dot" />
          <span className="agent-pending-dot" />
          <span className="agent-pending-dot" />
        </span>
      </div>
    );
  }

  const isVoice = message.kind === "voice";
  const isUser = message.role === "user";
  const attributionLabel = isVoice ? null : isUser ? "You" : "Cody Rider";
  const attributionClass = isUser
    ? "bubble-attribution bubble-attribution-user"
    : "bubble-attribution";

  if (!isUser && !isVoice) {
    return (
      <>
        <div className="agent-response">
          <div className="bubble-md bubble-md-page">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        </div>
        {attributionLabel && <div className={attributionClass}>{attributionLabel}</div>}
      </>
    );
  }

  const roleClass = isUser ? "bubble-user" : "bubble-agent";
  const className = isVoice ? `bubble ${roleClass} bubble-voice` : `bubble ${roleClass}`;

  return (
    <>
      <div className={className}>
        {isVoice && <MicIcon size={16} />}
        <span>{message.text}</span>
      </div>
      {attributionLabel && <div className={attributionClass}>{attributionLabel}</div>}
    </>
  );
}
