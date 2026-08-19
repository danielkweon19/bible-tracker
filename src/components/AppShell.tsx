import { useEffect, useRef, useState } from "react";
import { signOut, type User } from "firebase/auth";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  History as HistoryIcon,
  Library,
  LineChart,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { auth } from "../lib/firebase";
import type { ActiveReading, BibleData, ReadingLocation, ReadingSession } from "../types";
import { History, Insights } from "./DashboardViews";
import { Reader } from "./Reader";

export type View = "read" | "insights" | "history";

export function AppShell({
  user,
  bible,
  sessions,
  loading,
  error,
  demo,
  location,
  active,
  initialView,
  onLocation,
  onStart,
  onCompleteNext,
  onStop,
  onFinish,
  saving,
  onDiscard,
  onDelete
}: {
  user: Pick<User, "uid" | "displayName" | "email" | "photoURL">;
  bible: BibleData;
  sessions: ReadingSession[];
  loading: boolean;
  error: string | null;
  demo: boolean;
  location: ReadingLocation;
  active: ActiveReading | null;
  initialView: View;
  onLocation: (location: ReadingLocation) => void;
  onStart: () => void;
  onCompleteNext: () => void;
  onStop: () => void;
  onFinish: () => void;
  saving: boolean;
  onDiscard: () => void;
  onDelete: (id: string) => void;
}) {
  const [view, setView] = useState<View>(initialView);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstName = user.displayName?.split(" ")[0] || "Reader";

  function navigate(next: View) {
    setView(next);
    setMobileMenu(false);
  }

  useEffect(() => {
    if (!accountMenu) return;
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setAccountMenu(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [accountMenu]);

  return (
    <div className="app-shell">
      <aside className={mobileMenu ? "sidebar open" : "sidebar"}>
        <div className="brand"><BookOpen size={20} /> Bible Tracker</div>
        <button className="icon-button close-menu" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X /></button>
        <nav>
          <button className={view === "read" ? "active" : ""} onClick={() => navigate("read")}><Library /> Read</button>
          <button className={view === "insights" ? "active" : ""} onClick={() => navigate("insights")}><LineChart /> Insights</button>
          <button className={view === "history" ? "active" : ""} onClick={() => navigate("history")}><HistoryIcon /> History</button>
        </nav>
        {active && <button className="active-reading-card" onClick={() => navigate("read")}>{active.stoppedAt === undefined ? <span className="live-dot" /> : <CheckCircle2 className="stopped-icon" />}<span><strong>{active.stoppedAt === undefined ? "Reading in progress" : "Session ready to save"}</strong><small>{bible.books[location.bookIndex].name} {location.chapterIndex + 1}</small></span></button>}
        <div className="user-menu" ref={menuRef}>
          <button className="user-trigger" onClick={() => setAccountMenu(open => !open)} aria-expanded={accountMenu}>
            <Avatar user={user} />
            <span><strong>{user.displayName || "Bible reader"}</strong><small>{user.email}</small></span>
            <ChevronDown className={accountMenu ? "open" : ""} size={17} />
          </button>
          {accountMenu && <div className="account-dropdown">
            {demo ? <span>Demo account</span> : <button onClick={() => auth && signOut(auth)}><LogOut size={17} /> Log out</button>}
          </div>}
        </div>
      </aside>
      {mobileMenu && <button className="menu-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}
      <main className={view === "read" ? "main-content reader-main" : "main-content"}>
        <button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu /></button>
        {demo && <div className="demo-notice">Demo preview. Changes stay in this browser session.</div>}
        {error && <div className="error-notice">{error}</div>}
        {loading && view !== "read" && <div className="sync-notice">Syncing your reading history...</div>}
        {view === "read" ? <Reader bible={bible} location={location} active={active} onLocation={onLocation} onStart={onStart} onCompleteNext={onCompleteNext} onStop={onStop} onFinish={onFinish} saving={saving} onDiscard={onDiscard} /> :
          view === "insights" ? <Insights sessions={sessions} firstName={firstName} onRead={() => navigate("read")} /> :
          <History sessions={sessions} onDelete={onDelete} />}
      </main>
    </div>
  );
}

function Avatar({ user }: { user: Pick<User, "displayName" | "email" | "photoURL"> }) {
  if (user.photoURL) return <img className="avatar" src={user.photoURL} alt="" />;
  return <span className="avatar avatar-fallback">{(user.displayName || user.email || "R")[0].toUpperCase()}</span>;
}
