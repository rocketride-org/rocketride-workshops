import type { Message } from "../lib/types";

// TODO: render the message text with bubble-user / bubble-agent styling.
export function MessageBubble({ message }: { message: Message }) {
  return <div className="bubble bubble-agent">TODO MessageBubble — {message.text}</div>;
}
