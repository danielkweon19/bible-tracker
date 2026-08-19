import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";
import type { ActiveReading, ReadingLocation } from "../types";

const COLLECTION = "readingStates";

export type AccountReadingState = {
  location: ReadingLocation;
  active: ActiveReading | null;
};

export function saveReadingState(
  db: Firestore,
  uid: string,
  location: ReadingLocation,
  active: ActiveReading | null
) {
  return setDoc(doc(db, COLLECTION, uid), {
    ...readingStatePayload(uid, location, active),
    updatedAt: serverTimestamp()
  });
}

export function subscribeToReadingState(
  db: Firestore,
  uid: string,
  onData: (state: AccountReadingState | null, fromCache: boolean) => void,
  onError: () => void
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTION, uid),
    snapshot => {
      onData(
        snapshot.exists() ? parseReadingState(snapshot.data()) : null,
        snapshot.metadata.fromCache
      );
    },
    onError
  );
}

export function readingStatePayload(
  uid: string,
  location: ReadingLocation,
  active: ActiveReading | null
) {
  return {
    uid,
    bookIndex: Math.max(0, Math.floor(location.bookIndex)),
    chapterIndex: Math.max(0, Math.floor(location.chapterIndex)),
    activeStartedAt: active ? Math.floor(active.startedAt) : null,
    activeStoppedAt: active?.stoppedAt === undefined ? null : Math.floor(active.stoppedAt),
    activeChapters: active?.chapters ?? []
  };
}

export function parseReadingState(value: unknown): AccountReadingState | null {
  if (typeof value !== "object" || value === null) return null;
  if (
    !("bookIndex" in value) ||
    !Number.isInteger(value.bookIndex) ||
    !("chapterIndex" in value) ||
    !Number.isInteger(value.chapterIndex) ||
    !("activeStartedAt" in value) ||
    !(value.activeStartedAt === null || Number.isFinite(value.activeStartedAt)) ||
    !("activeStoppedAt" in value) ||
    !(value.activeStoppedAt === null || Number.isFinite(value.activeStoppedAt)) ||
    !("activeChapters" in value) ||
    !Array.isArray(value.activeChapters) ||
    !value.activeChapters.every(chapter => typeof chapter === "string")
  ) return null;

  return {
    location: {
      bookIndex: value.bookIndex as number,
      chapterIndex: value.chapterIndex as number
    },
    active: value.activeStartedAt === null
      ? null
      : {
          startedAt: value.activeStartedAt as number,
          ...(value.activeStoppedAt === null
            ? {}
            : { stoppedAt: value.activeStoppedAt as number }),
          chapters: value.activeChapters
        }
  };
}
