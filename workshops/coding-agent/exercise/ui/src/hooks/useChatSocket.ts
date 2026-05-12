// Lazy-connecting WebSocket for /api/ws/chat. Opens on first send, retries
// every 500ms up to 60 attempts before giving up, JSON-parses incoming text
// frames, and exposes a tiny pub/sub for listeners. Binary frames pass
// through to the underlying socket untouched.

import { useCallback, useEffect, useRef } from "react";
import type { WsClientEvent, WsServerEvent } from "../lib/types";

type Listener = (event: WsServerEvent) => void;

const CONNECT_MAX_ATTEMPTS = 60;
const RECONNECT_INTERVAL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useChatSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());

  // Resolve to an open socket, opening one if needed. If a connect is
  // already in flight, piggyback on it instead of starting a second.
  const openSocketOnce = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const existing = socketRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) {
        resolve(existing);
        return;
      }
      if (existing && existing.readyState === WebSocket.CONNECTING) {
        existing.addEventListener("open", () => resolve(existing), { once: true });
        existing.addEventListener("error", () => reject(new Error("ws connect failed")), {
          once: true,
        });
        return;
      }
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${location.host}/api/ws/chat`);
      socketRef.current = ws;
      ws.addEventListener("message", (e) => {
        if (typeof e.data !== "string") return;
        try {
          const parsed = JSON.parse(e.data) as WsServerEvent;
          listenersRef.current.forEach((cb) => cb(parsed));
        } catch {
          // ignore malformed frame
        }
      });
      ws.addEventListener("open", () => resolve(ws), { once: true });
      ws.addEventListener("error", () => reject(new Error("ws connect failed")), { once: true });
      ws.addEventListener("close", () => {
        if (socketRef.current === ws) socketRef.current = null;
      });
    });
  }, []);

  // Wraps openSocketOnce in a retry loop — handy when the api process
  // hasn't bound its WS listener yet (race during `pnpm dev` startup).
  const connectWithRetry = useCallback(async (): Promise<WebSocket> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < CONNECT_MAX_ATTEMPTS; attempt++) {
      try {
        return await openSocketOnce();
      } catch (err) {
        lastErr = err;
        await sleep(RECONNECT_INTERVAL_MS);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("ws connect failed");
  }, [openSocketOnce]);

  const send = useCallback(
    async (event: WsClientEvent) => {
      const ws = await connectWithRetry();
      ws.send(JSON.stringify(event));
    },
    [connectWithRetry],
  );

  const sendBinary = useCallback(
    async (data: ArrayBuffer | Blob) => {
      const ws = await connectWithRetry();
      ws.send(data);
    },
    [connectWithRetry],
  );

  const onMessage = useCallback((cb: Listener) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
      listenersRef.current.clear();
    };
  }, []);

  return { send, sendBinary, onMessage };
}
