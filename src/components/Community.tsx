import { useMemo, useState, type FormEvent } from "react";
import {
  BookCheck,
  Check,
  Clock3,
  Copy,
  DoorOpen,
  LogIn,
  Plus,
  Trophy,
  Users
} from "lucide-react";
import { formatDuration } from "../lib/analytics";
import { normalizeRoomCode } from "../lib/community";
import type { CommunityMember, CommunityRoom, WeeklyShare } from "../types";

type CommunityData = {
  room: CommunityRoom | null;
  members: CommunityMember[];
  shares: WeeklyShare[];
  week: {
    weekKey: string;
    durationSeconds: number;
    chaptersRead: number;
    activeDays: number;
  };
  loading: boolean;
  error: string | null;
  create: (name: string) => Promise<void>;
  join: (code: string) => Promise<void>;
  leave: () => Promise<void>;
};

export function Community({
  community,
  uid,
  demo
}: {
  community: CommunityData;
  uid: string;
  demo: boolean;
}) {
  const data = demo ? demoCommunity(uid) : community;
  if (data.loading) return <div className="loading-state">Loading your community...</div>;
  if (!data.room) return <CommunityOnboarding community={data} />;
  return <CommunityRoomView community={data} uid={uid} />;
}

function CommunityOnboarding({ community }: { community: CommunityData }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy("create");
    await community.create(name);
    setBusy(null);
  }

  async function join(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy("join");
    await community.join(code);
    setBusy(null);
  }

  return (
    <div className="dashboard-view">
      <header className="page-header">
        <div><p className="eyebrow">Read together</p><h1>Community rooms</h1></div>
      </header>
      {community.error && <div className="error-notice community-error">{community.error}</div>}
      <section className="community-intro">
        <Users />
        <div><h2>A shared weekly rhythm</h2><p>Room members see weekly reading time, completed chapter counts, and active days.</p></div>
      </section>
      <div className="community-onboarding">
        <form className="panel community-form" onSubmit={create}>
          <div className="form-icon"><Plus /></div>
          <p className="eyebrow">Start a room</p>
          <h2>Create a community</h2>
          <label>Room name<input maxLength={40} required value={name} onChange={event => setName(event.target.value)} placeholder="Wednesday Bible study" /></label>
          <button className="primary-button" disabled={busy !== null} type="submit"><Users size={18} /> Create room</button>
        </form>
        <form className="panel community-form" onSubmit={join}>
          <div className="form-icon join-icon"><LogIn /></div>
          <p className="eyebrow">Have an invite?</p>
          <h2>Join a community</h2>
          <label>Invite code<input className="code-input" maxLength={6} required value={code} onChange={event => setCode(normalizeRoomCode(event.target.value))} placeholder="ABC123" /></label>
          <button className="secondary-button" disabled={busy !== null || code.length !== 6} type="submit"><DoorOpen size={18} /> Join room</button>
        </form>
      </div>
    </div>
  );
}

function CommunityRoomView({ community, uid }: { community: CommunityData; uid: string }) {
  const [copied, setCopied] = useState(false);
  const room = community.room!;
  const rows = useMemo(() => {
    const shares = new Map(community.shares.map(share => [share.uid, share]));
    return community.members.map(member => ({
      member,
      share: shares.get(member.uid)
    })).sort((left, right) =>
      (right.share?.durationSeconds ?? 0) - (left.share?.durationSeconds ?? 0)
    );
  }, [community.members, community.shares]);
  const totals = community.shares.reduce((result, share) => ({
    seconds: result.seconds + share.durationSeconds,
    chapters: result.chapters + share.chaptersRead
  }), { seconds: 0, chapters: 0 });

  async function copyCode() {
    await navigator.clipboard.writeText(room.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="dashboard-view">
      <header className="community-header">
        <div><p className="eyebrow">Community room</p><h1>{room.name}</h1><span>{community.members.length} {community.members.length === 1 ? "member" : "members"} · Week of {formatWeek(community.week.weekKey)}</span></div>
        <button className="invite-code" onClick={copyCode} title="Copy invite code">
          <span>Invite code</span><strong>{room.id}</strong>{copied ? <Check /> : <Copy />}
        </button>
      </header>
      {community.error && <div className="error-notice community-error">{community.error}</div>}
      <section className="community-metrics">
        <div><Clock3 /><span><small>Room reading time</small><strong>{formatDuration(totals.seconds, true)}</strong></span></div>
        <div><BookCheck /><span><small>Chapters this week</small><strong>{totals.chapters}</strong></span></div>
        <div><Users /><span><small>Readers</small><strong>{community.members.length}</strong></span></div>
      </section>
      <section className="panel leaderboard">
        <div className="panel-heading"><div><p className="eyebrow">This week</p><h2>Room activity</h2></div><Trophy className="leaderboard-trophy" /></div>
        <div className="leaderboard-head"><span>Reader</span><span>Time</span><span>Chapters</span><span>Active days</span></div>
        <div className="leaderboard-list">
          {rows.map(({ member, share }, index) => (
            <div className={member.uid === uid ? "leaderboard-row is-you" : "leaderboard-row"} key={member.uid}>
              <span className="rank">{index + 1}</span>
              <MemberAvatar member={member} />
              <span className="member-name"><strong>{member.displayName}</strong>{member.uid === uid && <small>You</small>}</span>
              <strong>{formatDuration(share?.durationSeconds ?? 0, true)}</strong>
              <strong>{share?.chaptersRead ?? 0}</strong>
              <strong>{share?.activeDays ?? 0}</strong>
            </div>
          ))}
        </div>
      </section>
      {room.ownerUid !== uid && <button className="leave-room text-button" onClick={() => community.leave()}><DoorOpen size={16} /> Leave room</button>}
    </div>
  );
}

function MemberAvatar({ member }: { member: CommunityMember }) {
  if (member.photoURL) return <img className="member-avatar" src={member.photoURL} alt="" />;
  return <span className="member-avatar member-avatar-fallback">{member.displayName[0]?.toUpperCase() || "R"}</span>;
}

function formatWeek(weekKey: string) {
  const [year, month, day] = weekKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function demoCommunity(uid: string): CommunityData {
  const members: CommunityMember[] = [
    { uid, displayName: "Daniel", photoURL: null, joinedAt: new Date() },
    { uid: "demo-grace", displayName: "Grace", photoURL: null, joinedAt: new Date() },
    { uid: "demo-michael", displayName: "Michael", photoURL: null, joinedAt: new Date() }
  ];
  const weekKey = new Date().toISOString().slice(0, 10);
  const shares: WeeklyShare[] = [
    { uid, displayName: "Daniel", photoURL: null, weekKey, durationSeconds: 5640, chaptersRead: 15, activeDays: 3, updatedAt: new Date() },
    { uid: "demo-grace", displayName: "Grace", photoURL: null, weekKey, durationSeconds: 7200, chaptersRead: 11, activeDays: 5, updatedAt: new Date() },
    { uid: "demo-michael", displayName: "Michael", photoURL: null, weekKey, durationSeconds: 3300, chaptersRead: 8, activeDays: 2, updatedAt: new Date() }
  ];
  return {
    room: { id: "READ24", name: "Wednesday Bible Study", ownerUid: uid, createdAt: new Date() },
    members,
    shares,
    week: { weekKey, durationSeconds: 5640, chaptersRead: 15, activeDays: 3 },
    loading: false,
    error: null,
    create: async () => undefined,
    join: async () => undefined,
    leave: async () => undefined
  };
}
