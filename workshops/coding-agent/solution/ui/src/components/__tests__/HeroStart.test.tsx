import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroStart } from "../HeroStart";

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

describe("HeroStart", () => {
  it("submits typed text via the form", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<HeroStart {...props} />);
    await user.type(screen.getByPlaceholderText(/tell Cody Rider/), "build me a thing{Enter}");
    expect(props.onUserText).toHaveBeenCalledWith("build me a thing");
  });

  it("blank text does not submit", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<HeroStart {...props} />);
    await user.type(screen.getByPlaceholderText(/tell Cody Rider/), "   {Enter}");
    expect(props.onUserText).not.toHaveBeenCalled();
  });

  it("mic button calls start when not recording", async () => {
    const user = userEvent.setup();
    render(<HeroStart {...makeProps()} />);
    await user.click(screen.getByLabelText("start recording"));
    expect(voiceState.start).toHaveBeenCalled();
  });

  it("mic button calls stop when recording", async () => {
    voiceState.isRecording = true;
    const user = userEvent.setup();
    render(<HeroStart {...makeProps()} />);
    await user.click(screen.getByLabelText("stop recording"));
    expect(voiceState.stop).toHaveBeenCalled();
  });

  it("voice capture forwards blob immediately as attachment", async () => {
    const props = makeProps();
    render(<HeroStart {...props} />);
    expect(voiceState.onCaptured).toBeTruthy();
    await act(async () => {
      voiceState.onCaptured!(new Blob(["audio"]), "audio/webm;codecs=opus");
    });
    expect(props.onUserAttachment).toHaveBeenCalledTimes(1);
    const [attachment, text] = props.onUserAttachment.mock.calls[0];
    expect(attachment.kind).toBe("audio");
    expect(attachment.mimetype).toBe("audio/webm;codecs=opus");
    expect(text).toBeUndefined();
  });

  it("recording state disables text input", () => {
    voiceState.isRecording = true;
    render(<HeroStart {...makeProps()} />);
    expect(screen.getByPlaceholderText(/tell Cody Rider/)).toBeDisabled();
  });

  it("pipelineReady=false disables text input and mic", () => {
    render(<HeroStart {...makeProps()} pipelineReady={false} />);
    expect(screen.getByPlaceholderText(/tell Cody Rider/)).toBeDisabled();
    expect(screen.getByLabelText("start recording")).toBeDisabled();
  });

  it("pipelineReady=false blocks submission via Enter", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<HeroStart {...props} pipelineReady={false} />);
    // Disabled inputs swallow keypresses — submission can't fire.
    await user.type(screen.getByPlaceholderText(/tell Cody Rider/), "should not send{Enter}");
    expect(props.onUserText).not.toHaveBeenCalled();
  });
});
