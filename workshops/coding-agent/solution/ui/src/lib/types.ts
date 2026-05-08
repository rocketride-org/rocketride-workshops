export type ChatRole = "user" | "agent";

export type MessageKind = "text" | "voice" | "image";

export type Message = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
  kind?: MessageKind;
  pending?: boolean;
  hint?: string;
  attachmentUrl?: string;
};

export type BlobChannel = "audio" | "image";

export type WsClientText = { type: "text"; text: string };
export type WsClientBlobStart = {
  type: "blob-start";
  channel: BlobChannel;
  mimetype: string;
  name?: string;
  text?: string;
};
export type WsClientBlobEnd = { type: "blob-end" };
export type WsClientEvent = WsClientText | WsClientBlobStart | WsClientBlobEnd;

export type PendingAttachment = {
  kind: BlobChannel;
  blob: Blob;
  mimetype: string;
  name?: string;
  previewUrl: string;
};

export type WsServerStatus = { type: "status"; text: string };
export type WsServerReply = { type: "reply"; text: string };
export type WsServerError = { type: "error"; message: string };
export type WsServerCancelled = { type: "cancelled"; reason?: string };
export type WsServerEvent = WsServerStatus | WsServerReply | WsServerError | WsServerCancelled;
