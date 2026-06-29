import { STORAGE_KEY, LOCATION_STORAGE_KEY, LEGACY_STORAGE_KEYS } from "./config.js";
import { db } from "./firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc
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

export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}
