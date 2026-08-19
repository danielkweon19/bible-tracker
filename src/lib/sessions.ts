import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";
import type { ReadingSession } from "../types";

const COLLECTION = "readingSessions";
const LEGACY_DUPLICATE_WINDOW_MS = 15_000;

export async function addReadingSession(
  db: Firestore,
  uid: string,
  startedAt: number,
  durationSeconds: number,
  chapters: string[],
  verseCount: number
) {
  await setDoc(doc(db, COLLECTION, readingSessionId(uid, startedAt)), {
    uid,
    durationSeconds: Math.max(1, Math.floor(durationSeconds)),
    chapters,
    verseCount,
    createdAt: serverTimestamp()
  });
}

export function readingSessionId(uid: string, startedAt: number): string {
  return `${encodeURIComponent(uid)}-${Math.max(0, Math.floor(startedAt)).toString(36)}`;
}

export async function removeReadingSession(db: Firestore, id: string) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function clearReadingSessions(db: Firestore, uid: string) {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("uid", "==", uid))
  );
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = writeBatch(db);
    snapshot.docs.slice(index, index + 450).forEach(item => batch.delete(item.ref));
    await batch.commit();
  }
}

export function subscribeToReadingSessions(
  db: Firestore,
  uid: string,
  onData: (sessions: ReadingSession[]) => void,
  onError: () => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLLECTION), where("uid", "==", uid)),
    snapshot => {
      const sessions = snapshot.docs.flatMap(item => {
        const data = item.data();
        if (
          typeof data.uid !== "string" ||
          typeof data.durationSeconds !== "number" ||
          typeof data.verseCount !== "number" ||
          !Array.isArray(data.chapters) ||
          !data.chapters.every(chapter => typeof chapter === "string")
        ) return [];
        return [{
          id: item.id,
          uid: data.uid,
          durationSeconds: data.durationSeconds,
          chapters: data.chapters,
          verseCount: data.verseCount,
          createdAt: data.createdAt ?? null
        } satisfies ReadingSession];
      });
      sessions.sort((left, right) => sessionTime(right) - sessionTime(left));
      onData(deduplicateReadingSessions(sessions));
    },
    onError
  );
}

export function deduplicateReadingSessions(sessions: ReadingSession[]): ReadingSession[] {
  const unique: ReadingSession[] = [];
  sessions.forEach(session => {
    const duplicate = unique.some(existing => {
      if (sessionFingerprint(existing) !== sessionFingerprint(session)) return false;
      const existingTime = sessionTime(existing);
      const sessionTimeValue = sessionTime(session);
      if (!existingTime && !sessionTimeValue) return true;
      return Math.abs(existingTime - sessionTimeValue) <= LEGACY_DUPLICATE_WINDOW_MS;
    });
    if (!duplicate) unique.push(session);
  });
  return unique;
}

export function sessionDate(session: ReadingSession): Date | null {
  if (!session.createdAt) return null;
  return session.createdAt instanceof Date ? session.createdAt : session.createdAt.toDate();
}

function sessionTime(session: ReadingSession): number {
  const date = sessionDate(session);
  return date?.getTime() ?? 0;
}

function sessionFingerprint(session: ReadingSession): string {
  return JSON.stringify([
    session.uid,
    session.durationSeconds,
    session.chapters,
    session.verseCount
  ]);
}
