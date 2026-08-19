import { useEffect, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  CircleStop,
  Loader2,
  Play,
  Save,
  X
} from "lucide-react";
import { chapterKey, nextLocation, previousLocation } from "../lib/bible";
import { formatTimer } from "../lib/analytics";
import type { ActiveReading, BibleData, ReadingLocation } from "../types";

export function Reader({
  bible,
  location,
  active,
  onLocation,
  onStart,
  onStop,
  onFinish,
  saving,
  onDiscard
}: {
  bible: BibleData;
  location: ReadingLocation;
  active: ActiveReading | null;
  onLocation: (location: ReadingLocation) => void;
  onStart: () => void;
  onStop: () => void;
  onFinish: () => void;
  saving: boolean;
  onDiscard: () => void;
}) {
  const book = bible.books[location.bookIndex];
  const chapter = book.chapters[location.chapterIndex];
  const reference = chapterKey(bible, location);
  const previous = useMemo(() => previousLocation(bible, location), [bible, location]);
  const next = useMemo(() => nextLocation(bible, location), [bible, location]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.querySelector(".reader-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.bookIndex, location.chapterIndex]);

  function startSwipe(event: React.TouchEvent) {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function finishSwipe(event: React.TouchEvent) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0 && next) onLocation(next);
    if (deltaX > 0 && previous) onLocation(previous);
  }

  return (
    <section className="reader-view">
      <header className="reader-toolbar">
        <div className="passage-selectors">
          <label>
            <span>Book</span>
            <select
              value={location.bookIndex}
              onChange={event => onLocation({ bookIndex: Number(event.target.value), chapterIndex: 0 })}
            >
              {bible.books.map((item, index) => <option value={index} key={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Chapter</span>
            <select
              value={location.chapterIndex}
              onChange={event => onLocation({ ...location, chapterIndex: Number(event.target.value) })}
            >
              {book.chapters.map((_, index) => <option value={index} key={index}>{index + 1}</option>)}
            </select>
          </label>
        </div>
        <div className="reader-nav">
          <button className="icon-button" disabled={!previous} onClick={() => previous && onLocation(previous)} title="Previous chapter" aria-label="Previous chapter"><ChevronLeft /></button>
          <button className="icon-button" disabled={!next} onClick={() => next && onLocation(next)} title="Next chapter" aria-label="Next chapter"><ChevronRight /></button>
        </div>
      </header>

      {active ? (
        <div className="session-bar">
          {active.stoppedAt === undefined ? (
            <div className="session-status"><span className="live-dot" /><strong>Reading in progress</strong></div>
          ) : (
            <div className="session-clock final-time"><Clock3 size={17} /><span>Final time</span><strong>{formatTimer((active.stoppedAt - active.startedAt) / 1000)}</strong></div>
          )}
          <span className="session-count">{active.chapters.length} {active.chapters.length === 1 ? "chapter" : "chapters"} tracked</span>
          <div className="session-actions">
            {active.stoppedAt === undefined ? (
              <button className="primary-button" onClick={onStop}><CircleStop size={17} /> Stop timer</button>
            ) : (
              <button className="primary-button" onClick={onFinish} disabled={saving}>
                {saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
                {saving ? "Saving..." : "Save session"}
              </button>
            )}
            <button className="icon-button discard-button" onClick={onDiscard} title="Discard reading session" aria-label="Discard reading session"><X /></button>
          </div>
        </div>
      ) : (
        <div className="session-start">
          <div><strong>Ready to read {reference}</strong><span>NKJV · {chapter.verses.length} verses</span></div>
          <button className="primary-button" onClick={onStart}><Play size={17} fill="currentColor" /> Start session</button>
        </div>
      )}

      <article
        className="reader-scroll"
        onTouchStart={startSwipe}
        onTouchEnd={finishSwipe}
        onTouchCancel={() => { touchStart.current = null; }}
      >
        <div className="scripture">
          <p className="translation-label">{bible.version}</p>
          <h1>{book.name} <span>{location.chapterIndex + 1}</span></h1>
          <div className="chapter-rule" />
          <div className="verses">
            {chapter.verses.map(verse => (
              <p key={verse.num}><sup>{verse.num}</sup>{verse.text}</p>
            ))}
          </div>
          <footer className="chapter-footer">
            <button className="text-button" disabled={!previous} onClick={() => previous && onLocation(previous)}><ChevronLeft size={17} /> {previous ? chapterKey(bible, previous) : ""}</button>
            <span>{book.name} {location.chapterIndex + 1}</span>
            <button className="text-button" disabled={!next} onClick={() => next && onLocation(next)}>{next ? chapterKey(bible, next) : ""} <ChevronRight size={17} /></button>
          </footer>
        </div>
      </article>
    </section>
  );
}
