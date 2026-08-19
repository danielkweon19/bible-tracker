import { useRef, useState } from "react";
import {
  BarChart3,
  BookCheck,
  BookMarked,
  CalendarDays,
  Flame,
  Sparkles,
  Trash2
} from "lucide-react";
import { calculateReadingStats, dailyActivity, formatDuration, readingInsights } from "../lib/analytics";
import { sessionDate } from "../lib/sessions";
import type { ReadingSession } from "../types";

export function Insights({
  sessions,
  firstName,
  onRead
}: {
  sessions: ReadingSession[];
  firstName: string;
  onRead: () => void;
}) {
  const stats = calculateReadingStats(sessions);
  const insights = readingInsights(sessions);
  const activity = dailyActivity(sessions, 7);
  const max = Math.max(...activity.map(point => point.seconds), 1);
  return (
    <div className="dashboard-view">
      <PageHeader eyebrow={`${greeting()}, ${firstName}`} title="Your reading insights" action={<button className="primary-button" onClick={onRead}><BookMarked size={18} /> Continue reading</button>} />
      <section className="insights-lead">
        <div>
          <p className="eyebrow">This week</p>
          <h2>{formatDuration(stats.weekSeconds, true)} in the Word</h2>
          <p>{stats.streakDays ? `${stats.streakDays}-day reading streak` : "Your next chapter starts a new streak"} · {stats.chaptersRead} chapters recorded</p>
        </div>
        <Flame size={54} />
      </section>
      <section className="insight-grid">
        <Insight label="Most-read book" value={insights.topBook ?? "Building a baseline"} note={insights.topBook ? `${insights.topBookChapters} chapters recorded` : "Finish your first session"} />
        <Insight label="Usual reading time" value={insights.preferredPart ?? "Not enough data"} note={insights.preferredDay ? `Most often on ${insights.preferredDay}` : "Your pattern will appear here"} />
        <Insight label="30-day trend" value={insights.trendPercent === null ? "Building a baseline" : `${insights.trendPercent >= 0 ? "+" : ""}${insights.trendPercent}%`} note="Compared with prior 30 days" />
        <Insight label="Active days" value={`${insights.activeDays} of 30`} note={`${stats.versesRead.toLocaleString()} verses read in total`} />
      </section>
      <section className="insights-layout">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><p className="eyebrow">Last 7 days</p><h2>Time in Scripture</h2></div></div>
          <div className="trend-bars" aria-label="Reading time over the last 7 days">
            {activity.map(point => (
              <div className="trend-column" key={point.date.toISOString()} title={`${formatDate(point.date)}: ${formatDuration(point.seconds)}`}>
                <span style={{ height: `${Math.max(point.seconds ? 8 : 2, (point.seconds / max) * 100)}%` }} />
                <small>{point.date.toLocaleDateString(undefined, { weekday: "narrow" })}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="panel pace-panel">
          <p className="eyebrow">Reading pace</p>
          <h2>{formatDuration(stats.averageSecondsPerChapter)}</h2>
          <p>Average time per completed chapter</p>
          <div className="pace-details">
            <div><BookCheck /><span><strong>{stats.chaptersRead}</strong> chapter reads</span></div>
            <div><CalendarDays /><span><strong>{stats.streakDays}</strong> day streak</span></div>
            <div><Sparkles /><span><strong>{stats.uniqueChapters}</strong> unique chapters</span></div>
          </div>
        </article>
      </section>
    </div>
  );
}

export function History({
  sessions,
  onDelete,
  onClear
}: {
  sessions: ReadingSession[];
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const stats = calculateReadingStats(sessions);
  return (
    <div className="dashboard-view">
      <PageHeader
        eyebrow="Reading journal"
        title="Your reading history"
        action={sessions.length ? (
          <button className="secondary-button clear-history-button" onClick={onClear}>
            <Trash2 size={17} /><span>Clear history</span>
          </button>
        ) : undefined}
      />
      <section className="panel history-panel">
        <div className="history-summary">
          <div><p className="eyebrow">All time</p><h2>{formatDuration(stats.totalSeconds, true)}</h2><span>{stats.sessionCount} sessions · {stats.chaptersRead} chapters</span></div>
          <div className="history-mark"><BarChart3 /></div>
        </div>
        <SessionList sessions={sessions} onDelete={onDelete} />
      </section>
    </div>
  );
}

function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</header>;
}

function Insight({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="insight-card"><p>{label}</p><strong>{value}</strong><span>{note}</span></article>;
}

function SessionList({ sessions, onDelete }: { sessions: ReadingSession[]; onDelete: (id: string) => void }) {
  if (!sessions.length) return <div className="empty-state"><BookMarked /><strong>No reading sessions yet</strong><span>Your first saved chapter will appear here.</span></div>;
  return <div className="session-list">
    {sessions.map(session => {
      const date = sessionDate(session);
      return (
        <SessionRow
          key={session.id}
          session={session}
          date={date}
          onDelete={() => onDelete(session.id)}
        />
      );
    })}
  </div>;
}

function SessionRow({
  session,
  date,
  onDelete
}: {
  session: ReadingSession;
  date: Date | null;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const chapterLabel = formatChapters(session.chapters);

  function finishSwipe(event: React.TouchEvent) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < 0) setRevealed(true);
    if (deltaX > 0) setRevealed(false);
  }

  return (
    <div className={revealed ? "session-row-wrap revealed" : "session-row-wrap"}>
      <button
        className="swipe-delete-button"
        onClick={onDelete}
        aria-label={`Delete ${chapterLabel}`}
        tabIndex={revealed ? 0 : -1}
      >
        <Trash2 size={17} /><span>Delete</span>
      </button>
      <div
        className="session-row"
        onTouchStart={event => {
          const touch = event.touches[0];
          if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={finishSwipe}
        onTouchCancel={() => { touchStart.current = null; }}
      >
        <div className="session-symbol"><BookCheck size={17} /></div>
        <div className="session-main">
          <strong>{chapterLabel}</strong>
          <span>{date ? formatDate(date) : "Just now"} · {formatDuration(session.durationSeconds)}</span>
        </div>
        <span className="verse-total">{session.verseCount} verses</span>
        <button className="icon-button delete-button" onClick={onDelete} title="Delete session" aria-label="Delete session"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

function formatChapters(chapters: string[]): string {
  if (!chapters.length) return "Reading session";
  if (chapters.length === 1) return chapters[0];
  const references = chapters.map(chapter => {
    const match = chapter.match(/^(.*) (\d+)$/);
    return match ? { book: match[1], chapter: Number(match[2]) } : null;
  });
  if (
    references.every(reference => reference !== null) &&
    references.every(reference => reference.book === references[0]!.book)
  ) {
    const chapterNumbers = references
      .map(reference => reference.chapter)
      .sort((left, right) => left - right);
    const contiguous = chapterNumbers.every(
      (chapter, index) => index === 0 || chapter === chapterNumbers[index - 1] + 1
    );
    if (contiguous) {
      return `${references[0]!.book} ${chapterNumbers[0]} - ${chapterNumbers[chapterNumbers.length - 1]}`;
    }
  }
  if (chapters.length === 2) return `${chapters[0]}, ${chapters[1]}`;
  return `${chapters[0]} +${chapters.length - 1} chapters`;
}

function formatDate(date: Date): string {
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
