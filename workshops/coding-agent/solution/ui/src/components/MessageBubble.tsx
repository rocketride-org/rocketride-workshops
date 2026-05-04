import type { Message } from "../lib/types";

export function MessageBubble({ message }: { message: Message }) {
  const className = message.role === "user" ? "bubble bubble-user" : "bubble bubble-agent";
  return <div className={className}>{message.text}</div>;
}
