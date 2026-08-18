import type { ReadingSession } from "../types";

export const demoUser = {
  uid: "demo-reader",
  displayName: "Daniel",
  email: "reader@example.com",
  photoURL: null
};

const DAY = 86_400_000;
const now = Date.now();

export const demoSessions: ReadingSession[] = [
  session("demo-1", 0, 1240, ["John 1", "John 2"], 85),
  session("demo-2", 1, 930, ["John 3"], 36),
  session("demo-3", 2, 1580, ["John 4", "John 5"], 101),
  session("demo-4", 4, 780, ["Psalm 23", "Psalm 24"], 16),
  session("demo-5", 5, 1120, ["Romans 5"], 21),
  session("demo-6", 7, 1460, ["Genesis 1", "Genesis 2"], 56),
  session("demo-7", 10, 840, ["Matthew 5"], 48),
  session("demo-8", 14, 1020, ["Proverbs 3"], 35),
  session("demo-9", 32, 910, ["Luke 15"], 32),
  session("demo-10", 36, 1330, ["Acts 2", "Acts 3"], 73)
];

function session(
  id: string,
  daysAgo: number,
  durationSeconds: number,
  chapters: string[],
  verseCount: number
): ReadingSession {
  const date = new Date(now - daysAgo * DAY);
  date.setHours(7 + (daysAgo % 3) * 6, 20, 0, 0);
  return {
    id,
    uid: demoUser.uid,
    durationSeconds,
    chapters,
    verseCount,
    createdAt: date
  };
}
