import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";
import type { ReadingSession } from "../types";

const COLLECTION = "readingSessions";
const SAVE_ACK_TIMEOUT_MS = 4_000;

export type ReadingSessionSaveStatus = "confirmed" | "pending";

export async function addReadingSession(
  db: Firestore,
  uid: string,
  durationSeconds: number,
  chapters: string[],
  verseCount: number
) {
  await addDoc(collection(db, COLLECTION), {
    uid,
    durationSeconds: Math.max(1, Math.floor(durationSeconds)),
    chapters,
    verseCount,
    createdAt: serverTimestamp()
  });
}

export async function waitForReadingSessionSave(
  save: Promise<void>,
  timeoutMs = SAVE_ACK_TIMEOUT_MS
): Promise<ReadingSessionSaveStatus> {
  let timeout: number | undefined;
  const pending = new Promise<ReadingSessionSaveStatus>(resolve => {
    timeout = window.setTimeout(() => resolve("pending"), timeoutMs);
  });

  try {
    return await Promise.race([
      save.then(() => "confirmed" as const),
      pending
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

export async function removeReadingSession(db: Firestore, id: string) {
  await deleteDoc(doc(db, COLLECTION, id));
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
      onData(sessions);
    },
    onError
  );
}

export function sessionDate(session: ReadingSession): Date | null {
  if (!session.createdAt) return null;
  return session.createdAt instanceof Date ? session.createdAt : session.createdAt.toDate();
}

function sessionTime(session: ReadingSession): number {
  const date = sessionDate(session);
  return date?.getTime() ?? 0;
}
