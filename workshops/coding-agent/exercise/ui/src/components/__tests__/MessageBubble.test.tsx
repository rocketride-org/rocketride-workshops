import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MessageBubble } from "../MessageBubble";
import type { Message } from "../../lib/types";

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: "id",
    role: "user",
    text: "hello",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("MessageBubble", () => {
  beforeEach(() => {
    // Pin "now" so formatTime branches are deterministic.
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("pending message", () => {
    it("renders the dots spinner with optional hint", () => {
      render(<MessageBubble message={makeMsg({ pending: true, hint: "warming up" })} />);
      expect(screen.getByLabelText("agent is typing")).toBeInTheDocument();
      expect(screen.getByText("warming up")).toBeInTheDocument();
    });

    it("renders without hint when none provided", () => {
      render(<MessageBubble message={makeMsg({ pending: true })} />);
      expect(screen.getByLabelText("agent is typing")).toBeInTheDocument();
    });
  });

  describe("voice user message", () => {
    it("renders audio card with playable <audio> and attribution", () => {
      const { container } = render(
        <MessageBubble
          message={makeMsg({
            kind: "voice",
            text: "",
            attachmentUrl: "blob:audio",
            attachmentName: "recording-123.webm",
          })}
        />,
      );
      const card = container.querySelector(".attachment-card-audio");
      expect(card).not.toBeNull();
      const audio = container.querySelector("audio");
      expect(audio).not.toBeNull();
      expect(audio).toHaveAttribute("src", "blob:audio");
      expect(audio).toHaveAttribute("controls");
      // Voice messages now get attribution like the rest.
      expect(container.querySelector(".bubble-attribution")).not.toBeNull();
      // Empty caption → no caption bubble.
      expect(container.querySelector(".bubble.bubble-user")).toBeNull();
    });

    it("renders generic 'Voice recording' label for recorded clips", () => {
      const { container } = render(
        <MessageBubble
          message={makeMsg({
            kind: "voice",
            text: "",
            attachmentUrl: "blob:r",
            attachmentName: "recording-99.webm",
          })}
        />,
      );
      expect(container.textContent).toContain("Voice recording");
    });

    it("renders the actual filename for uploaded audio files", () => {
      const { container } = render(
        <MessageBubble
          message={makeMsg({
            kind: "voice",
            text: "",
            attachmentUrl: "blob:u",
            attachmentName: "podcast.mp3",
          })}
        />,
      );
      expect(container.textContent).toContain("podcast.mp3");
    });

    it("renders both audio card AND caption bubble when caption is set", () => {
      const { container } = render(
        <MessageBubble
          message={makeMsg({
            kind: "voice",
            text: "listen to this",
            attachmentUrl: "blob:a",
            attachmentName: "recording-1.webm",
          })}
        />,
      );
      expect(container.querySelector(".attachment-card-audio")).not.toBeNull();
      const caption = container.querySelector(".bubble.bubble-user");
      expect(caption).not.toBeNull();
      expect(caption?.textContent).toBe("listen to this");
    });
  });

  describe("image user message", () => {
    it("renders thumbnail when attachmentUrl is present", () => {
      render(
        <MessageBubble
          message={makeMsg({
            kind: "image",
            text: "img caption",
            attachmentUrl: "blob:abc",
            attachmentName: "shot.png",
          })}
        />,
      );
      const img = screen.getByRole("img", { name: "shot.png" });
      expect(img).toHaveAttribute("src", "blob:abc");
    });

    it("renders attachment card and caption bubble as separate siblings", () => {
      const { container } = render(
        <MessageBubble
          message={makeMsg({
            kind: "image",
            text: "look at this",
            attachmentUrl: "blob:xyz",
            attachmentName: "shot.png",
          })}
        />,
      );
      const card = container.querySelector(".attachment-card-image");
      expect(card).not.toBeNull();
      expect(card?.querySelector("img")).not.toBeNull();
      // Caption is now its own bubble below the card (not nested inside it).
      const captionBubble = container.querySelector(".bubble.bubble-user");
      expect(captionBubble).not.toBeNull();
      expect(captionBubble?.textContent).toBe("look at this");
    });

    it("renders attachment card only when caption is empty", () => {
      const { container } = render(
        <MessageBubble
          message={makeMsg({
            kind: "image",
            text: "",
            attachmentUrl: "blob:xyz",
            attachmentName: "shot.png",
          })}
        />,
      );
      expect(container.querySelector(".attachment-card-image")).not.toBeNull();
      // No caption bubble when text is empty.
      expect(container.querySelector(".bubble.bubble-user")).toBeNull();
    });

    it("click on image fires onOpenPreview with src + title", () => {
      const onOpenPreview = vi.fn();
      render(
        <MessageBubble
          message={makeMsg({
            kind: "image",
            text: "caption",
            attachmentUrl: "blob:abc",
            attachmentName: "shot.png",
          })}
          onOpenPreview={onOpenPreview}
        />,
      );
      const btn = screen.getByLabelText("open shot.png preview");
      fireEvent.click(btn);
      expect(onOpenPreview).toHaveBeenCalledWith({
        kind: "image",
        src: "blob:abc",
        title: "shot.png",
      });
    });

    it("falls back to text span when no attachmentUrl", () => {
      const { container } = render(
        <MessageBubble message={makeMsg({ kind: "image", text: "no url" })} />,
      );
      expect(container.querySelector("img")).toBeNull();
      expect(container.textContent).toContain("no url");
    });
  });

  describe("agent text message", () => {
    it("renders markdown body and Cody Rider attribution", () => {
      render(
        <MessageBubble
          message={makeMsg({
            role: "agent",
            text: "**bold** answer",
            createdAt: new Date("2026-05-08T11:00:00").getTime(),
          })}
        />,
      );
      // Markdown rendered as <strong>
      expect(screen.getByText("bold")).toBeInTheDocument();
      expect(screen.getByText("Cody Rider")).toBeInTheDocument();
    });
  });

  describe("formatTime branches", () => {
    function timeText(createdAt: number) {
      const { container } = render(<MessageBubble message={makeMsg({ createdAt })} />);
      const timeEl = container.querySelector(".bubble-attribution-time");
      return timeEl?.textContent ?? "";
    }

    it("today shows time only (no date prefix)", () => {
      const today = new Date("2026-05-08T08:00:00").getTime();
      const out = timeText(today);
      expect(out).not.toMatch(/Yesterday|May/);
    });

    it("yesterday is prefixed with 'Yesterday'", () => {
      const y = new Date("2026-05-07T15:00:00").getTime();
      expect(timeText(y)).toContain("Yesterday");
    });

    it("within last week shows weekday short", () => {
      // Now is Friday 2026-05-08; Sunday 2026-05-03 → 5 days ago, weekday "Sun".
      const sun = new Date("2026-05-03T10:00:00").getTime();
      const out = timeText(sun);
      expect(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) /.test(out)).toBe(true);
    });

    it("same year but >7 days ago shows month + day", () => {
      const earlier = new Date("2026-01-15T10:00:00").getTime();
      const out = timeText(earlier);
      expect(out).toMatch(/Jan/);
      expect(out).toMatch(/15/);
    });

    it("different year shows full date", () => {
      const lastYear = new Date("2025-04-01T10:00:00").getTime();
      const out = timeText(lastYear);
      expect(out).toMatch(/2025/);
    });
  });
});
