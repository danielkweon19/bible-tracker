import { useEffect, useState } from "react";
import { BookOpen, Loader2, Settings } from "lucide-react";
import { AuthScreen } from "./components/AuthScreen";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./hooks/useAuth";
import { useBible } from "./hooks/useBible";
import { useSessions } from "./hooks/useSessions";
import { chapterKey, nextLocation, uniqueChapters, verseCountForKeys } from "./lib/bible";
import { demoSessions, demoUser } from "./lib/demo";
import { db, isFirebaseConfigured } from "./lib/firebase";
import { addReadingSession, removeReadingSession } from "./lib/sessions";
import type { ActiveReading, ReadingLocation, ReadingSession } from "./types";

const ACTIVE_KEY = "selah-bible.active";
const LOCATION_KEY = "selah-bible.location";
const DEFAULT_LOCATION: ReadingLocation = { bookIndex: 42, chapterIndex: 0 };

export default function App() {
  const demo = new URLSearchParams(window.location.search).get("demo") === "1";
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { bible, error: bibleError } = useBible();
  const user = demo ? demoUser : firebaseUser;
  const uid = user && !demo ? user.uid : null;
  const { sessions, setSessions, loading, error } = useSessions(uid, demo ? demoSessions : []);
  const [location, setLocation] = useState<ReadingLocation>(DEFAULT_LOCATION);
  const [active, setActive] = useState<ActiveReading | null>(null);
  const [toast, setToast] = useState("");

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
      Array.isArray(storedActive.chapters)
    ) setActive(storedActive);
  }, [user?.uid, bible]);

  if (!isFirebaseConfigured && !demo) return <SetupScreen />;
  if ((authLoading && !demo) || !bible) {
    return <div className="full-loader"><Loader2 className="spin" /><span>{bibleError ?? "Opening Selah Bible"}</span></div>;
  }
  if (!user) return <AuthScreen />;

  function changeLocation(next: ReadingLocation) {
    setLocation(next);
    window.localStorage.setItem(`${LOCATION_KEY}.${user!.uid}`, JSON.stringify(next));
  }

  function startReading() {
    const next = { startedAt: Date.now(), chapters: [] };
    setActive(next);
    persistActive(next);
  }

  function completeAndNext() {
    if (!active || !bible) return;
    const chapters = uniqueChapters([...active.chapters, chapterKey(bible, location)]);
    const nextActive = { ...active, chapters };
    setActive(nextActive);
    persistActive(nextActive);
    const next = nextLocation(bible, location);
    if (next) changeLocation(next);
    else showToast("Revelation 22 marked complete.");
  }

  async function finishReading() {
    if (!active || !bible) return;
    const chapters = uniqueChapters([...active.chapters, chapterKey(bible, location)]);
    const durationSeconds = Math.max(1, Math.floor((Date.now() - active.startedAt) / 1000));
    const verseCount = verseCountForKeys(bible, chapters);
    try {
      if (demo) {
        const session: ReadingSession = {
          id: `demo-${Date.now()}`,
          uid: user!.uid,
          durationSeconds,
          chapters,
          verseCount,
          createdAt: new Date()
        };
        setSessions(current => [session, ...current]);
      } else if (db) {
        await addReadingSession(db, user!.uid, durationSeconds, chapters, verseCount);
      }
      clearActive();
      showToast(`${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"} saved to your history.`);
    } catch {
      showToast("This reading session could not be saved.");
    }
  }

  function discardReading() {
    if (!window.confirm("Discard this reading session? Its time and chapters will not be saved.")) return;
    clearActive();
  }

  async function deleteSession(id: string) {
    if (!window.confirm("Delete this reading session? This cannot be undone.")) return;
    try {
      if (demo) setSessions(current => current.filter(session => session.id !== id));
      else if (db) await removeReadingSession(db, id);
    } catch {
      showToast("That session could not be deleted.");
    }
  }

  function persistActive(next: ActiveReading) {
    window.localStorage.setItem(`${ACTIVE_KEY}.${user!.uid}`, JSON.stringify(next));
  }

  function clearActive() {
    window.localStorage.removeItem(`${ACTIVE_KEY}.${user!.uid}`);
    setActive(null);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <>
      <AppShell
        user={user}
        bible={bible}
        sessions={sessions}
        loading={loading}
        error={error || bibleError}
        demo={demo}
        location={location}
        active={active}
        initialView="read"
        onLocation={changeLocation}
        onStart={startReading}
        onCompleteNext={completeAndNext}
        onFinish={finishReading}
        onDiscard={discardReading}
        onDelete={deleteSession}
      />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function SetupScreen() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="setup-icon"><Settings /></div>
        <div className="brand"><BookOpen size={20} /> Selah Bible</div>
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
