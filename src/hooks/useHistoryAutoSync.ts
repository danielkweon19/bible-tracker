import { useEffect, useMemo, useRef } from "react";
import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { syncReadingSessions } from "../lib/sessions";
import type { ReadingSession } from "../types";

const RETRY_DELAY_MS = 30_000;

export function useHistoryAutoSync(
  db: Firestore | null,
  user: User | null,
  sessions: ReadingSession[],
  enabled: boolean
) {
  const synced = useRef(new Set<string>());
  const signature = useMemo(
    () => sessions.map(session => session.id).sort().join("\n"),
    [sessions]
  );

  useEffect(() => {
    if (!enabled || !db || !user || !sessions.length || synced.current.has(signature)) return;

    const accountDb = db;
    const accountUser = user;
    const accountSessions = sessions;
    let stopped = false;
    let running = false;
    let retryTimer: number | undefined;

    function scheduleRetry() {
      if (stopped || retryTimer !== undefined) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void sync();
      }, RETRY_DELAY_MS);
    }

    async function sync() {
      if (stopped || running || synced.current.has(signature)) return;
      if (!navigator.onLine) {
        scheduleRetry();
        return;
      }

      running = true;
      try {
        const idToken = await accountUser.getIdToken();
        await syncReadingSessions(
          accountDb,
          idToken,
          accountUser.uid,
          accountSessions
        );
        if (!stopped) synced.current.add(signature);
      } catch {
        scheduleRetry();
      } finally {
        running = false;
      }
    }

    function syncWhenOnline() {
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      void sync();
    }

    window.addEventListener("online", syncWhenOnline);
    void sync();

    return () => {
      stopped = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener("online", syncWhenOnline);
    };
  }, [db, enabled, sessions, signature, user]);
}
