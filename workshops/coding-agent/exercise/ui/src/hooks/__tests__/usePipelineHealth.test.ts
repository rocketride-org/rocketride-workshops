import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePipelineHealth } from "../usePipelineHealth";

function mockHealth(body: object) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("usePipelineHealth", () => {
  it("reports ready when /api/health returns pipeline=ready", async () => {
    mockHealth({ status: "ok", pipeline: "ready", components: 38 });
    const { result } = renderHook(() => usePipelineHealth());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.ready).toBe(true);
  });

  it("reports unbuilt when components=0", async () => {
    mockHealth({ status: "ok", pipeline: "unbuilt", components: 0 });
    const { result } = renderHook(() => usePipelineHealth());
    await waitFor(() => expect(result.current.state).toBe("unbuilt"));
    expect(result.current.ready).toBe(false);
  });

  it("reports unavailable when api is up but pipeline init hasn't finished", async () => {
    mockHealth({ status: "ok", pipeline: "unavailable", components: 38 });
    const { result } = renderHook(() => usePipelineHealth());
    await waitFor(() => expect(result.current.state).toBe("unavailable"));
    expect(result.current.ready).toBe(false);
  });

  it("reports unreachable when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const { result } = renderHook(() => usePipelineHealth());
    await waitFor(() => expect(result.current.state).toBe("unreachable"));
    expect(result.current.ready).toBe(false);
  });

  it("reports unreachable on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => usePipelineHealth());
    await waitFor(() => expect(result.current.state).toBe("unreachable"));
  });
});
