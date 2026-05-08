import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

if (typeof Element.prototype.scrollIntoView === "undefined") {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
}

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
