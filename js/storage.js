import { STORAGE_KEY, LOCATION_STORAGE_KEY, LEGACY_STORAGE_KEYS } from "./config.js";
import { db } from "./firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function getUserDocument(userId) {
  return doc(db, "users", userId);
}

function getUserMembershipsCollection(userId) {
  return collection(db, "users", userId, "householdMemberships");
}

function getUserMembershipDocument(userId, householdId) {
  return doc(db, "users", userId, "householdMemberships", householdId);
}

function getHouseholdDocument(householdId) {
  return doc(db, "households", householdId);
}

function getHouseholdMemberDocument(householdId, userId) {
  return doc(db, "households", householdId, "members", userId);
}

function getHouseholdMembersCollection(householdId) {
  return collection(db, "households", householdId, "members");
}

function getHouseholdInvitationsCollection(householdId) {
  return collection(db, "households", householdId, "invitations");
}

function getHouseholdInvitationDocument(householdId, invitationId) {
  return doc(db, "households", householdId, "invitations", invitationId);
}

function getHouseholdItemsCollection(householdId) {
  return collection(db, "households", householdId, "items");
}

function getHouseholdItemDocument(householdId, itemId) {
  return doc(db, "households", householdId, "items", itemId);
}

function getHouseholdLocationsCollection(householdId) {
  return collection(db, "households", householdId, "locations");
}

function getHouseholdLocationDocument(householdId, locationId) {
  return doc(db, "households", householdId, "locations", locationId);
}

function makeOwnerMember(user, now) {
  return {
    userId: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
    role: "owner",
    status: "active",
    invitedBy: user.uid,
    joinedAt: now,
    updatedAt: now
  };
}

function makeOwnerMembership(householdId, now) {
  return {
    householdId,
    role: "owner",
    status: "active",
    joinedAt: now,
    lastOpenedAt: now
  };
}

async function ensureOwnerMembershipDocs(user, householdId, now) {
  await Promise.all([
    setDoc(getHouseholdMemberDocument(householdId, user.uid), makeOwnerMember(user, now), { merge: true }),
    setDoc(getUserMembershipDocument(user.uid, householdId), makeOwnerMembership(householdId, now), { merge: true })
  ]);
}

export function loadItems() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(current)) return current.map(normalizeItem);

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(legacy)) {
        const migrated = legacy.map(normalizeItem);
        saveItems(migrated);
        return migrated;
      }
    }

    return [];
  } catch {
    return [];
  }
}

export function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizeItem)));
}

export function loadLocations() {
  try {
    const current = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY));
    if (Array.isArray(current)) return current.map(normalizeLocation);
    return [];
  } catch {
    return [];
  }
}

export function saveLocations(locations) {
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locations.map(normalizeLocation)));
}

export async function loadUserHouseholds(userId) {
  const membershipsSnapshot = await getDocs(getUserMembershipsCollection(userId));
  const memberships = membershipsSnapshot.docs
    .map(documentSnapshot => ({
      householdId: documentSnapshot.id,
      ...documentSnapshot.data()
    }))
    .filter(membership => membership.status !== "removed");

  const households = await Promise.all(
    memberships.map(async membership => {
      const householdSnapshot = await getDoc(getHouseholdDocument(membership.householdId));
      if (!householdSnapshot.exists()) return null;

      return {
        id: membership.householdId,
        role: membership.role || "member",
        ...householdSnapshot.data()
      };
    })
  );

  return households
    .filter(Boolean)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function loadHouseholdMembers(householdId) {
  const snapshot = await getDocs(getHouseholdMembersCollection(householdId));

  return snapshot.docs
    .map(documentSnapshot => ({
      userId: documentSnapshot.id,
      ...documentSnapshot.data()
    }))
    .filter(member => member.status !== "removed")
    .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
}

export async function updateHouseholdName(householdId, name) {
  const trimmedName = name.trim();
  const updatedAt = new Date().toISOString();

  await setDoc(
    getHouseholdDocument(householdId),
    {
      name: trimmedName,
      updatedAt
    },
    { merge: true }
  );

  return {
    id: householdId,
    name: trimmedName,
    updatedAt
  };
}

export async function loadHouseholdInvitations(householdId) {
  const snapshot = await getDocs(getHouseholdInvitationsCollection(householdId));

  return snapshot.docs
    .map(documentSnapshot =>
      normalizeInvitation({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      })
    )
    .filter(invitation => invitation.status === "pending")
    .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
}

export async function saveHouseholdInvitation(householdId, invitation) {
  const normalized = normalizeInvitation({
    ...invitation,
    householdId
  });

  await setDoc(getHouseholdInvitationDocument(householdId, normalized.id), normalized);
  return normalized;
}

export async function revokeHouseholdInvitation(householdId, invitationId, userId) {
  const revokedAt = new Date().toISOString();

  await setDoc(
    getHouseholdInvitationDocument(householdId, invitationId),
    {
      status: "revoked",
      revokedBy: userId,
      revokedAt
    },
    { merge: true }
  );

  return {
    id: invitationId,
    householdId,
    status: "revoked",
    revokedBy: userId,
    revokedAt
  };
}

export async function loadHouseholdInvitation(householdId, invitationId) {
  const snapshot = await getDoc(getHouseholdInvitationDocument(householdId, invitationId));
  if (!snapshot.exists()) return null;

  return normalizeInvitation({
    id: snapshot.id,
    ...snapshot.data()
  });
}

export async function acceptHouseholdInvitation(householdId, invitation, user) {
  const now = new Date().toISOString();
  const role = invitation.role === "admin" ? "admin" : "member";
  const member = {
    userId: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
    role,
    status: "active",
    invitedBy: invitation.invitedBy || "",
    invitationId: invitation.id,
    joinedAt: now,
    updatedAt: now
  };
  const membership = {
    householdId,
    role,
    status: "active",
    invitationId: invitation.id,
    joinedAt: now,
    lastOpenedAt: now
  };

  const batch = writeBatch(db);
  batch.set(getHouseholdMemberDocument(householdId, user.uid), member);
  batch.set(getUserMembershipDocument(user.uid, householdId), membership);
  batch.update(getHouseholdInvitationDocument(householdId, invitation.id), {
    status: "accepted",
    acceptedBy: user.uid,
    acceptedAt: now
  });

  await batch.commit();

  return {
    member,
    membership,
    invitation: normalizeInvitation({
      ...invitation,
      status: "accepted",
      acceptedBy: user.uid,
      acceptedAt: now
    })
  };
}

export async function isActiveHouseholdMember(userId, householdId) {
  if (!householdId) return false;

  const membershipSnapshot = await getDoc(getUserMembershipDocument(userId, householdId));
  return membershipSnapshot.exists() && membershipSnapshot.data().status !== "removed";
}

export async function ensureDefaultHousehold(user) {
  const now = new Date().toISOString();
  const userId = user.uid;
  const userProfile = {
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
    updatedAt: now
  };

  const userRef = getUserDocument(userId);
  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.exists() ? userSnapshot.data() : {};

  await setDoc(
    userRef,
    {
      ...userProfile,
      createdAt: userData.createdAt || now
    },
    { merge: true }
  );

  if (userData.defaultHouseholdId) {
    const defaultMembershipSnapshot = await getDoc(
      getUserMembershipDocument(userId, userData.defaultHouseholdId)
    );

    if (defaultMembershipSnapshot.exists() && defaultMembershipSnapshot.data().status !== "removed") {
      if (defaultMembershipSnapshot.data().role === "owner") {
        await ensureOwnerMembershipDocs(user, userData.defaultHouseholdId, now);
      }

      return userData.defaultHouseholdId;
    }
  }

  if (userData.defaultHouseholdId) {
    console.warn(
      "Default household membership is missing. Creating a new default household.",
      userData.defaultHouseholdId
    );
  }

  const membershipsSnapshot = await getDocs(getUserMembershipsCollection(userId));
  const activeMembership = membershipsSnapshot.docs
    .map(documentSnapshot => ({
      householdId: documentSnapshot.id,
      ...documentSnapshot.data()
    }))
    .find(membership => membership.status !== "removed");

  if (activeMembership?.householdId) {
    if (activeMembership.role === "owner") {
      await ensureOwnerMembershipDocs(user, activeMembership.householdId, now);
    }

    await setDoc(userRef, { defaultHouseholdId: activeMembership.householdId }, { merge: true });
    return activeMembership.householdId;
  }

  const householdId = makeId();
  const household = {
    id: householdId,
    name: "My Household",
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  };
  await setDoc(getHouseholdDocument(householdId), household);
  await ensureOwnerMembershipDocs(user, householdId, now);

  await setDoc(userRef, { defaultHouseholdId: householdId }, { merge: true });

  return householdId;
}

export async function loadCloudItems(householdId) {
  const snapshot = await getDocs(getHouseholdItemsCollection(householdId));
  const items = snapshot.docs.map(documentSnapshot =>
    normalizeItem({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    })
  );

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveCloudItem(householdId, item) {
  const normalized = normalizeItem(item);
  await setDoc(getHouseholdItemDocument(householdId, normalized.id), normalized);
}

export async function deleteCloudItem(householdId, itemId) {
  await deleteDoc(getHouseholdItemDocument(householdId, itemId));
}

export async function replaceCloudItems(householdId, items) {
  const existingItems = await loadCloudItems(householdId);

  await Promise.all(
    existingItems.map(item => deleteCloudItem(householdId, item.id))
  );

  await Promise.all(
    items.map(item => saveCloudItem(householdId, item))
  );
}

export async function loadCloudLocations(householdId) {
  const snapshot = await getDocs(getHouseholdLocationsCollection(householdId));
  const locations = snapshot.docs.map(documentSnapshot =>
    normalizeLocation({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    })
  );

  return locations.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCloudLocation(householdId, location) {
  const normalized = normalizeLocation(location);
  await setDoc(getHouseholdLocationDocument(householdId, normalized.id), normalized);
}

export async function migrateLocalItemsToCloudIfEmpty(householdId, localItems) {
  const cloudItems = await loadCloudItems(householdId);

  if (cloudItems.length > 0 || localItems.length === 0) {
    return cloudItems;
  }

  await Promise.all(
    localItems.map(item => saveCloudItem(householdId, item))
  );

  return localItems.map(normalizeItem);
}

export function normalizeItem(item) {
  const now = new Date().toISOString();

  return {
    id: item.id || makeId(),
    name: item.name || "",
    location: item.location || "",
    category: item.category || "Other",
    room: item.room || "",
    notes: item.notes || "",
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now
  };
}

export function normalizeLocation(location) {
  const now = new Date().toISOString();

  return {
    id: location.id || makeId(),
    name: (location.name || "").trim(),
    room: (location.room || "").trim(),
    notes: (location.notes || "").trim(),
    createdAt: location.createdAt || now,
    updatedAt: location.updatedAt || now
  };
}

export function normalizeInvitation(invitation) {
  const now = new Date().toISOString();
  const email = (invitation.email || "").trim();

  return {
    id: invitation.id || makeId(),
    householdId: invitation.householdId || "",
    householdName: invitation.householdName || "",
    email,
    normalizedEmail: (invitation.normalizedEmail || email).trim().toLocaleLowerCase(),
    role: invitation.role || "member",
    status: invitation.status || "pending",
    invitedBy: invitation.invitedBy || "",
    invitedByName: invitation.invitedByName || "",
    invitedAt: invitation.invitedAt || now,
    acceptedBy: invitation.acceptedBy || "",
    acceptedAt: invitation.acceptedAt || "",
    revokedBy: invitation.revokedBy || "",
    revokedAt: invitation.revokedAt || "",
    expiresAt: invitation.expiresAt || "",
    expiresAtMillis: invitation.expiresAtMillis || (invitation.expiresAt ? Date.parse(invitation.expiresAt) : null)
  };
}

export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}
