import { afterEach, beforeEach, vi } from "vitest";

// Chaque test repart de la base mockée telle que seedée : db() la recrée au premier accès.
beforeEach(() => {
  delete (globalThis as { __detoxDb?: unknown }).__detoxDb;
});

afterEach(() => {
  vi.useRealTimers();
});
