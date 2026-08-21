import { describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  batchDelete: vi.fn(),
  collection: vi.fn(() => ({ path: "readingSessions" })),
  commit: vi.fn(() => Promise.resolve()),
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`
  })),
  getDocs: vi.fn(() => Promise.resolve({
    docs: [{ ref: { path: "readingSessions/hidden-duplicate" } }]
  })),
  query: vi.fn((value: unknown) => value),
  where: vi.fn(() => ({ field: "uid" })),
  writeBatch: vi.fn()
}));

vi.mock("firebase/firestore", () => ({
  collection: firestore.collection,
  deleteDoc: vi.fn(),
  doc: firestore.doc,
  enableNetwork: vi.fn(),
  getDocs: firestore.getDocs,
  getDocsFromServer: vi.fn(),
  onSnapshot: vi.fn(),
  query: firestore.query,
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  where: firestore.where,
  writeBatch: firestore.writeBatch
}));

import { clearReadingSessions } from "./sessions";

describe("clearReadingSessions", () => {
  it("deletes visible sessions before querying for hidden duplicates", async () => {
    firestore.writeBatch.mockImplementation(() => ({
      delete: firestore.batchDelete,
      commit: firestore.commit
    }));

    await clearReadingSessions(
      {} as never,
      "reader-1",
      ["visible-1", "visible-2", "visible-1"]
    );

    expect(firestore.batchDelete.mock.calls.map(([ref]) => ref.path)).toEqual([
      "readingSessions/visible-1",
      "readingSessions/visible-2",
      "readingSessions/hidden-duplicate"
    ]);
    expect(firestore.commit).toHaveBeenCalledTimes(2);
    expect(firestore.batchDelete.mock.invocationCallOrder[0])
      .toBeLessThan(firestore.getDocs.mock.invocationCallOrder[0]);
  });
});
