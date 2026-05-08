import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useChatHistory } from "../useChatHistory";
import type { Message } from "../../lib/types";

const STORAGE_KEY = "coding-agent.history.v1";

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    role: overrides.role ?? "user",
    text: overrides.text ?? "hi",
    createdAt: overrides.createdAt ?? Date.now(),
    ...overrides,
  };
}

describe("useChatHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hydrates from localStorage on mount", () => {
    const seed = [makeMsg({ id: "a", text: "hello" })];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.messages).toEqual(seed);
  });

  it("returns empty array on malformed stored payload", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.messages).toEqual([]);
  });

  it("returns empty array when stored payload is non-array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ note: "object" }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.messages).toEqual([]);
  });

  it("append persists non-pending messages and returns combined list", () => {
    const { result } = renderHook(() => useChatHistory());
    const msg = makeMsg({ id: "a", text: "hi" });
    act(() => result.current.append(msg));
    expect(result.current.messages).toEqual([msg]);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored).toEqual([msg]);
  });

  it("append filters pending messages from persisted store but keeps in state", () => {
    const { result } = renderHook(() => useChatHistory());
    const real = makeMsg({ id: "real", text: "real" });
    const pending = makeMsg({ id: "p", text: "", pending: true });
    act(() => result.current.append(real));
    act(() => result.current.append(pending));
    expect(result.current.messages).toHaveLength(2);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored).toEqual([real]);
  });

  it("append over MAX_MESSAGES triggers reset + sets wasReset", () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      // 51 messages — over MAX_MESSAGES=50
      for (let i = 0; i < 51; i++) {
        result.current.append(makeMsg({ id: `m${i}`, text: `m${i}` }));
      }
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.wasReset).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([]));
  });

  it("append over MAX_BYTES triggers reset", () => {
    const { result } = renderHook(() => useChatHistory());
    const huge = "x".repeat(70_000);
    act(() => result.current.append(makeMsg({ id: "big", text: huge })));
    expect(result.current.messages).toEqual([]);
    expect(result.current.wasReset).toBe(true);
  });

  it("update merges patch by id and persists", () => {
    const { result } = renderHook(() => useChatHistory());
    const a = makeMsg({ id: "a", text: "first" });
    const b = makeMsg({ id: "b", text: "second" });
    act(() => result.current.append(a));
    act(() => result.current.append(b));
    act(() => result.current.update("b", { text: "updated" }));
    const updated = result.current.messages.find((m) => m.id === "b");
    expect(updated?.text).toBe("updated");
  });

  it("update on missing id leaves messages unchanged", () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => result.current.append(makeMsg({ id: "a", text: "x" })));
    act(() => result.current.update("nonexistent", { text: "y" }));
    expect(result.current.messages[0]?.text).toBe("x");
  });

  it("update dropping pending flag re-persists the message", () => {
    const { result } = renderHook(() => useChatHistory());
    const pending = makeMsg({ id: "p", text: "", pending: true });
    act(() => result.current.append(pending));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([]);
    act(() => result.current.update("p", { text: "settled", pending: false }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toEqual([{ ...pending, text: "settled", pending: false }]);
  });

  it("clear empties messages and storage", () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => result.current.append(makeMsg({ id: "a" })));
    act(() => result.current.clear());
    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([]));
  });

  it("dismissReset flips wasReset back to false", () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.append(makeMsg({ id: `m${i}` }));
      }
    });
    expect(result.current.wasReset).toBe(true);
    act(() => result.current.dismissReset());
    expect(result.current.wasReset).toBe(false);
  });
});
