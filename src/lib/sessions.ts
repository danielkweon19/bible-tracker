import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";
import type { DailyReadingRecord, ReadingSession } from "../types";

const COLLECTION = "readingSessions";
const LEGACY_DUPLICATE_WINDOW_MS = 15_000;
const SYNC_TIMEOUT_MS = 15_000;

export class ReadingSessionSyncTimeoutError extends Error {
  constructor() {
    super("Reading history sync timed out.");
    this.name = "ReadingSessionSyncTimeoutError";
  }
}

export function readingSessionId(uid: string, startedAt: number): string {
  return `${encodeURIComponent(uid)}-${Math.max(0, Math.floor(startedAt)).toString(36)}`;
}

export async function removeReadingSessions(db: Firestore, ids: string[]) {
  await deleteSessionRefs(
    db,
    [...new Set(ids)].map(id => doc(db, COLLECTION, id))
  );
}

export async function syncReadingSessions(
  db: Firestore,
  idToken: string,
  uid: string,
  sessions: ReadingSession[],
  timeoutMs = SYNC_TIMEOUT_MS
) {
  const projectId = db.app.options.projectId;
  if (!projectId) throw new Error("Firebase project ID is unavailable.");

  const controller = new AbortController();
  await withTimeout(
    syncReadingSessionsToServer(projectId, idToken, uid, sessions, controller.signal),
    timeoutMs,
    () => controller.abort()
  );
}

async function syncReadingSessionsToServer(
  projectId: string,
  idToken: string,
  uid: string,
  sessions: ReadingSession[],
  signal: AbortSignal
) {
  const ownedSessions = sessions.filter(session => session.uid === uid);
  for (let index = 0; index < ownedSessions.length; index += 450) {
    const chunk = ownedSessions.slice(index, index + 450);
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          writes: chunk.map(session => ({
            update: {
              name: `projects/${projectId}/databases/(default)/documents/${COLLECTION}/${session.id}`,
              fields: {
                uid: { stringValue: uid },
                durationSeconds: {
                  integerValue: String(Math.max(1, Math.floor(session.durationSeconds)))
                },
                chapters: {
                  arrayValue: {
                    values: session.chapters.map(chapter => ({ stringValue: chapter }))
                  }
                },
                verseCount: {
                  integerValue: String(Math.max(1, Math.floor(session.verseCount)))
                },
                createdAt: {
                  timestampValue: syncTimestamp(session).toISOString()
                }
              }
            }
          }))
        }),
        signal
      }
    );
    if (!response.ok) {
      throw new Error(`History sync request failed with status ${response.status}.`);
    }
    const result = await response.json() as { writeResults?: unknown[] };
    if (result.writeResults?.length !== chunk.length) {
      throw new Error("Some reading sessions were not confirmed by the server.");
    }
  }
}

function syncTimestamp(session: ReadingSession): Date {
  const now = Date.now();
  const timestamp = sessionDate(session)?.getTime() ?? now;
  return new Date(Math.min(timestamp, now));
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new ReadingSessionSyncTimeoutError());
      onTimeout?.();
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function clearReadingSessions(
  db: Firestore,
  uid: string,
  visibleSessionIds: string[] = []
) {
  await deleteSessionRefs(
    db,
    [...new Set(visibleSessionIds)].map(id => doc(db, COLLECTION, id))
  );

  // The visible list collapses legacy duplicates, so query again to remove any
  // hidden records that were not represented by the supplied document IDs.
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("uid", "==", uid))
  );
  await deleteSessionRefs(db, snapshot.docs.map(item => item.ref));
}

async function deleteSessionRefs(
  db: Firestore,
  refs: DocumentReference[]
) {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = writeBatch(db);
    refs.slice(index, index + 450).forEach(ref => batch.delete(ref));
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
        const data = item.data({ serverTimestamps: "estimate" });
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
  const encodedDate = dateFromStableId(session);
  if (encodedDate) return encodedDate;

  if (session.createdAt) {
    const date = session.createdAt instanceof Date
      ? session.createdAt
      : session.createdAt.toDate();
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function dateFromStableId(session: ReadingSession): Date | null {
  const prefix = `${encodeURIComponent(session.uid)}-`;
  if (!session.id.startsWith(prefix)) return null;
  const encodedStart = session.id.slice(prefix.length);
  if (!/^[0-9a-z]+$/.test(encodedStart)) return null;
  const startedAt = Number.parseInt(encodedStart, 36);
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) return null;
  const date = new Date(startedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dailyReadingRecords(sessions: ReadingSession[]): DailyReadingRecord[] {
  const records = new Map<string, DailyReadingRecord>();

  sessions.forEach(session => {
    const date = sessionDate(session);
    const key = date ? localDateKey(date) : `unknown-${session.id}`;
    const existing = records.get(key);
    if (!existing) {
      records.set(key, {
        ...session,
        createdAt: date ?? session.createdAt,
        chapters: [...new Set(session.chapters)],
        sessionIds: [session.id],
        sessionCount: 1
      });
      return;
    }

    existing.durationSeconds += session.durationSeconds;
    existing.chapters = [...new Set([...existing.chapters, ...session.chapters])];
    existing.verseCount += session.verseCount;
    existing.sessionIds.push(session.id);
    existing.sessionCount += 1;

    const existingDate = sessionDate(existing);
    if (date && (!existingDate || date > existingDate)) {
      existing.id = session.id;
      existing.createdAt = date;
    }
  });

  return [...records.values()].sort((left, right) => sessionTime(right) - sessionTime(left));
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

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
