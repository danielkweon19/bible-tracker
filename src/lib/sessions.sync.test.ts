import { describe, expect, it, vi } from "vitest";
import type { ReadingSession } from "../types";

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => ({ path: "readingSessions" })),
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`
  })),
  query: vi.fn((value: unknown) => value),
  serverTimestamp: vi.fn(() => "server-time"),
  where: vi.fn(() => ({ field: "uid" })),
  writeBatch: vi.fn()
}));

vi.mock("firebase/firestore", () => ({
  collection: firestore.collection,
  doc: firestore.doc,
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: firestore.query,
  serverTimestamp: firestore.serverTimestamp,
  setDoc: vi.fn(),
  where: firestore.where,
  writeBatch: firestore.writeBatch
}));

import { ReadingSessionSyncTimeoutError, syncReadingSessions } from "./sessions";

describe("syncReadingSessions", () => {
  it("uploads cached sessions through the authenticated Firestore HTTPS API", async () => {
    const createdAt = new Date("2026-08-18T12:00:00Z");
    const session: ReadingSession = {
      id: "cached-session",
      uid: "reader-1",
      durationSeconds: 300,
      chapters: ["John 1"],
      verseCount: 51,
      createdAt
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ writeResults: [{}] })
    });
    vi.stubGlobal("fetch", fetchMock);

    await syncReadingSessions(
      firestoreDb("bible-project"),
      "firebase-id-token",
      "reader-1",
      [session]
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://firestore.googleapis.com/v1/projects/bible-project/databases/(default)/documents:commit",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer firebase-id-token",
          "Content-Type": "application/json"
        }
      })
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      writes: [{
        update: {
          name: "projects/bible-project/databases/(default)/documents/readingSessions/cached-session",
          fields: {
            uid: { stringValue: "reader-1" },
            durationSeconds: { integerValue: "300" },
            chapters: {
              arrayValue: { values: [{ stringValue: "John 1" }] }
            },
            verseCount: { integerValue: "51" },
            createdAt: { timestampValue: createdAt.toISOString() }
          }
        }
      }]
    });
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ writeResults: [] })
    }));

    await expect(syncReadingSessions(
      firestoreDb(),
      "firebase-id-token",
      "reader-1",
      [session]
    ))
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
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    await expect(syncReadingSessions(
      firestoreDb(),
      "firebase-id-token",
      "reader-1",
      [session],
      1
    ))
      .rejects.toBeInstanceOf(ReadingSessionSyncTimeoutError);
  });
});

function firestoreDb(projectId = "bible-project") {
  return { app: { options: { projectId } } } as never;
}
