export type ChatRole = "user" | "agent";

// "text"  — plain text-only bubble (default).
// "voice" — audio attachment (server side: BlobChannel "audio").
// "image" — image attachment.
// Each user message is text-only OR attachment-only; never both.
export type MessageKind = "text" | "voice" | "image";

export type Message = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
  kind?: MessageKind;
  pending?: boolean;
  hint?: string;
  // Object URL of the picked attachment (ephemeral, dies on reload).
  attachmentUrl?: string;
  // Display label for the attachment card.
  attachmentName?: string;
  attachmentMimetype?: string;
};

// Server-side blob channels — must match the API's accepted set.
export type BlobChannel = "audio" | "image";

// Client-side attachment kinds. Currently identical to BlobChannel — text
// attachments are not supported (typed messages and binary attachments are
// mutually exclusive per turn).
export type AttachmentKind = BlobChannel;

export type WsClientText = { type: "text"; text: string };
export type WsClientBlobStart = {
  type: "blob-start";
  channel: BlobChannel;
  mimetype: string;
  name?: string;
};
export type WsClientBlobEnd = { type: "blob-end" };
export type WsClientEvent = WsClientText | WsClientBlobStart | WsClientBlobEnd;

export type PendingAttachment = {
  kind: AttachmentKind;
  blob: Blob;
  mimetype: string;
  name?: string;
  // Object URL for image previews (image + audio both populate this).
  previewUrl?: string;
};

export type WsServerStatus = { type: "status"; text: string };
export type WsServerReply = { type: "reply"; text: string };
export type WsServerError = { type: "error"; message: string };
export type WsServerCancelled = { type: "cancelled"; reason?: string };
export type WsServerEvent = WsServerStatus | WsServerReply | WsServerError | WsServerCancelled;
