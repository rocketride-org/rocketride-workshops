import { useCallback, useState } from "react";
import type { Message } from "../lib/types";

const STORAGE_KEY = "coding-agent.history.v1";
const MAX_MESSAGES = 50;
const MAX_BYTES = 64 * 1024;

function readStored(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStored(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore quota or unavailable storage
  }
}

function exceedsCap(messages: Message[]): boolean {
  if (messages.length > MAX_MESSAGES) return true;
  return JSON.stringify(messages).length > MAX_BYTES;
}

export function useChatHistory() {
  const [messages, setMessages] = useState<Message[]>(() => readStored());
  const [wasReset, setWasReset] = useState(false);

  const append = useCallback((message: Message) => {
    setMessages((prev) => {
      const next = [...prev, message];
      if (exceedsCap(next)) {
        writeStored([]);
        setWasReset(true);
        return [];
      }
      writeStored(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeStored([]);
    setMessages([]);
  }, []);

  const dismissReset = useCallback(() => setWasReset(false), []);

  return { messages, append, clear, wasReset, dismissReset };
}
