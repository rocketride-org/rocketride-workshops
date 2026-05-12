import { useEffect, useRef } from "react";
import type { Message } from "../lib/types";
import { MessageBubble, type PreviewRequest } from "./MessageBubble";

type Props = {
  messages: Message[];
  onOpenPreview?: (request: PreviewRequest) => void;
};

export function MessageList({ messages, onOpenPreview }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="message-scroll">
      <div className="message-list" role="log" aria-live="polite">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onOpenPreview={onOpenPreview} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
