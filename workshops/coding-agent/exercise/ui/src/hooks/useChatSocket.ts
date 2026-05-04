import type { WsClientEvent, WsServerEvent } from "../lib/types";

type Listener = (event: WsServerEvent) => void;

// TODO: lazy-connect to /api/ws/chat, expose send/sendBinary/onMessage,
// close on unmount. See solution for reference.
export function useChatSocket(): {
  send: (event: WsClientEvent) => Promise<void>;
  sendBinary: (data: ArrayBuffer | Blob) => Promise<void>;
  onMessage: (cb: Listener) => () => void;
} {
  return {
    send: async () => {
      throw new Error("TODO: implement useChatSocket.send");
    },
    sendBinary: async () => {
      throw new Error("TODO: implement useChatSocket.sendBinary");
    },
    onMessage: () => () => {},
  };
}
