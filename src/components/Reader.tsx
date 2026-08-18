import { useEffect, useMemo, useState } from "react";
import {
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Play,
  TimerReset,
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
  onCompleteNext,
  onFinish,
  onDiscard
}: {
  bible: BibleData;
  location: ReadingLocation;
  active: ActiveReading | null;
  onLocation: (location: ReadingLocation) => void;
  onStart: () => void;
  onCompleteNext: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const [, tick] = useState(0);
  const book = bible.books[location.bookIndex];
  const chapter = book.chapters[location.chapterIndex];
  const reference = chapterKey(bible, location);
  const alreadyCompleted = active?.chapters.includes(reference) ?? false;
  const previous = useMemo(() => previousLocation(bible, location), [bible, location]);
  const next = useMemo(() => nextLocation(bible, location), [bible, location]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => tick(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    document.querySelector(".reader-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.bookIndex, location.chapterIndex]);

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
          <div className="session-clock"><span className="live-dot" /><TimerReset size={17} /><strong>{formatTimer((Date.now() - active.startedAt) / 1000)}</strong></div>
          <span className="session-count">{active.chapters.length} completed</span>
          <div className="session-actions">
            <button className="secondary-button" onClick={onCompleteNext} disabled={alreadyCompleted && !next}>
              <BookmarkCheck size={17} /> {alreadyCompleted ? "Completed" : next ? "Complete & next" : "Mark complete"}
            </button>
            <button className="primary-button" onClick={onFinish}><CircleStop size={17} /> Finish & save</button>
            <button className="icon-button discard-button" onClick={onDiscard} title="Discard reading session" aria-label="Discard reading session"><X /></button>
          </div>
        </div>
      ) : (
        <div className="session-start">
          <div><strong>Ready to read {reference}</strong><span>NKJV · {chapter.verses.length} verses</span></div>
          <button className="primary-button" onClick={onStart}><Play size={17} fill="currentColor" /> Start session</button>
        </div>
      )}

      <article className="reader-scroll">
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
