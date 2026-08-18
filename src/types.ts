import type { Timestamp } from "firebase/firestore";

export type BibleVerse = {
  num: number;
  text: string;
};

export type BibleChapter = {
  verses: BibleVerse[];
};

export type BibleBook = {
  name: string;
  chapters: BibleChapter[];
};

export type BibleData = {
  version: string;
  books: BibleBook[];
};

export type ReadingSession = {
  id: string;
  uid: string;
  durationSeconds: number;
  chapters: string[];
  verseCount: number;
  createdAt: Timestamp | Date | null;
};

export type ActiveReading = {
  startedAt: number;
  chapters: string[];
};

export type ReadingLocation = {
  bookIndex: number;
  chapterIndex: number;
};

export type CommunityRoom = {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: Timestamp | Date | null;
};

export type CommunityMember = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  joinedAt: Timestamp | Date | null;
};

export type WeeklyShare = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  weekKey: string;
  durationSeconds: number;
  chaptersRead: number;
  activeDays: number;
  updatedAt: Timestamp | Date | null;
};
