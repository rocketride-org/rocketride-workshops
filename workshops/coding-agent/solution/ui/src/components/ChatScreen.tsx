import { useCallback, useEffect, useRef, useState } from "react";
import { useChatHistory } from "../hooks/useChatHistory";
import { useChatSocket } from "../hooks/useChatSocket";
import type { Message } from "../lib/types";
import { Composer } from "./Composer";
import { HeroStart } from "./HeroStart";
import { MessageList } from "./MessageList";
import { ResetBanner } from "./ResetBanner";

const WARMING_HINT = "warming up coding agent — first reply takes longer…";
const HERO_FADE_MS = 220;

type Phase = "hero" | "transitioning" | "chat";

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
  const [phase, setPhase] = useState<Phase>(() => (messages.length > 0 ? "chat" : "hero"));

  useEffect(() => {
    if (phase !== "transitioning") return;
    const id = window.setTimeout(() => setPhase("chat"), HERO_FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const handleUserText = useCallback(
    async (text: string) => {
      setPhase((prev) => (prev === "hero" ? "transitioning" : prev));
      append(userMessage(text));
      const isFirst = !hasSentRef.current;
      hasSentRef.current = true;
      const pending = pendingAgentMessage(isFirst ? WARMING_HINT : undefined);
      append(pending);

      const off = socket.onMessage((event) => {
        if (event.type === "status") {
          update(pending.id, { hint: event.text });
        } else if (event.type === "reply") {
          off();
          update(pending.id, {
            text: event.text,
            pending: false,
            hint: undefined,
            createdAt: Date.now(),
          });
        } else if (event.type === "cancelled") {
          off();
          update(pending.id, {
            text: event.reason ?? "pipeline restarted — re-send your message",
            pending: false,
            hint: undefined,
            createdAt: Date.now(),
          });
        } else if (event.type === "error") {
          off();
          update(pending.id, {
            text: `error: ${event.message}`,
            pending: false,
            hint: undefined,
            createdAt: Date.now(),
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
          createdAt: Date.now(),
        });
      }
    },
    [append, socket, update],
  );

  const handleUserVoice = useCallback(() => {
    setPhase((prev) => (prev === "hero" ? "transitioning" : prev));
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

  const screenClass =
    phase === "hero"
      ? "screen screen-hero"
      : phase === "transitioning"
        ? "screen screen-hero screen-transitioning"
        : "screen screen-chat";

  return (
    <div className={screenClass}>
      {wasReset && <ResetBanner onDismiss={dismissReset} />}
      {phase !== "chat" ? (
        <HeroStart
          onUserText={handleUserText}
          onUserVoice={handleUserVoice}
          onAgentReply={handleAgentReply}
          onError={handleError}
        />
      ) : (
        <>
          <header className="chat-header">
            <a
              className="chat-header-link"
              href="https://rocketride.ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="chat-header-powered">
                <span className="chat-header-poweredby">Powered by</span>
                <span className="chat-header-brand">RocketRide</span>
              </span>
              <img src="/rocketride-icon.svg" alt="RocketRide" />
            </a>
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
