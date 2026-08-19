import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { subscribeToReadingSessions } from "../lib/sessions";
import type { ReadingSession } from "../types";

export function useSessions(uid: string | null, initial: ReadingSession[] = []) {
  const [sessions, setSessions] = useState<ReadingSession[]>(initial);
  const [sessionsUid, setSessionsUid] = useState(uid);
  const [loading, setLoading] = useState(Boolean(uid && db));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !db) {
      setLoading(false);
      return;
    }
    setSessions([]);
    setSessionsUid(uid);
    setLoading(true);
    return subscribeToReadingSessions(
      db,
      uid,
      next => {
        setSessions(next);
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError("Your reading history could not be loaded.");
      }
    );
  }, [uid]);

  const visibleSessions = sessionsUid === uid ? sessions : [];
  const isLoading = Boolean(uid && db && (loading || sessionsUid !== uid));

  return { sessions: visibleSessions, setSessions, loading: isLoading, error };
}
