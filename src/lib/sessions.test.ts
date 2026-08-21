import { describe, expect, it } from "vitest";
import type { ReadingSession } from "../types";
import {
  dailyReadingRecords,
  deduplicateReadingSessions,
  readingSessionId,
  sessionDate
} from "./sessions";

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

  it("recovers the date of a pending write from its stable document ID", () => {
    const startedAt = new Date("2026-08-21T14:30:00Z").getTime();
    const pending = session(readingSessionId("reader/one", startedAt), null);

    expect(sessionDate(pending)?.toISOString()).toBe("2026-08-21T14:30:00.000Z");
  });

  it("combines sessions from the same day into one reading record", () => {
    const morning = session("morning", new Date(2026, 7, 21, 8), 300, ["John 1"]);
    const evening = session("evening", new Date(2026, 7, 21, 19), 420, ["John 2"]);
    const yesterday = session("yesterday", new Date(2026, 7, 20, 8), 180, ["Mark 1"]);

    const records = dailyReadingRecords([morning, evening, yesterday]);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      durationSeconds: 720,
      chapters: ["John 1", "John 2"],
      sessionIds: ["morning", "evening"],
      sessionCount: 2
    });
  });
});
