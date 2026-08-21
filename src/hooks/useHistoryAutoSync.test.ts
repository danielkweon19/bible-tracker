import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReadingSession } from "../types";

const syncReadingSessions = vi.hoisted(() => vi.fn());

vi.mock("../lib/sessions", () => ({
  syncReadingSessions
}));

import { useHistoryAutoSync } from "./useHistoryAutoSync";

const session: ReadingSession = {
  id: "session-1",
  uid: "reader-1",
  durationSeconds: 300,
  chapters: ["John 1"],
  verseCount: 51,
  createdAt: new Date("2026-08-21T12:00:00Z")
};

const db = {} as never;
const user = {
  uid: "reader-1",
  getIdToken: vi.fn().mockResolvedValue("firebase-id-token")
} as never;

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useHistoryAutoSync", () => {
  it("syncs loaded account history without a manual action", async () => {
    syncReadingSessions.mockResolvedValue(undefined);

    renderHook(() => useHistoryAutoSync(db, user, [session], true));

    await waitFor(() => expect(syncReadingSessions).toHaveBeenCalledWith(
      db,
      "firebase-id-token",
      "reader-1",
      [session]
    ));
  });

  it("retries a failed sync in the background", async () => {
    vi.useFakeTimers();
    syncReadingSessions
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);

    renderHook(() => useHistoryAutoSync(db, user, [session], true));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(syncReadingSessions).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(syncReadingSessions).toHaveBeenCalledTimes(2);
  });
});
