import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useVoiceStream } from "../useVoiceStream";

type DataCb = (e: { data: Blob }) => void;
type StopCb = () => void;

class FakeMediaRecorder {
  static mimeType = "audio/webm;codecs=opus";
  static instances: FakeMediaRecorder[] = [];

  state: "inactive" | "recording" | "paused" = "inactive";
  private dataListeners: DataCb[] = [];
  private stopListeners: StopCb[] = [];
  startInterval: number | undefined;

  constructor(_stream: MediaStream, _opts?: { mimeType?: string }) {
    FakeMediaRecorder.instances.push(this);
  }

  addEventListener(
    name: "dataavailable" | "stop",
    cb: DataCb | StopCb,
    _opts?: AddEventListenerOptions,
  ) {
    if (name === "dataavailable") this.dataListeners.push(cb as DataCb);
    else if (name === "stop") this.stopListeners.push(cb as StopCb);
  }

  start(interval?: number) {
    this.state = "recording";
    this.startInterval = interval;
  }

  stop() {
    this.state = "inactive";
    for (const cb of this.stopListeners) cb();
  }

  _emitChunk(blob: Blob) {
    for (const cb of this.dataListeners) cb({ data: blob });
  }
}

class FakeMediaStream {
  tracks: { stop: () => void }[];
  constructor() {
    this.tracks = [{ stop: vi.fn() }];
  }
  getTracks() {
    return this.tracks;
  }
}

function installMediaMocks() {
  FakeMediaRecorder.instances = [];
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  const stream = new FakeMediaStream();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => stream as unknown as MediaStream),
    },
  });
  return stream;
}

describe("useVoiceStream", () => {
  beforeEach(() => {
    installMediaMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("start flips isRecording true and triggers MediaRecorder.start", async () => {
    const onCaptured = vi.fn();
    const { result } = renderHook(() => useVoiceStream({ onCaptured }));
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isRecording).toBe(true);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].state).toBe("recording");
    expect(FakeMediaRecorder.instances[0].startInterval).toBe(250);
  });

  it("stop assembles captured chunks into a single blob and calls onCaptured", async () => {
    const onCaptured = vi.fn();
    const { result } = renderHook(() => useVoiceStream({ onCaptured }));
    await act(async () => {
      await result.current.start();
    });
    const recorder = FakeMediaRecorder.instances[0];
    act(() => {
      recorder._emitChunk(new Blob(["aaa"]));
      recorder._emitChunk(new Blob(["bbb"]));
    });
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.isRecording).toBe(false);
    expect(onCaptured).toHaveBeenCalledTimes(1);
    const [blob, mimetype] = onCaptured.mock.calls[0];
    expect(mimetype).toBe("audio/webm;codecs=opus");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("empty data fires onError instead of onCaptured", async () => {
    const onCaptured = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceStream({ onCaptured, onError }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.stop();
    });
    expect(onCaptured).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("no audio captured");
  });

  it("zero-byte chunks are dropped before assembly", async () => {
    const onCaptured = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceStream({ onCaptured, onError }));
    await act(async () => {
      await result.current.start();
    });
    const recorder = FakeMediaRecorder.instances[0];
    act(() => {
      recorder._emitChunk(new Blob([""]));
    });
    await act(async () => {
      await result.current.stop();
    });
    // Empty chunk skipped → no captures stored → onError fires.
    expect(onError).toHaveBeenCalledWith("no audio captured");
  });

  it("getUserMedia rejection routes to onError and resets state", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new Error("no mic");
        }),
      },
    });
    const onCaptured = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceStream({ onCaptured, onError }));
    await act(async () => {
      await result.current.start();
    });
    expect(onError).toHaveBeenCalledWith("no mic");
    await waitFor(() => expect(result.current.isRecording).toBe(false));
  });

  it("re-entering start while already recording is a noop", async () => {
    const onCaptured = vi.fn();
    const { result } = renderHook(() => useVoiceStream({ onCaptured }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.start();
    });
    expect(FakeMediaRecorder.instances).toHaveLength(1);
  });

  it("stop without prior start is a noop", async () => {
    const onCaptured = vi.fn();
    const { result } = renderHook(() => useVoiceStream({ onCaptured }));
    await act(async () => {
      await result.current.stop();
    });
    expect(onCaptured).not.toHaveBeenCalled();
  });
});
