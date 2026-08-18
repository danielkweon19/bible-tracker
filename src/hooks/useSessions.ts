import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { subscribeToReadingSessions } from "../lib/sessions";
import type { ReadingSession } from "../types";

export function useSessions(uid: string | null, initial: ReadingSession[] = []) {
  const [sessions, setSessions] = useState<ReadingSession[]>(initial);
  const [loading, setLoading] = useState(Boolean(uid && db));
  const [synced, setSynced] = useState(!uid);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSynced(false);
    const timeout = window.setTimeout(() => {
      setLoading(false);
      setError("Reading history is still syncing. You can keep reading while it reconnects.");
    }, 8000);
    const unsubscribe = subscribeToReadingSessions(
      db,
      uid,
      next => {
        window.clearTimeout(timeout);
        setSessions(next);
        setLoading(false);
        setSynced(true);
        setError(null);
      },
      () => {
        window.clearTimeout(timeout);
        setLoading(false);
        setError("Your reading history could not be loaded.");
      }
    );
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [uid]);

  return { sessions, setSessions, loading, synced, error };
}
