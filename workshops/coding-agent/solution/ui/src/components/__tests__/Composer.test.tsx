import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "../Composer";

const voiceState = {
  isRecording: false,
  start: vi.fn(),
  stop: vi.fn(),
  onCaptured: null as ((blob: Blob, mimetype: string) => void) | null,
};

vi.mock("../../hooks/useVoiceStream", () => ({
  useVoiceStream: ({ onCaptured }: { onCaptured: (blob: Blob, mimetype: string) => void }) => {
    voiceState.onCaptured = onCaptured;
    return {
      isRecording: voiceState.isRecording,
      start: voiceState.start,
      stop: voiceState.stop,
    };
  },
}));

beforeEach(() => {
  voiceState.isRecording = false;
  voiceState.start = vi.fn();
  voiceState.stop = vi.fn();
  voiceState.onCaptured = null;
});

function makeProps() {
  return {
    onUserText: vi.fn(),
    onUserAttachment: vi.fn(),
    onError: vi.fn(),
  };
}

describe("Composer", () => {
  it("submit with text only routes to onUserText", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Composer {...props} />);
    await user.type(screen.getByPlaceholderText(/message Cody Rider/), "hello world");
    await user.click(screen.getByLabelText("send"));
    expect(props.onUserText).toHaveBeenCalledWith("hello world");
    expect(props.onUserAttachment).not.toHaveBeenCalled();
  });

  it("send button disabled when both text and pending are empty", () => {
    render(<Composer {...makeProps()} />);
    expect(screen.getByLabelText("send")).toBeDisabled();
  });

  it("whitespace-only text does not submit", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Composer {...props} />);
    await user.type(screen.getByPlaceholderText(/message Cody Rider/), "   ");
    expect(screen.getByLabelText("send")).toBeDisabled();
    // Pressing Enter on the form doesn't fire either.
    await user.keyboard("{Enter}");
    expect(props.onUserText).not.toHaveBeenCalled();
  });

  it("attaching an image pre-stages without auto-sending", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    const file = new File(["pic"], "pic.png", { type: "image/png" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(props.onUserAttachment).not.toHaveBeenCalled();
    expect(screen.getByLabelText("attached image")).toBeInTheDocument();
    expect(screen.getByLabelText("remove attachment")).toBeInTheDocument();
    // Send button is enabled now even with no text.
    expect(screen.getByLabelText("send")).toBeEnabled();
  });

  it("submitting an attachment-only fires onUserAttachment with no caption", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    const file = new File(["pic"], "pic.jpg", { type: "image/jpeg" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByLabelText("send"));
    expect(props.onUserAttachment).toHaveBeenCalledTimes(1);
    const [attachment, text] = props.onUserAttachment.mock.calls[0];
    expect(attachment.kind).toBe("image");
    expect(attachment.mimetype).toBe("image/jpeg");
    expect(attachment.name).toBe("pic.jpg");
    expect(attachment.blob).toBe(file);
    expect(text).toBeUndefined();
  });

  it("submitting attachment plus typed text sends combined", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    const file = new File(["pic"], "p.png", { type: "image/png" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.type(screen.getByPlaceholderText(/add a caption/), "describe this please");
    await user.click(screen.getByLabelText("send"));
    expect(props.onUserAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "image" }),
      "describe this please",
    );
  });

  it("clear button removes pending attachment and revokes preview URL", async () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    const user = userEvent.setup();
    const { container } = render(<Composer {...makeProps()} />);
    const file = new File(["pic"], "p.png", { type: "image/png" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    const previewSrc = (screen.getByAltText("attachment") as HTMLImageElement).src;
    await user.click(screen.getByLabelText("remove attachment"));
    expect(screen.queryByLabelText("attached image")).toBeNull();
    expect(revokeSpy).toHaveBeenCalledWith(previewSrc);
  });

  it("replacing the pending attachment revokes the old preview URL", async () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    const user = userEvent.setup();
    const { container } = render(<Composer {...makeProps()} />);
    const a = new File(["pic1"], "a.png", { type: "image/png" });
    const b = new File(["pic2"], "b.png", { type: "image/png" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, a);
    const firstSrc = (screen.getByAltText("attachment") as HTMLImageElement).src;
    await user.upload(input, b);
    expect(revokeSpy).toHaveBeenCalledWith(firstSrc);
  });

  it("mic button toggles voice recording via the hook", async () => {
    const user = userEvent.setup();
    render(<Composer {...makeProps()} />);
    await user.click(screen.getByLabelText("start recording"));
    expect(voiceState.start).toHaveBeenCalledTimes(1);
    expect(voiceState.stop).not.toHaveBeenCalled();
  });

  it("mic stop captures audio into pendingAttachment and triggers caption placeholder", async () => {
    const user = userEvent.setup();
    render(<Composer {...makeProps()} />);
    await user.click(screen.getByLabelText("start recording"));
    // Simulate the hook firing onCaptured (as it would after stop()).
    expect(voiceState.onCaptured).toBeTruthy();
    await act(async () => {
      voiceState.onCaptured!(new Blob(["audio"]), "audio/webm;codecs=opus");
    });
    expect(await screen.findByText(/voice clip ready/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/add a caption/)).toBeInTheDocument();
  });

  it("submit with audio + caption fires onUserAttachment with caption", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Composer {...props} />);
    await user.click(screen.getByLabelText("start recording"));
    await act(async () => {
      voiceState.onCaptured!(new Blob(["a"]), "audio/webm;codecs=opus");
    });
    await user.type(await screen.findByPlaceholderText(/add a caption/), "what was that");
    await user.click(screen.getByLabelText("send"));
    expect(props.onUserAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "audio", mimetype: "audio/webm;codecs=opus" }),
      "what was that",
    );
  });

  it("recording state disables attach + text + send", async () => {
    voiceState.isRecording = true;
    render(<Composer {...makeProps()} />);
    expect(screen.getByLabelText("attach image")).toBeDisabled();
    expect(screen.getByPlaceholderText(/listening/)).toBeDisabled();
    expect(screen.getByLabelText("send")).toBeDisabled();
    expect(screen.getByLabelText("stop recording")).toBeEnabled();
  });
});
