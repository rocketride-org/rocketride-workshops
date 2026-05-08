import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    it("renders mic icon and voice attribution suppressed", () => {
      const { container } = render(
        <MessageBubble message={makeMsg({ kind: "voice", text: "voice msg" })} />,
      );
      expect(container.querySelector(".bubble-voice")).toBeInTheDocument();
      // Voice messages skip the attribution row.
      expect(container.querySelector(".bubble-attribution")).toBeNull();
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
          })}
        />,
      );
      const img = screen.getByRole("img", { name: "img caption" });
      expect(img).toHaveAttribute("src", "blob:abc");
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
