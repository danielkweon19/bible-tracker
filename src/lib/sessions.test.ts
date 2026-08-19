import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForReadingSessionSave } from "./sessions";

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForReadingSessionSave", () => {
  it("reports a confirmed write", async () => {
    await expect(waitForReadingSessionSave(Promise.resolve(), 4_000))
      .resolves.toBe("confirmed");
  });

  it("stops waiting when a write remains queued", async () => {
    vi.useFakeTimers();
    const result = waitForReadingSessionSave(new Promise<void>(() => undefined), 4_000);

    await vi.advanceTimersByTimeAsync(4_000);

    await expect(result).resolves.toBe("pending");
  });

  it("preserves immediate write failures", async () => {
    await expect(waitForReadingSessionSave(
      Promise.reject(new Error("permission denied")),
      4_000
    )).rejects.toThrow("permission denied");
  });
});
