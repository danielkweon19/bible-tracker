import { describe, expect, it } from "vitest";
import { parseReadingState, readingStatePayload } from "./readingState";

describe("account reading state", () => {
  it("serializes active reading progress", () => {
    expect(readingStatePayload(
      "reader-1",
      { bookIndex: 42, chapterIndex: 4 },
      { startedAt: 1_000, stoppedAt: 6_000, chapters: ["John 1", "John 2"] }
    )).toEqual({
      uid: "reader-1",
      bookIndex: 42,
      chapterIndex: 4,
      activeStartedAt: 1_000,
      activeStoppedAt: 6_000,
      activeChapters: ["John 1", "John 2"]
    });
  });

  it("parses account state and rejects malformed state", () => {
    expect(parseReadingState({
      bookIndex: 42,
      chapterIndex: 1,
      activeStartedAt: 1_000,
      activeStoppedAt: null,
      activeChapters: ["John 1"]
    })).toEqual({
      location: { bookIndex: 42, chapterIndex: 1 },
      active: { startedAt: 1_000, chapters: ["John 1"] }
    });
    expect(parseReadingState({ bookIndex: "42" })).toBeNull();
  });
});
