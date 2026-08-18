import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { subscribeToReadingSessions } from "../lib/sessions";
import type { ReadingSession } from "../types";

export function useSessions(uid: string | null, initial: ReadingSession[] = []) {
  const [sessions, setSessions] = useState<ReadingSession[]>(initial);
  const [loading, setLoading] = useState(Boolean(uid && db));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !db) return;
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

  return { sessions, setSessions, loading, error };
}
