// Polls /api/health and surfaces whether the backend pipeline is ready to
// accept turns. Three reasons we may NOT be ready:
//   - unbuilt: the .pipe file has zero components (e.g. exercise starter)
//   - unavailable: api is up but the pipeline init task hasn't finished
//   - unreachable: api itself isn't responding (fetch fails)
// All three lock the chat inputs.

import { useEffect, useState } from "react";

export type PipelineState = "ready" | "unbuilt" | "unavailable" | "unreachable";

type Health = {
  state: PipelineState;
  ready: boolean;
};

const POLL_INTERVAL_MS = 3000;

export function usePipelineHealth(): Health {
  // Optimistic: assume ready on first render so inputs aren't briefly
  // disabled during the initial probe round-trip. The first probe
  // resolves within ~tens of ms in practice; if it returns a non-ready
  // state the inputs lock immediately after.
  const [state, setState] = useState<PipelineState>("ready");

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { pipeline?: string };
        if (cancelled) return;
        const next = body.pipeline;
        if (next === "ready" || next === "unbuilt" || next === "unavailable") {
          setState(next);
        } else {
          setState("unreachable");
        }
      } catch {
        if (cancelled) return;
        setState("unreachable");
      }
    }

    void probe();
    const id = window.setInterval(() => void probe(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { state, ready: state === "ready" };
}
