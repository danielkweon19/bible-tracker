import type { BibleData, ReadingLocation } from "../types";

export function chapterKey(bible: BibleData, location: ReadingLocation): string {
  return `${bible.books[location.bookIndex].name} ${location.chapterIndex + 1}`;
}

export function nextLocation(bible: BibleData, location: ReadingLocation): ReadingLocation | null {
  const book = bible.books[location.bookIndex];
  if (location.chapterIndex + 1 < book.chapters.length) {
    return { ...location, chapterIndex: location.chapterIndex + 1 };
  }
  if (location.bookIndex + 1 < bible.books.length) {
    return { bookIndex: location.bookIndex + 1, chapterIndex: 0 };
  }
  return null;
}

export function previousLocation(bible: BibleData, location: ReadingLocation): ReadingLocation | null {
  if (location.chapterIndex > 0) {
    return { ...location, chapterIndex: location.chapterIndex - 1 };
  }
  if (location.bookIndex > 0) {
    const previousBook = bible.books[location.bookIndex - 1];
    return { bookIndex: location.bookIndex - 1, chapterIndex: previousBook.chapters.length - 1 };
  }
  return null;
}

export function verseCountForKeys(bible: BibleData, keys: string[]): number {
  const counts = new Map<string, number>();
  bible.books.forEach(book => {
    book.chapters.forEach((chapter, index) => {
      counts.set(`${book.name} ${index + 1}`, chapter.verses.length);
    });
  });
  return keys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
}

export function uniqueChapters(chapters: string[]): string[] {
  return [...new Set(chapters)];
}
