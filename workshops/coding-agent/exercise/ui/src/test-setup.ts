import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

if (typeof Element.prototype.scrollIntoView === "undefined") {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
}

// Default fetch stub: every /api/health probe reports a fully-built, ready
// pipeline. Tests that need the disabled state override this stub via
// `vi.spyOn(globalThis, "fetch")`.
beforeEach(() => {
  if (!vi.isMockFunction(globalThis.fetch)) {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/health")) {
        return new Response(JSON.stringify({ status: "ok", pipeline: "ready", components: 38 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

if (typeof URL.createObjectURL === "undefined") {
  let counter = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => `blob:test-${++counter}`),
  });
}
if (typeof URL.revokeObjectURL === "undefined") {
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
}

if (typeof globalThis.crypto === "undefined") {
  let n = 0;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      randomUUID: () => `test-uuid-${++n}`,
    },
  });
} else if (typeof globalThis.crypto.randomUUID !== "function") {
  let n = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `test-uuid-${++n}`,
  });
}
