import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../lib/types";
import { MicIcon } from "./MicIcon";

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const WEEKDAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const MONTHDAY_FORMAT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const FULLDATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatTime(ms: number): string {
  const then = new Date(ms);
  const now = new Date();
  const dayDelta = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);
  const time = TIME_FORMAT.format(then);

  if (dayDelta <= 0) return time;
  if (dayDelta === 1) return `Yesterday ${time}`;
  if (dayDelta < 7) return `${WEEKDAY_FORMAT.format(then)} ${time}`;
  if (then.getFullYear() === now.getFullYear()) return `${MONTHDAY_FORMAT.format(then)} ${time}`;
  return `${FULLDATE_FORMAT.format(then)} ${time}`;
}

function Attribution({
  label,
  time,
  className,
}: {
  label: string;
  time: string;
  className: string;
}) {
  return (
    <div className={className}>
      <span className="bubble-attribution-name">{label}</span>
      <span className="bubble-attribution-time">{time}</span>
    </div>
  );
}

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
  const time = formatTime(message.createdAt);

  if (!isUser && !isVoice) {
    return (
      <>
        <div className="agent-response">
          <div className="bubble-md bubble-md-page">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        </div>
        {attributionLabel && (
          <Attribution label={attributionLabel} time={time} className={attributionClass} />
        )}
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
      {attributionLabel && (
        <Attribution label={attributionLabel} time={time} className={attributionClass} />
      )}
    </>
  );
}
