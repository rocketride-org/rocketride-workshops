import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../lib/types";
import { MicIcon } from "./MicIcon";

export type PreviewRequest = { kind: "image"; src: string; title?: string };

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

type Props = {
  message: Message;
  onOpenPreview?: (request: PreviewRequest) => void;
};

export function MessageBubble({ message, onOpenPreview }: Props) {
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
  const isImage = message.kind === "image";
  const isUser = message.role === "user";
  const time = formatTime(message.createdAt);

  // Agent text reply — markdown body, no attachment card.
  if (!isUser && !isVoice && !isImage) {
    return (
      <>
        <div className="agent-response">
          <div className="bubble-md bubble-md-page">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        </div>
        <Attribution label="Cody Rider" time={time} className="bubble-attribution" />
      </>
    );
  }

  const attributionClass = isUser
    ? "bubble-attribution bubble-attribution-user"
    : "bubble-attribution";
  const attributionLabel = isUser ? "You" : "Cody Rider";
  const caption = message.text?.trim() ?? "";

  // Attachment "card" — image thumb, audio player, or file chip — rendered
  // ABOVE the caption bubble. Voice now gets attribution like any other kind
  // (the card carries enough context that hiding attribution is no longer
  // useful).
  let attachmentCard: ReactNode = null;
  if (isImage && message.attachmentUrl) {
    attachmentCard = (
      <div className="attachment-card attachment-card-image" data-role={isUser ? "user" : "agent"}>
        <button
          type="button"
          className="bubble-image-button"
          aria-label={`open ${message.attachmentName ?? "image"} preview`}
          onClick={() =>
            onOpenPreview?.({
              kind: "image",
              src: message.attachmentUrl!,
              title: message.attachmentName,
            })
          }
        >
          <img
            className="bubble-image-thumb"
            src={message.attachmentUrl}
            alt={message.attachmentName ?? "image"}
          />
        </button>
      </div>
    );
  } else if (isVoice && message.attachmentUrl) {
    const displayName =
      message.attachmentName && !message.attachmentName.startsWith("recording-")
        ? message.attachmentName
        : "Voice recording";
    attachmentCard = (
      <div className="attachment-card attachment-card-audio" data-role={isUser ? "user" : "agent"}>
        <div className="attachment-card-audio-name">
          <MicIcon size={14} />
          <span>{displayName}</span>
        </div>
        <audio controls src={message.attachmentUrl} />
      </div>
    );
  }

  // Caption bubble — only when caption text is non-empty.
  // If there's no attachment card AND no caption, render a plain text bubble
  // (legacy fallback: image kind without a URL, etc.).
  const hasAttachment = attachmentCard !== null;
  const captionBubble =
    caption || !hasAttachment ? (
      <div className={`bubble ${isUser ? "bubble-user" : "bubble-agent"}`}>
        <span>{caption || message.text}</span>
      </div>
    ) : null;

  return (
    <>
      {attachmentCard}
      {captionBubble}
      <Attribution label={attributionLabel} time={time} className={attributionClass} />
    </>
  );
}
