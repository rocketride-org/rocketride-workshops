// Persistent chat history backed by localStorage. Capped at 50 messages or
// 64 KB; if either cap is exceeded the history wipes itself and flips
// `wasReset` so the UI can show a banner. Pending bubbles never make it to
// disk — they're transient placeholders, not real history.

import { useCallback, useState } from "react";
import type { Message } from "../lib/types";

const STORAGE_KEY = "coding-agent.history.v1";
const MAX_MESSAGES = 50;
const MAX_BYTES = 64 * 1024;

function readHistoryFromStorage(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistoryToStorage(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore quota or unavailable storage
  }
}

function exceedsStorageLimit(messages: Message[]): boolean {
  if (messages.length > MAX_MESSAGES) return true;
  return JSON.stringify(messages).length > MAX_BYTES;
}

function persistableMessages(messages: Message[]): Message[] {
  return messages.filter((m) => !m.pending);
}

export function useChatHistory() {
  const [messages, setMessages] = useState<Message[]>(() => readHistoryFromStorage());
  const [wasReset, setWasReset] = useState(false);

  const append = useCallback((message: Message) => {
    setMessages((prev) => {
      const next = [...prev, message];
      if (exceedsStorageLimit(next)) {
        writeHistoryToStorage([]);
        setWasReset(true);
        return [];
      }
      writeHistoryToStorage(persistableMessages(next));
      return next;
    });
  }, []);

  const update = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
      writeHistoryToStorage(persistableMessages(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeHistoryToStorage([]);
    setMessages([]);
  }, []);

  const dismissReset = useCallback(() => setWasReset(false), []);

  return { messages, append, update, clear, wasReset, dismissReset };
}
