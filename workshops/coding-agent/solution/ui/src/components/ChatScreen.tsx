import { useCallback, useRef } from "react";
import { useChatHistory } from "../hooks/useChatHistory";
import { useChatSocket } from "../hooks/useChatSocket";
import type { Message } from "../lib/types";
import { Composer } from "./Composer";
import { HeroStart } from "./HeroStart";
import { MessageList } from "./MessageList";
import { ResetBanner } from "./ResetBanner";

const WARMING_HINT = "warming up coding agent — first reply takes longer…";

function newId(): string {
  return crypto.randomUUID();
}

function userMessage(text: string): Message {
  return { id: newId(), role: "user", text, createdAt: Date.now() };
}

function agentMessage(text: string): Message {
  return { id: newId(), role: "agent", text, createdAt: Date.now() };
}

function pendingAgentMessage(hint?: string): Message {
  return { id: newId(), role: "agent", text: "", createdAt: Date.now(), pending: true, hint };
}

export function ChatScreen() {
  const { messages, append, update, wasReset, dismissReset } = useChatHistory();
  const socket = useChatSocket();
  const hasSentRef = useRef(false);

  const handleUserText = useCallback(
    async (text: string) => {
      append(userMessage(text));
      const isFirst = !hasSentRef.current;
      hasSentRef.current = true;
      const pending = pendingAgentMessage(isFirst ? WARMING_HINT : undefined);
      append(pending);

      const off = socket.onMessage((event) => {
        if (event.type === "reply") {
          off();
          update(pending.id, { text: event.text, pending: false, hint: undefined });
        } else if (event.type === "error") {
          off();
          update(pending.id, {
            text: `error: ${event.message}`,
            pending: false,
            hint: undefined,
          });
        }
      });

      try {
        await socket.send({ type: "text", text });
      } catch (err) {
        off();
        update(pending.id, {
          text: err instanceof Error ? `error: ${err.message}` : "error",
          pending: false,
          hint: undefined,
        });
      }
    },
    [append, socket, update],
  );

  const handleUserVoice = useCallback(() => {
    append({ ...userMessage("voice message"), kind: "voice" });
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
          <header className="chat-header">
            <img src="/rocketride-icon.svg" alt="RocketRide" />
            <span>Cody Rider</span>
          </header>
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
