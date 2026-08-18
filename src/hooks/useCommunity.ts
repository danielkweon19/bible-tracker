import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { currentWeekShare } from "../lib/analytics";
import {
  createCommunityRoom,
  joinCommunityRoom,
  leaveCommunityRoom,
  publishWeeklyShare,
  subscribeToCommunityProfile,
  subscribeToMembers,
  subscribeToRoom,
  subscribeToWeeklyShares
} from "../lib/community";
import type { CommunityMember, CommunityRoom, ReadingSession, WeeklyShare } from "../types";

export function useCommunity(
  user: Pick<User, "uid" | "displayName" | "email" | "photoURL"> | null,
  sessions: ReadingSession[],
  enabled: boolean,
  sessionsSynced: boolean
) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<CommunityRoom | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [shares, setShares] = useState<WeeklyShare[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const week = useMemo(() => currentWeekShare(sessions), [sessions]);
  const identity = useMemo(() => ({
    displayName: user?.displayName || user?.email?.split("@")[0] || "Reader",
    photoURL: user?.photoURL ?? null
  }), [user?.displayName, user?.email, user?.photoURL]);

  useEffect(() => {
    if (!enabled || !user || !db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeToCommunityProfile(
      db,
      user.uid,
      nextRoomId => {
        setRoomId(nextRoomId);
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError("Your community room could not be loaded.");
      }
    );
  }, [enabled, user?.uid]);

  useEffect(() => {
    if (!enabled || !roomId || !db) {
      setRoom(null);
      setMembers([]);
      setShares([]);
      return;
    }
    const fail = () => setError("This community room could not be loaded.");
    const unsubscribeRoom = subscribeToRoom(db, roomId, setRoom, fail);
    const unsubscribeMembers = subscribeToMembers(db, roomId, setMembers, fail);
    const unsubscribeShares = subscribeToWeeklyShares(db, roomId, week.weekKey, setShares, fail);
    return () => {
      unsubscribeRoom();
      unsubscribeMembers();
      unsubscribeShares();
    };
  }, [enabled, roomId, week.weekKey]);

  useEffect(() => {
    if (!enabled || !sessionsSynced || !roomId || !user || !db) return;
    publishWeeklyShare(db, roomId, {
      uid: user.uid,
      displayName: identity.displayName,
      photoURL: identity.photoURL,
      ...week
    }).catch(() => setError("Your weekly community stats could not be updated."));
  }, [
    enabled,
    sessionsSynced,
    roomId,
    user?.uid,
    identity.displayName,
    identity.photoURL,
    week.weekKey,
    week.durationSeconds,
    week.chaptersRead,
    week.activeDays
  ]);

  return {
    room,
    members,
    shares,
    week,
    loading,
    error,
    async create(name: string) {
      if (!db || !user) return;
      setError(null);
      try {
        await createCommunityRoom(db, user.uid, name, identity);
      } catch {
        setError("The room could not be created. Please try again.");
      }
    },
    async join(code: string) {
      if (!db || !user) return;
      setError(null);
      try {
        await joinCommunityRoom(db, user.uid, code, identity);
      } catch (joinError) {
        setError(
          joinError instanceof Error && joinError.message === "ROOM_NOT_FOUND"
            ? "No room was found with that invite code."
            : joinError instanceof Error && joinError.message === "ALREADY_IN_ROOM"
              ? "Leave your current room before joining another one."
              : "The room could not be joined."
        );
      }
    },
    async leave() {
      if (!db || !user || !room) return;
      if (room.ownerUid === user.uid) {
        setError("The room owner cannot leave while other members use this room.");
        return;
      }
      await leaveCommunityRoom(db, user.uid, room.id, week.weekKey);
    }
  };
}
