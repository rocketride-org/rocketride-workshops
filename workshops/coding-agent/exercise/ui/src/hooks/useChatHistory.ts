import type { Message } from "../lib/types";

// TODO: persist messages to localStorage with a hard cap (50 messages or ~64KB).
// On overflow, clear and surface wasReset = true so the UI can show a banner.
// See solution for reference.
export function useChatHistory(): {
  messages: Message[];
  append: (message: Message) => void;
  clear: () => void;
  wasReset: boolean;
  dismissReset: () => void;
} {
  return {
    messages: [],
    append: () => {
      throw new Error("TODO: implement useChatHistory.append");
    },
    clear: () => {
      throw new Error("TODO: implement useChatHistory.clear");
    },
    wasReset: false,
    dismissReset: () => {},
  };
}
