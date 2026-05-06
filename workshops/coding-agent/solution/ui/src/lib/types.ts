export type ChatRole = "user" | "agent";

export type MessageKind = "text" | "voice";

export type Message = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
  kind?: MessageKind;
  pending?: boolean;
  hint?: string;
};

export type WsClientStart = { type: "start" };
export type WsClientEnd = { type: "end" };
export type WsClientText = { type: "text"; text: string };
export type WsClientEvent = WsClientStart | WsClientEnd | WsClientText;

export type WsServerStatus = { type: "status"; text: string };
export type WsServerReply = { type: "reply"; text: string };
export type WsServerError = { type: "error"; message: string };
export type WsServerEvent = WsServerStatus | WsServerReply | WsServerError;
