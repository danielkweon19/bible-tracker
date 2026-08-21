import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Loader2, Settings } from "lucide-react";
import { AuthScreen } from "./components/AuthScreen";
import { AppShell } from "./components/AppShell";
import { useAppUpdate } from "./hooks/useAppUpdate";
import { useAuth } from "./hooks/useAuth";
import { useBible } from "./hooks/useBible";
import { useSessions } from "./hooks/useSessions";
import { formatTimer } from "./lib/analytics";
import { chapterKey, uniqueChapters, verseCountForKeys } from "./lib/bible";
import { demoSessions, demoUser } from "./lib/demo";
import { db, isFirebaseConfigured } from "./lib/firebase";
import { saveReadingState, subscribeToReadingState } from "./lib/readingState";
import {
  clearReadingSessions,
  deduplicateReadingSessions,
  readingSessionId,
  ReadingSessionSyncTimeoutError,
  removeReadingSessions,
  syncReadingSessions
} from "./lib/sessions";
import type { ActiveReading, ReadingLocation, ReadingSession } from "./types";

const ACTIVE_KEY = "selah-bible.active";
const LOCATION_KEY = "selah-bible.location";
const DEFAULT_LOCATION: ReadingLocation = { bookIndex: 42, chapterIndex: 0 };
type SaveConfirmation = { title: string; detail: string };

export default function App() {
  useAppUpdate();
  const demo = new URLSearchParams(window.location.search).get("demo") === "1";
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { bible, error: bibleError } = useBible();
  const user = demo ? demoUser : firebaseUser;
  const uid = user && !demo ? user.uid : null;
  const { sessions, setSessions, loading, error } = useSessions(uid, demo ? demoSessions : []);
  const [location, setLocation] = useState<ReadingLocation>(DEFAULT_LOCATION);
  const [active, setActive] = useState<ActiveReading | null>(null);
  const [savedConfirmation, setSavedConfirmation] = useState<SaveConfirmation | null>(null);
  const [toast, setToast] = useState("");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const submittedSessions = useRef(new Set<number>());

  useEffect(() => {
    if (!user || !bible) return;
    const storedLocation = readJson<ReadingLocation>(`${LOCATION_KEY}.${user.uid}`);
    if (
      storedLocation &&
      bible.books[storedLocation.bookIndex]?.chapters[storedLocation.chapterIndex]
    ) setLocation(storedLocation);
    const storedActive = readJson<ActiveReading>(`${ACTIVE_KEY}.${user.uid}`);
    if (
      storedActive &&
      Number.isFinite(storedActive.startedAt) &&
      (storedActive.stoppedAt === undefined || Number.isFinite(storedActive.stoppedAt)) &&
      Array.isArray(storedActive.chapters)
    ) setActive(storedActive);
  }, [user?.uid, bible]);

  useEffect(() => {
    const accountDb = db;
    if (!uid || !accountDb || !bible) return;
    return subscribeToReadingState(
      accountDb,
      uid,
      (accountState, fromCache) => {
        if (!accountState) {
          if (fromCache) return;
          const fallbackLocation = readStoredLocation(user!.uid, bible) ?? DEFAULT_LOCATION;
          const fallbackActive = readStoredActive(user!.uid);
          void saveReadingState(accountDb, uid, fallbackLocation, fallbackActive);
          return;
        }
        if (!bible.books[accountState.location.bookIndex]?.chapters[accountState.location.chapterIndex]) return;
        setLocation(accountState.location);
        setActive(accountState.active);
        persistLocalState(user!.uid, accountState.location, accountState.active);
      },
      () => showToast("Your reading progress could not sync across devices.")
    );
  }, [uid, bible]);

  if (!isFirebaseConfigured && !demo) return <SetupScreen />;
  if ((authLoading && !demo) || !bible) {
    return <div className="full-loader"><Loader2 className="spin" /><span>{bibleError ?? "Opening Bible Tracker"}</span></div>;
  }
  if (!user) return <AuthScreen />;

  function changeLocation(next: ReadingLocation) {
    setLocation(next);
    let nextActive = active;
    if (active && active.stoppedAt === undefined && bible) {
      const chapters = uniqueChapters([...active.chapters, chapterKey(bible, next)]);
      if (chapters.length !== active.chapters.length) {
        nextActive = { ...active, chapters };
        setActive(nextActive);
      }
    }
    persistReadingState(next, nextActive);
  }

  function startReading() {
    if (!bible) return;
    const next = {
      startedAt: Date.now(),
      chapters: [chapterKey(bible, location)]
    };
    setActive(next);
    persistReadingState(location, next);
  }

  function stopReading() {
    if (!active || active.stoppedAt !== undefined) return;
    const stopped = { ...active, stoppedAt: Date.now() };
    setActive(stopped);
    persistReadingState(location, stopped);
  }

  async function finishReading() {
    if (!active || !bible) return;
    const sessionToSave = active;
    if (submittedSessions.current.has(sessionToSave.startedAt)) return;
    submittedSessions.current.add(sessionToSave.startedAt);
    const chapters = uniqueChapters([...active.chapters, chapterKey(bible, location)]);
    const durationSeconds = Math.max(
      1,
      Math.floor(((active.stoppedAt ?? Date.now()) - active.startedAt) / 1000)
    );
    const verseCount = verseCountForKeys(bible, chapters);
    const sessionSummary = `${formatTimer(durationSeconds)} · ${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}`;

    try {
      const session: ReadingSession = {
        id: demo
          ? `demo-${sessionToSave.startedAt}`
          : readingSessionId(user!.uid, sessionToSave.startedAt),
        uid: user!.uid,
        durationSeconds,
        chapters,
        verseCount,
        createdAt: new Date(sessionToSave.startedAt)
      };
      if (demo) {
        setSessions(current => [session, ...current]);
      } else if (db && firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        await syncReadingSessions(db, idToken, firebaseUser.uid, [session]);
        setSessions(current => deduplicateReadingSessions([session, ...current]));
      } else {
        throw new Error("Reading history is not connected.");
      }
      clearActive();
      showSavedConfirmation({
        title: "Session saved",
        detail: `${sessionSummary} added to history`
      });
    } catch {
      submittedSessions.current.delete(sessionToSave.startedAt);
      showToast("Session could not sync. It is still ready to save.");
    }
  }

  function discardReading() {
    if (!window.confirm("Discard this reading session? Its time and chapters will not be saved.")) return;
    clearActive();
  }

  async function deleteSessions(ids: string[]) {
    if (!window.confirm("Delete this day's reading record? This cannot be undone.")) return;
    try {
      if (demo) {
        const idsToDelete = new Set(ids);
        setSessions(current => current.filter(session => !idsToDelete.has(session.id)));
      } else if (db) {
        await removeReadingSessions(db, ids);
      }
    } catch {
      showToast("That reading record could not be deleted.");
    }
  }

  async function clearHistory() {
    if (!window.confirm("Clear your entire reading history? This cannot be undone.")) return;
    const previousSessions = sessions;
    setClearingHistory(true);
    setSessions([]);
    showToast("Clearing reading history...");
    try {
      if (!demo && db && user) {
        await clearReadingSessions(
          db,
          user.uid,
          previousSessions.map(session => session.id)
        );
      }
      showToast("Reading history cleared.");
    } catch {
      setSessions(previousSessions);
      showToast("Your reading history could not be cleared.");
    } finally {
      setClearingHistory(false);
    }
  }

  async function syncHistory() {
    if (demo || !db || !firebaseUser || !sessions.length || syncingHistory) return;
    setSyncingHistory(true);
    showToast("Syncing this device's history...");
    try {
      const idToken = await firebaseUser.getIdToken();
      await syncReadingSessions(db, idToken, firebaseUser.uid, sessions);
      showToast("History synced. Refresh your other device.");
    } catch (syncError) {
      showToast(syncError instanceof ReadingSessionSyncTimeoutError
        ? "Sync timed out. Keep this device online and try again."
        : "History could not sync. Keep this device online and try again.");
    } finally {
      setSyncingHistory(false);
    }
  }

  function persistReadingState(nextLocation: ReadingLocation, nextActive: ActiveReading | null) {
    persistLocalState(user!.uid, nextLocation, nextActive);
    if (uid && db) {
      void saveReadingState(db, uid, nextLocation, nextActive)
        .catch(() => showToast("Your reading progress could not sync across devices."));
    }
  }

  function clearActive() {
    setActive(null);
    persistReadingState(location, null);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function showSavedConfirmation(confirmation: SaveConfirmation) {
    setSavedConfirmation(confirmation);
    window.setTimeout(() => setSavedConfirmation(null), 4200);
  }

  return (
    <>
      <AppShell
        user={user}
        bible={bible}
        sessions={clearingHistory ? [] : sessions}
        loading={loading}
        error={error || bibleError}
        demo={demo}
        location={location}
        active={active}
        initialView="read"
        onLocation={changeLocation}
        onStart={startReading}
        onStop={stopReading}
        onFinish={finishReading}
        onDiscard={discardReading}
        onDelete={deleteSessions}
        onClearHistory={clearHistory}
        onSyncHistory={syncHistory}
        syncingHistory={syncingHistory}
      />
      {savedConfirmation && (
        <div className="save-confirmation" role="status">
          <CheckCircle2 />
          <span><strong>{savedConfirmation.title}</strong><small>{savedConfirmation.detail}</small></span>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function SetupScreen() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="setup-icon"><Settings /></div>
        <div className="brand"><BookOpen size={20} /> Bible Tracker</div>
        <p className="eyebrow">One-time setup</p>
        <h1>Connect your Firebase project</h1>
        <p>Add your Firebase web app credentials to <code>.env.local</code>, then restart the development server.</p>
        <ol>
          <li>Enable Google and Email/Password authentication.</li>
          <li>Create a Firestore database.</li>
          <li>Deploy the included Firestore rules.</li>
        </ol>
        <a className="primary-button" href="?demo=1">Open demo preview</a>
      </section>
    </main>
  );
}

function readJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function readStoredLocation(uid: string, bible: NonNullable<ReturnType<typeof useBible>["bible"]>) {
  const stored = readJson<ReadingLocation>(`${LOCATION_KEY}.${uid}`);
  return stored && bible.books[stored.bookIndex]?.chapters[stored.chapterIndex]
    ? stored
    : null;
}

function readStoredActive(uid: string): ActiveReading | null {
  const stored = readJson<ActiveReading>(`${ACTIVE_KEY}.${uid}`);
  return stored &&
    Number.isFinite(stored.startedAt) &&
    (stored.stoppedAt === undefined || Number.isFinite(stored.stoppedAt)) &&
    Array.isArray(stored.chapters)
    ? stored
    : null;
}

function persistLocalState(
  uid: string,
  location: ReadingLocation,
  active: ActiveReading | null
) {
  window.localStorage.setItem(`${LOCATION_KEY}.${uid}`, JSON.stringify(location));
  if (active) window.localStorage.setItem(`${ACTIVE_KEY}.${uid}`, JSON.stringify(active));
  else window.localStorage.removeItem(`${ACTIVE_KEY}.${uid}`);
}
