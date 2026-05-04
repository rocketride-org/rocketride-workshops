import { useCallback } from "react";
import { useChatHistory } from "../hooks/useChatHistory";
import { sendChatText } from "../lib/api";
import type { Message } from "../lib/types";
import { Composer } from "./Composer";
import { HeroStart } from "./HeroStart";
import { MessageList } from "./MessageList";
import { ResetBanner } from "./ResetBanner";

function newId(): string {
  return crypto.randomUUID();
}

function userMessage(text: string): Message {
  return { id: newId(), role: "user", text, createdAt: Date.now() };
}

function agentMessage(text: string): Message {
  return { id: newId(), role: "agent", text, createdAt: Date.now() };
}

export function ChatScreen() {
  const { messages, append, wasReset, dismissReset } = useChatHistory();

  const handleUserText = useCallback(
    async (text: string) => {
      append(userMessage(text));
      try {
        const reply = await sendChatText(text);
        append(agentMessage(reply));
      } catch (err) {
        append(agentMessage(err instanceof Error ? `error: ${err.message}` : "error"));
      }
    },
    [append],
  );

  const handleUserVoice = useCallback(() => {
    append(userMessage("🎙 voice message"));
  }, [append]);

  const handleAgentReply = useCallback(
    (text: string) => {
      append(agentMessage(text));
    },
    [append],
  );

  const handleError = useCallback(
    (message: string) => {
      append(agentMessage(`error: ${message}`));
    },
    [append],
  );

  const isEmpty = messages.length === 0;

  return (
    <div className={isEmpty ? "screen screen-hero" : "screen screen-chat"}>
      {wasReset && <ResetBanner onDismiss={dismissReset} />}
      {isEmpty ? (
        <HeroStart
          onUserText={handleUserText}
          onUserVoice={handleUserVoice}
          onAgentReply={handleAgentReply}
          onError={handleError}
        />
      ) : (
        <>
          <header className="chat-header">coding-agent</header>
          <MessageList messages={messages} />
          <Composer
            onUserText={handleUserText}
            onUserVoice={handleUserVoice}
            onAgentReply={handleAgentReply}
            onError={handleError}
          />
        </>
      )}
    </div>
  );
}
