import { useCallback, useEffect, useRef } from "react";
import type { WsClientEvent, WsServerEvent } from "../lib/types";

type Listener = (event: WsServerEvent) => void;

export function useChatSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());

  const ensureOpen = useCallback((): Promise<WebSocket> => {
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

  const send = useCallback(
    async (event: WsClientEvent) => {
      const ws = await ensureOpen();
      ws.send(JSON.stringify(event));
    },
    [ensureOpen],
  );

  const sendBinary = useCallback(
    async (data: ArrayBuffer | Blob) => {
      const ws = await ensureOpen();
      ws.send(data);
    },
    [ensureOpen],
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
