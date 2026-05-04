import type { Message } from "../lib/types";
import { MessageBubble } from "./MessageBubble";

// TODO: render all messages and auto-scroll to the bottom on new messages.
export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="message-list">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  );
}
