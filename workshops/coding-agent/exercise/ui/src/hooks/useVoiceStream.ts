type Options = {
  onReply: (text: string) => void;
  onError?: (message: string) => void;
};

// TODO: capture audio with getUserMedia + MediaRecorder (audio/webm;codecs=opus, 250ms timeslice),
// stream chunks over useChatSocket, send {type:"start"} on begin and {type:"end"} on stop,
// listen for the {type:"reply"} frame and call onReply.
// See solution for reference.
export function useVoiceStream(_options: Options): {
  isRecording: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  return {
    isRecording: false,
    start: async () => {
      throw new Error("TODO: implement useVoiceStream.start");
    },
    stop: async () => {
      throw new Error("TODO: implement useVoiceStream.stop");
    },
  };
}
