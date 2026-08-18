import { describe, expect, it } from "vitest";
import type { ReadingSession } from "../types";
import { calculateReadingStats, currentWeekShare, dailyActivity, readingInsights } from "./analytics";

const now = new Date(2026, 7, 18, 12);

function session(
  id: string,
  daysAgo: number,
  durationSeconds: number,
  chapters: string[],
  hour = 7
): ReadingSession {
  const createdAt = new Date(now);
  createdAt.setDate(createdAt.getDate() - daysAgo);
  createdAt.setHours(hour, 0, 0, 0);
  return {
    id,
    uid: "reader",
    durationSeconds,
    chapters,
    verseCount: chapters.length * 25,
    createdAt
  };
}

describe("calculateReadingStats", () => {
  it("calculates time, chapter totals, uniqueness, pace, and streaks", () => {
    const sessions = [
      session("1", 0, 600, ["John 1"]),
      session("2", 1, 900, ["John 1", "John 2"]),
      session("3", 2, 300, ["Psalm 23"])
    ];
    expect(calculateReadingStats(sessions, now)).toMatchObject({
      totalSeconds: 1800,
      todaySeconds: 600,
      weekSeconds: 1800,
      sessionCount: 3,
      uniqueChapters: 3,
      chaptersRead: 4,
      averageSecondsPerChapter: 450,
      streakDays: 3
    });
  });

  it("continues a streak from yesterday when today has no session", () => {
    expect(calculateReadingStats([
      session("1", 1, 300, ["Mark 1"]),
      session("2", 2, 300, ["Mark 2"])
    ], now).streakDays).toBe(2);
  });
});

describe("dailyActivity", () => {
  it("fills missing dates and aggregates same-day sessions", () => {
    const points = dailyActivity([
      session("1", 0, 300, ["Luke 1"]),
      session("2", 0, 200, ["Luke 2"]),
      session("3", 2, 100, ["Luke 3"])
    ], 3, now);
    expect(points.map(point => point.seconds)).toEqual([100, 0, 500]);
    expect(points[2].chapters).toBe(2);
  });
});

describe("readingInsights", () => {
  it("finds the most read book and preferred reading period", () => {
    const insights = readingInsights([
      session("1", 0, 300, ["John 1"], 7),
      session("2", 1, 300, ["John 2"], 8),
      session("3", 3, 300, ["Romans 1"], 18)
    ], now);
    expect(insights.topBook).toBe("John");
    expect(insights.topBookChapters).toBe(2);
    expect(insights.preferredPart).toBe("Morning");
    expect(insights.activeDays).toBe(3);
  });
});

describe("currentWeekShare", () => {
  it("uses the current Monday-through-today calendar week", () => {
    const share = currentWeekShare([
      session("1", 0, 600, ["John 1"]),
      session("2", 1, 900, ["John 2", "John 3"]),
      session("3", 3, 300, ["Psalm 1"]),
      session("4", 8, 1200, ["Romans 1"])
    ], now);
    expect(share).toEqual({
      weekKey: "2026-08-17",
      durationSeconds: 1500,
      chaptersRead: 3,
      activeDays: 2
    });
  });
});
