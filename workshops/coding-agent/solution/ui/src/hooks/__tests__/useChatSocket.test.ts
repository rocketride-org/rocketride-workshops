import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useChatSocket } from "../useChatSocket";
import type { WsServerEvent } from "../../lib/types";

type EventCb = (e: { data?: unknown }) => void;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  url: string;
  readyState: number = FakeWebSocket.CONNECTING;
  sent: Array<string | ArrayBuffer | Blob> = [];
  listeners: Record<string, EventCb[]> = {};

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(name: string, cb: EventCb) {
    (this.listeners[name] ||= []).push(cb);
  }

  removeEventListener(name: string, cb: EventCb) {
    this.listeners[name] = (this.listeners[name] || []).filter((l) => l !== cb);
  }

  send(data: string | ArrayBuffer | Blob) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this._fire("close", {});
  }

  _open() {
    this.readyState = FakeWebSocket.OPEN;
    this._fire("open", {});
  }

  _error() {
    this._fire("error", {});
  }

  _message(data: string) {
    this._fire("message", { data });
  }

  private _fire(name: string, e: { data?: unknown }) {
    for (const cb of this.listeners[name] || []) cb(e);
  }
}

describe("useChatSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        protocol: "http:",
        host: "localhost:5173",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("send opens socket and json-stringifies payload", async () => {
    const { result } = renderHook(() => useChatSocket());
    const promise = act(async () => {
      const p = result.current.send({ type: "text", text: "hi" });
      // open the socket immediately
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    await promise;
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].sent[0]).toBe('{"type":"text","text":"hi"}');
  });

  it("uses ws:// for http page and wss:// for https page", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { protocol: "https:", host: "example.test" },
    });
    const { result } = renderHook(() => useChatSocket());
    await act(async () => {
      const p = result.current.send({ type: "text", text: "x" });
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    expect(FakeWebSocket.instances[0].url).toBe("wss://example.test/api/ws/chat");
  });

  it("sendBinary forwards Blob/Buffer payload to underlying socket", async () => {
    const { result } = renderHook(() => useChatSocket());
    const blob = new Blob(["abc"]);
    await act(async () => {
      const p = result.current.sendBinary(blob);
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    expect(FakeWebSocket.instances[0].sent).toEqual([blob]);
  });

  it("reuses an already-open socket on subsequent sends", async () => {
    const { result } = renderHook(() => useChatSocket());
    await act(async () => {
      const p = result.current.send({ type: "text", text: "first" });
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    await act(async () => {
      await result.current.send({ type: "text", text: "second" });
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].sent).toHaveLength(2);
  });

  it("onMessage fires only on parseable JSON frames", async () => {
    const { result } = renderHook(() => useChatSocket());
    await act(async () => {
      const p = result.current.send({ type: "text", text: "x" });
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    const seen: WsServerEvent[] = [];
    act(() => {
      result.current.onMessage((e) => seen.push(e));
    });
    act(() => {
      FakeWebSocket.instances[0]._message('{"type":"reply","text":"ok"}');
      FakeWebSocket.instances[0]._message("{not json"); // dropped
      FakeWebSocket.instances[0]._message('{"type":"status","text":"thinking"}');
    });
    expect(seen).toEqual([
      { type: "reply", text: "ok" },
      { type: "status", text: "thinking" },
    ]);
  });

  it("non-string message events are ignored", async () => {
    const { result } = renderHook(() => useChatSocket());
    await act(async () => {
      const p = result.current.send({ type: "text", text: "x" });
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    const seen: WsServerEvent[] = [];
    act(() => {
      result.current.onMessage((e) => seen.push(e));
    });
    act(() => {
      // Simulate a binary frame coming back; data is not a string.
      const ws = FakeWebSocket.instances[0];
      for (const cb of ws.listeners["message"] || []) cb({ data: new ArrayBuffer(2) });
    });
    expect(seen).toEqual([]);
  });

  it("onMessage returns an unsubscribe function", async () => {
    const { result } = renderHook(() => useChatSocket());
    await act(async () => {
      const p = result.current.send({ type: "text", text: "x" });
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    const seen: WsServerEvent[] = [];
    let off!: () => void;
    act(() => {
      off = result.current.onMessage((e) => seen.push(e));
    });
    act(() => off());
    act(() => {
      FakeWebSocket.instances[0]._message('{"type":"reply","text":"ignored"}');
    });
    expect(seen).toEqual([]);
  });

  it("subsequent send after socket closes opens a new socket", async () => {
    const { result } = renderHook(() => useChatSocket());
    await act(async () => {
      const p = result.current.send({ type: "text", text: "first" });
      await Promise.resolve();
      FakeWebSocket.instances[0]._open();
      await p;
    });
    act(() => {
      FakeWebSocket.instances[0].close();
    });
    await act(async () => {
      const p = result.current.send({ type: "text", text: "after-close" });
      await Promise.resolve();
      FakeWebSocket.instances[1]._open();
      await p;
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
