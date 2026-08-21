import { describe, expect, it, vi } from "vitest";
import type { ReadingSession } from "../types";

const firestore = vi.hoisted(() => ({
  batchSet: vi.fn(),
  collection: vi.fn(() => ({ path: "readingSessions" })),
  commit: vi.fn(() => Promise.resolve()),
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`
  })),
  enableNetwork: vi.fn(() => Promise.resolve()),
  getDocsFromServer: vi.fn(),
  query: vi.fn((value: unknown) => value),
  serverTimestamp: vi.fn(() => "server-time"),
  where: vi.fn(() => ({ field: "uid" })),
  writeBatch: vi.fn()
}));

vi.mock("firebase/firestore", () => ({
  collection: firestore.collection,
  doc: firestore.doc,
  enableNetwork: firestore.enableNetwork,
  getDocs: vi.fn(),
  getDocsFromServer: firestore.getDocsFromServer,
  onSnapshot: vi.fn(),
  query: firestore.query,
  serverTimestamp: firestore.serverTimestamp,
  setDoc: vi.fn(),
  where: firestore.where,
  writeBatch: firestore.writeBatch
}));

import { ReadingSessionSyncTimeoutError, syncReadingSessions } from "./sessions";

describe("syncReadingSessions", () => {
  it("rewrites cached sessions to their existing IDs and verifies the server copy", async () => {
    const createdAt = new Date("2026-08-18T12:00:00Z");
    const session: ReadingSession = {
      id: "cached-session",
      uid: "reader-1",
      durationSeconds: 300,
      chapters: ["John 1"],
      verseCount: 51,
      createdAt
    };
    firestore.writeBatch.mockReturnValue({
      set: firestore.batchSet,
      commit: firestore.commit
    });
    firestore.getDocsFromServer.mockResolvedValue({
      docs: [{ id: session.id }]
    });

    await syncReadingSessions({} as never, "reader-1", [session]);

    expect(firestore.batchSet).toHaveBeenCalledWith(
      { path: "readingSessions/cached-session" },
      expect.objectContaining({
        uid: "reader-1",
        durationSeconds: 300,
        createdAt
      })
    );
    expect(firestore.commit).toHaveBeenCalledOnce();
    expect(firestore.getDocsFromServer).toHaveBeenCalledOnce();
  });

  it("fails when the server does not confirm every cached session", async () => {
    const session: ReadingSession = {
      id: "cached-session",
      uid: "reader-1",
      durationSeconds: 300,
      chapters: ["John 1"],
      verseCount: 51,
      createdAt: new Date("2026-08-18T12:00:00Z")
    };
    firestore.writeBatch.mockReturnValue({
      set: firestore.batchSet,
      commit: firestore.commit
    });
    firestore.getDocsFromServer.mockResolvedValue({ docs: [] });

    await expect(syncReadingSessions({} as never, "reader-1", [session]))
      .rejects.toThrow("not confirmed");
  });

  it("times out when Firestore does not acknowledge the upload", async () => {
    const session: ReadingSession = {
      id: "cached-session",
      uid: "reader-1",
      durationSeconds: 300,
      chapters: ["John 1"],
      verseCount: 51,
      createdAt: new Date("2026-08-18T12:00:00Z")
    };
    firestore.writeBatch.mockReturnValue({
      set: firestore.batchSet,
      commit: vi.fn(() => new Promise(() => undefined))
    });

    await expect(syncReadingSessions({} as never, "reader-1", [session], 1))
      .rejects.toBeInstanceOf(ReadingSessionSyncTimeoutError);
  });
});
