import { describe, expect, it } from "vitest";
import type { ReadingSession } from "../types";
import { deduplicateReadingSessions, readingSessionId } from "./sessions";

function session(
  id: string,
  createdAt: Date | null,
  durationSeconds = 5,
  chapters = ["John 1", "John 2"]
): ReadingSession {
  return {
    id,
    uid: "reader/one",
    durationSeconds,
    chapters,
    verseCount: chapters.length * 20,
    createdAt
  };
}

describe("reading session writes", () => {
  it("uses a stable document ID for retries of the same session", () => {
    expect(readingSessionId("reader/one", 123_456)).toBe("reader%2Fone-2n9c");
    expect(readingSessionId("reader/one", 123_456))
      .toBe(readingSessionId("reader/one", 123_456));
  });

  it("collapses legacy duplicate submissions created seconds apart", () => {
    const now = new Date("2026-08-19T12:00:00Z");
    const sessions = [
      session("first", now),
      session("duplicate", new Date(now.getTime() - 2_000)),
      session("distinct-time", new Date(now.getTime() - 3_000), 8),
      session("later", new Date(now.getTime() - 60_000))
    ];

    expect(deduplicateReadingSessions(sessions).map(item => item.id))
      .toEqual(["first", "distinct-time", "later"]);
  });

  it("collapses matching pending writes without timestamps", () => {
    expect(deduplicateReadingSessions([
      session("first", null),
      session("duplicate", null)
    ])).toHaveLength(1);
  });
});
