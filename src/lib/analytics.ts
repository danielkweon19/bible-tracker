import type { ReadingSession } from "../types";
import { sessionDate } from "./sessions";

const DAY_MS = 86_400_000;

export function formatDuration(seconds: number, short = false): string {
  const value = Math.max(0, Math.round(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (hours) return short ? `${hours}h ${minutes}m` : `${hours} hr ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${value} sec`;
}

export function formatTimer(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours
    ? `${hours}:${pad(minutes)}:${pad(remainder)}`
    : `${pad(minutes)}:${pad(remainder)}`;
}

export function calculateReadingStats(sessions: ReadingSession[], now = new Date()) {
  const today = startOfDay(now);
  const weekStart = new Date(today.getTime() - 6 * DAY_MS);
  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const todaySessions = sessions.filter(session => {
    const date = sessionDate(session);
    return date && date >= today;
  });
  const weekSessions = sessions.filter(session => {
    const date = sessionDate(session);
    return date && date >= weekStart && date <= now;
  });
  const unique = new Set(sessions.flatMap(session => session.chapters));
  const chapterTotal = sessions.reduce((sum, session) => sum + session.chapters.length, 0);

  return {
    totalSeconds,
    todaySeconds: sumSeconds(todaySessions),
    weekSeconds: sumSeconds(weekSessions),
    sessionCount: sessions.length,
    uniqueChapters: unique.size,
    chaptersRead: chapterTotal,
    versesRead: sessions.reduce((sum, session) => sum + session.verseCount, 0),
    averageSecondsPerChapter: chapterTotal ? Math.round(totalSeconds / chapterTotal) : 0,
    streakDays: calculateStreak(sessions, now)
  };
}

export function dailyActivity(sessions: ReadingSession[], days = 14, now = new Date()) {
  const today = startOfDay(now);
  const totals = new Map<string, { seconds: number; chapters: number }>();
  sessions.forEach(session => {
    const date = sessionDate(session);
    if (!date) return;
    const key = dateKey(date);
    const current = totals.get(key) ?? { seconds: 0, chapters: 0 };
    current.seconds += session.durationSeconds;
    current.chapters += session.chapters.length;
    totals.set(key, current);
  });
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * DAY_MS);
    return { date, ...(totals.get(dateKey(date)) ?? { seconds: 0, chapters: 0 }) };
  });
}

export function readingInsights(sessions: ReadingSession[], now = new Date()) {
  const dated = sessions.flatMap(session => {
    const date = sessionDate(session);
    return date ? [{ session, date }] : [];
  });
  const books = new Map<string, number>();
  sessions.flatMap(session => session.chapters).forEach(chapter => {
    const book = chapter.replace(/\s+\d+$/, "");
    books.set(book, (books.get(book) ?? 0) + 1);
  });
  const topBook = [...books].sort((left, right) => right[1] - left[1])[0] ?? null;
  const dayParts = [
    { label: "Morning", sessions: 0 },
    { label: "Afternoon", sessions: 0 },
    { label: "Evening", sessions: 0 },
    { label: "Night", sessions: 0 }
  ];
  const weekdays = Array(7).fill(0) as number[];
  dated.forEach(({ date }) => {
    dayParts[partIndex(date.getHours())].sessions += 1;
    weekdays[date.getDay()] += 1;
  });

  const recentStart = startOfDay(new Date(now.getTime() - 29 * DAY_MS));
  const previousStart = startOfDay(new Date(now.getTime() - 59 * DAY_MS));
  let recentSeconds = 0;
  let previousSeconds = 0;
  const activeDays = new Set<string>();
  dated.forEach(({ session, date }) => {
    if (date >= recentStart && date <= now) {
      recentSeconds += session.durationSeconds;
      activeDays.add(dateKey(date));
    } else if (date >= previousStart && date < recentStart) {
      previousSeconds += session.durationSeconds;
    }
  });

  const preferredPart = [...dayParts].sort((left, right) => right.sessions - left.sessions)[0];
  const bestDay = weekdays.indexOf(Math.max(...weekdays));
  return {
    activeDays: activeDays.size,
    topBook: topBook?.[0] ?? null,
    topBookChapters: topBook?.[1] ?? 0,
    preferredPart: preferredPart.sessions ? preferredPart.label : null,
    preferredDay: dated.length
      ? new Date(2026, 0, 4 + bestDay).toLocaleDateString(undefined, { weekday: "long" })
      : null,
    trendPercent: previousSeconds
      ? Math.round(((recentSeconds - previousSeconds) / previousSeconds) * 100)
      : null
  };
}

export function currentWeekShare(sessions: ReadingSession[], now = new Date()) {
  const start = startOfWeek(now);
  const weekSessions = sessions.filter(session => {
    const date = sessionDate(session);
    return date && date >= start && date <= now;
  });
  return {
    weekKey: formatDateKey(start),
    durationSeconds: sumSeconds(weekSessions),
    chaptersRead: weekSessions.reduce((sum, session) => sum + session.chapters.length, 0),
    activeDays: new Set(
      weekSessions
        .map(sessionDate)
        .filter((date): date is Date => Boolean(date))
        .map(formatDateKey)
    ).size
  };
}

function calculateStreak(sessions: ReadingSession[], now: Date): number {
  const active = new Set(
    sessions.map(sessionDate).filter((date): date is Date => Boolean(date)).map(dateKey)
  );
  let cursor = startOfDay(now);
  if (!active.has(dateKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (active.has(dateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

function sumSeconds(sessions: ReadingSession[]) {
  return sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
}

function partIndex(hour: number) {
  if (hour >= 5 && hour < 12) return 0;
  if (hour >= 12 && hour < 17) return 1;
  if (hour >= 17 && hour < 22) return 2;
  return 3;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  return new Date(start.getTime() - mondayOffset * DAY_MS);
}

function formatDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
