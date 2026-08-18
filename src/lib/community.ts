import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";
import type { CommunityMember, CommunityRoom, WeeklyShare } from "../types";

const CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type MemberIdentity = {
  displayName: string;
  photoURL: string | null;
};

export async function createCommunityRoom(
  db: Firestore,
  uid: string,
  name: string,
  identity: MemberIdentity
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomId = roomCode();
    const roomRef = doc(db, "rooms", roomId);
    const profileRef = doc(db, "communityProfiles", uid);
    try {
      await runTransaction(db, async transaction => {
        const existing = await transaction.get(roomRef);
        const profile = await transaction.get(profileRef);
        if (profile.exists()) throw new Error("ALREADY_IN_ROOM");
        if (existing.exists()) throw new Error("ROOM_CODE_COLLISION");
        transaction.set(roomRef, {
          name: name.trim(),
          ownerUid: uid,
          createdAt: serverTimestamp()
        });
        transaction.set(doc(roomRef, "members", uid), {
          uid,
          displayName: identity.displayName,
          photoURL: identity.photoURL,
          joinedAt: serverTimestamp()
        });
        transaction.set(profileRef, {
          roomId,
          updatedAt: serverTimestamp()
        });
      });
      return roomId;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ROOM_CODE_COLLISION") throw error;
    }
  }
  throw new Error("ROOM_CODE_UNAVAILABLE");
}

export async function joinCommunityRoom(
  db: Firestore,
  uid: string,
  code: string,
  identity: MemberIdentity
) {
  const roomId = normalizeRoomCode(code);
  const roomRef = doc(db, "rooms", roomId);
  const profileRef = doc(db, "communityProfiles", uid);
  await runTransaction(db, async transaction => {
    const room = await transaction.get(roomRef);
    const profile = await transaction.get(profileRef);
    if (profile.exists()) throw new Error("ALREADY_IN_ROOM");
    if (!room.exists()) throw new Error("ROOM_NOT_FOUND");
    transaction.set(doc(roomRef, "members", uid), {
      uid,
      displayName: identity.displayName,
      photoURL: identity.photoURL,
      joinedAt: serverTimestamp()
    });
    transaction.set(profileRef, {
      roomId,
      updatedAt: serverTimestamp()
    });
  });
}

export async function leaveCommunityRoom(
  db: Firestore,
  uid: string,
  roomId: string,
  weekKey: string
) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "rooms", roomId, "members", uid));
  batch.delete(doc(db, "rooms", roomId, "weeklyStats", `${weekKey}_${uid}`));
  batch.delete(doc(db, "communityProfiles", uid));
  await batch.commit();
}

export async function publishWeeklyShare(
  db: Firestore,
  roomId: string,
  share: Omit<WeeklyShare, "updatedAt">
) {
  await setDoc(
    doc(db, "rooms", roomId, "weeklyStats", `${share.weekKey}_${share.uid}`),
    { ...share, updatedAt: serverTimestamp() }
  );
}

export function subscribeToCommunityProfile(
  db: Firestore,
  uid: string,
  onData: (roomId: string | null) => void,
  onError: () => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "communityProfiles", uid),
    snapshot => onData(snapshot.exists() && typeof snapshot.data().roomId === "string"
      ? snapshot.data().roomId
      : null),
    onError
  );
}

export function subscribeToRoom(
  db: Firestore,
  roomId: string,
  onData: (room: CommunityRoom | null) => void,
  onError: () => void
): Unsubscribe {
  return onSnapshot(doc(db, "rooms", roomId), snapshot => {
    if (!snapshot.exists()) {
      onData(null);
      return;
    }
    const data = snapshot.data();
    onData({
      id: snapshot.id,
      name: typeof data.name === "string" ? data.name : "Community room",
      ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "",
      createdAt: data.createdAt ?? null
    });
  }, onError);
}

export function subscribeToMembers(
  db: Firestore,
  roomId: string,
  onData: (members: CommunityMember[]) => void,
  onError: () => void
): Unsubscribe {
  return onSnapshot(collection(db, "rooms", roomId, "members"), snapshot => {
    onData(snapshot.docs.map(item => {
      const data = item.data();
      return {
        uid: item.id,
        displayName: typeof data.displayName === "string" ? data.displayName : "Reader",
        photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
        joinedAt: data.joinedAt ?? null
      };
    }));
  }, onError);
}

export function subscribeToWeeklyShares(
  db: Firestore,
  roomId: string,
  weekKey: string,
  onData: (shares: WeeklyShare[]) => void,
  onError: () => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "rooms", roomId, "weeklyStats"), where("weekKey", "==", weekKey)),
    snapshot => {
      const shares = snapshot.docs.map(item => {
        const data = item.data();
        return {
          uid: typeof data.uid === "string" ? data.uid : "",
          displayName: typeof data.displayName === "string" ? data.displayName : "Reader",
          photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
          weekKey: typeof data.weekKey === "string" ? data.weekKey : weekKey,
          durationSeconds: typeof data.durationSeconds === "number" ? data.durationSeconds : 0,
          chaptersRead: typeof data.chaptersRead === "number" ? data.chaptersRead : 0,
          activeDays: typeof data.activeDays === "number" ? data.activeDays : 0,
          updatedAt: data.updatedAt ?? null
        } satisfies WeeklyShare;
      });
      shares.sort((left, right) => right.durationSeconds - left.durationSeconds);
      onData(shares);
    },
    onError
  );
}

export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function roomCode(): string {
  const values = crypto.getRandomValues(new Uint32Array(6));
  return [...values].map(value => CODE_CHARACTERS[value % CODE_CHARACTERS.length]).join("");
}
