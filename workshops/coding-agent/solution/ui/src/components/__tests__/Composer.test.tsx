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

  it("text input is disabled while an attachment is pending (mutex)", async () => {
    const user = userEvent.setup();
    const { container } = render(<Composer {...makeProps()} />);
    const file = new File(["pic"], "p.png", { type: "image/png" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    const input = screen.getByPlaceholderText(/clear the attachment/);
    expect(input).toBeDisabled();
  });

  it("attach button is disabled while text input is non-empty (mutex)", async () => {
    const user = userEvent.setup();
    render(<Composer {...makeProps()} />);
    await user.type(screen.getByPlaceholderText(/message Cody Rider/), "hello");
    expect(screen.getByLabelText("attach file")).toBeDisabled();
    expect(screen.getByLabelText("start recording")).toBeDisabled();
  });

  it("submitting attachment alone fires onUserAttachment with no extra args", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    const file = new File(["pic"], "p.png", { type: "image/png" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    await user.click(screen.getByLabelText("send"));
    expect(props.onUserAttachment).toHaveBeenCalledTimes(1);
    // Single positional arg (no caption second arg).
    expect(props.onUserAttachment.mock.calls[0]).toHaveLength(1);
    expect(props.onUserAttachment.mock.calls[0][0].kind).toBe("image");
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

  it("mic stop stages audio in pendingAttachment and locks the text input", async () => {
    const user = userEvent.setup();
    render(<Composer {...makeProps()} />);
    await user.click(screen.getByLabelText("start recording"));
    expect(voiceState.onCaptured).toBeTruthy();
    await act(async () => {
      voiceState.onCaptured!(new Blob(["audio"]), "audio/webm;codecs=opus");
    });
    expect(await screen.findByText(/voice clip ready/)).toBeInTheDocument();
    // Mutex: with the audio pending, the text input is disabled and shows
    // the "clear the attachment" placeholder.
    expect(screen.getByPlaceholderText(/clear the attachment/)).toBeDisabled();
  });

  it("submit audio fires onUserAttachment without a caption arg", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<Composer {...props} />);
    await user.click(screen.getByLabelText("start recording"));
    await act(async () => {
      voiceState.onCaptured!(new Blob(["a"]), "audio/webm;codecs=opus");
    });
    await user.click(screen.getByLabelText("send"));
    expect(props.onUserAttachment).toHaveBeenCalledTimes(1);
    expect(props.onUserAttachment.mock.calls[0]).toHaveLength(1);
    expect(props.onUserAttachment.mock.calls[0][0].kind).toBe("audio");
  });

  it("attaching an SVG with empty MIME still routes through the image path", async () => {
    // Some OSes hand back an empty file.type for .svg. Extension-based
    // fallback should still detect it as an image. The API now handles
    // SVG-as-text inlining server-side, so the client just passes the
    // blob through with a normalized mimetype.
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    const svg = new File(["<svg/>"], "diagram.svg", { type: "" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, svg);
    await screen.findByLabelText("attached image");
    await user.click(screen.getByLabelText("send"));
    const [attachment] = props.onUserAttachment.mock.calls[0];
    expect(attachment.kind).toBe("image");
    expect(attachment.mimetype).toBe("image/svg+xml");
    expect(attachment.previewUrl).toBeTruthy();
  });

  it("attaching an SVG routes through the image path", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    // SVG: client routes as image so the bubble can render the diagram
    // visually via <img src=blobURL>. SVG bytes go through the image
    // blob channel to the server (no client-side text capture).
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'], "diagram.svg", {
      type: "image/svg+xml",
    });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, svg);
    await screen.findByLabelText("attached image");
    await user.click(screen.getByLabelText("send"));
    expect(props.onUserAttachment).toHaveBeenCalledTimes(1);
    const [attachment] = props.onUserAttachment.mock.calls[0];
    expect(attachment.kind).toBe("image");
    expect(attachment.mimetype).toBe("image/svg+xml");
    expect(attachment.name).toBe("diagram.svg");
    expect(attachment.previewUrl).toBeTruthy();
  });

  it("attaching an audio file routes through the audio path with preview URL", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    const mp3 = new File(["mp3bytes"], "song.mp3", { type: "audio/mpeg" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, mp3);
    // Uploaded audio files show their filename in the pending chip (not the
    // generic "voice clip ready" label reserved for recorded clips).
    expect(screen.getByText("song.mp3")).toBeInTheDocument();
    await user.click(screen.getByLabelText("send"));
    const [attachment] = props.onUserAttachment.mock.calls[0];
    expect(attachment.kind).toBe("audio");
    expect(attachment.mimetype).toBe("audio/mpeg");
    expect(attachment.name).toBe("song.mp3");
    expect(attachment.previewUrl).toBeTruthy();
  });

  it("attaching a PNG still routes through the image path (no regression)", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(<Composer {...props} />);
    const png = new File(["binarypixels"], "shot.png", { type: "image/png" });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, png);
    await user.click(screen.getByLabelText("send"));
    const [attachment] = props.onUserAttachment.mock.calls[0];
    expect(attachment.kind).toBe("image");
    expect(attachment.previewUrl).toBeTruthy();
    expect(attachment.textContent).toBeUndefined();
  });

  it("recording state disables attach + text + send", async () => {
    voiceState.isRecording = true;
    render(<Composer {...makeProps()} />);
    expect(screen.getByLabelText("attach file")).toBeDisabled();
    expect(screen.getByPlaceholderText(/listening/)).toBeDisabled();
    expect(screen.getByLabelText("send")).toBeDisabled();
    expect(screen.getByLabelText("stop recording")).toBeEnabled();
  });
});
