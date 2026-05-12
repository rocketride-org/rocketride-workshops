import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatScreen } from "../ChatScreen";

import type { WsServerEvent } from "../../lib/types";

type Listener = (event: WsServerEvent) => void;

const socketMock = {
  send: vi.fn(),
  sendBinary: vi.fn(),
  listeners: [] as Listener[],
  emit(event: WsServerEvent) {
    for (const l of this.listeners) l(event);
  },
};

vi.mock("../../hooks/useChatSocket", () => ({
  useChatSocket: () => ({
    send: socketMock.send,
    sendBinary: socketMock.sendBinary,
    onMessage: (cb: Listener) => {
      socketMock.listeners.push(cb);
      return () => {
        socketMock.listeners = socketMock.listeners.filter((l) => l !== cb);
      };
    },
  }),
}));

vi.mock("../../hooks/useVoiceStream", () => ({
  useVoiceStream: () => ({
    isRecording: false,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

beforeEach(() => {
  socketMock.send = vi.fn().mockResolvedValue(undefined);
  socketMock.sendBinary = vi.fn().mockResolvedValue(undefined);
  socketMock.listeners = [];
  localStorage.clear();
});

async function typeAndSubmit(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText(/tell Cody Rider/), text + "{Enter}");
}

describe("ChatScreen", () => {
  describe("text turn happy path", () => {
    it("dispatches WS text frame and renders pending bubble", async () => {
      render(<ChatScreen />);
      await typeAndSubmit("hello");
      expect(socketMock.send).toHaveBeenCalledWith({ type: "text", text: "hello" });
      // Pending agent bubble shows the warming hint on first turn.
      expect(await screen.findByText(/warming up coding agent/)).toBeInTheDocument();
    });

    it("status frame updates the pending hint", async () => {
      render(<ChatScreen />);
      await typeAndSubmit("hi");
      act(() => {
        socketMock.emit({ type: "status", text: "calling tool_shell" });
      });
      expect(await screen.findByText(/calling tool_shell/)).toBeInTheDocument();
    });

    it("reply frame finalizes the pending bubble with answer text", async () => {
      render(<ChatScreen />);
      await typeAndSubmit("hi");
      act(() => {
        socketMock.emit({ type: "reply", text: "the answer" });
      });
      expect(await screen.findByText("the answer")).toBeInTheDocument();
    });

    it("error frame replaces pending with error: message", async () => {
      render(<ChatScreen />);
      await typeAndSubmit("hi");
      act(() => {
        socketMock.emit({ type: "error", message: "engine bad" });
      });
      expect(await screen.findByText(/error: engine bad/)).toBeInTheDocument();
    });

    it("cancelled frame replaces pending with reset reason", async () => {
      render(<ChatScreen />);
      await typeAndSubmit("hi");
      act(() => {
        socketMock.emit({ type: "cancelled", reason: "pipeline restarted — re-send" });
      });
      expect(await screen.findByText(/pipeline restarted/)).toBeInTheDocument();
    });

    it("cancelled without reason falls back to default text", async () => {
      render(<ChatScreen />);
      await typeAndSubmit("hi");
      act(() => {
        socketMock.emit({ type: "cancelled" });
      });
      expect(
        await screen.findByText(/pipeline restarted — re-send your message/),
      ).toBeInTheDocument();
    });

    it("send rejection surfaces as error in pending bubble", async () => {
      socketMock.send = vi.fn().mockRejectedValue(new Error("ws closed"));
      render(<ChatScreen />);
      await typeAndSubmit("hi");
      expect(await screen.findByText(/error: ws closed/)).toBeInTheDocument();
    });
  });

  describe("after first turn", () => {
    it("subsequent text turn omits warming hint", async () => {
      render(<ChatScreen />);
      await typeAndSubmit("first");
      act(() => {
        socketMock.emit({ type: "reply", text: "ok" });
      });
      expect(await screen.findByText("ok")).toBeInTheDocument();
      // Now in chat phase — composer is the second textbox.
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/message Cody Rider/), "second{Enter}");
      // No warming hint appended this time.
      expect(screen.queryByText(/warming up/)).toBeNull();
    });
  });
});
