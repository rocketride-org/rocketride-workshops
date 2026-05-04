export type ChatRole = "user" | "agent";

export type Message = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
};

export type WsClientStart = { type: "start" };
export type WsClientEnd = { type: "end" };
export type WsClientEvent = WsClientStart | WsClientEnd;

export type WsServerReply = { type: "reply"; text: string };
export type WsServerError = { type: "error"; message: string };
export type WsServerEvent = WsServerReply | WsServerError;
