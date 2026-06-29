import {
  deleteCloudItem,
  ensureDefaultHousehold,
  isActiveHouseholdMember,
  loadCloudLocations,
  loadHouseholdMembers,
  loadItems,
  loadCloudItems,
  loadLocations,
  loadUserHouseholds,
  normalizeItem,
  normalizeLocation,
  replaceCloudItems,
  saveCloudItem,
  saveCloudLocation,
  saveItems,
  saveLocations
} from "./storage.js";
import { db } from "./firebase.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let activeUser = null;
let activeHouseholdId = null;
let activeHouseholdPromise = null;
let activeUnsubscribe = null;
let activeMembersUnsubscribe = null;
let activeMembersCallback = null;
let cachedItems = loadItems();
let cachedLocations = loadLocations();
let cachedHouseholds = [];
let cachedMembers = [];

function getActiveHouseholdStorageKey(userId) {
  return `wheresMyStuff.activeHousehold.${userId}`;
}

function hasAuthenticatedUser() {
  return Boolean(activeUser?.uid);
}

function isUsingFirestore() {
  return Boolean(activeHouseholdId);
}

function getHouseholdItemsCollection(householdId) {
  return collection(db, "households", householdId, "items");
}

function getHouseholdMembersCollection(householdId) {
  return collection(db, "households", householdId, "members");
}

function findMatchingLocation(locations, name) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return locations.find(location => location.name.toLocaleLowerCase() === normalizedName);
}

function normalizeSnapshot(snapshot) {
  return snapshot.docs
    .map(documentSnapshot =>
      normalizeItem({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      })
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function warnFirestoreUnavailable(action, error) {
  console.warn(`Firestore ${action} unavailable. Continuing with current in-memory items.`, error);
}

function normalizeMembersSnapshot(snapshot) {
  return snapshot.docs
    .map(documentSnapshot => ({
      userId: documentSnapshot.id,
      ...documentSnapshot.data()
    }))
    .filter(member => member.status !== "removed")
    .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
}

async function ensureActiveHousehold() {
  if (!hasAuthenticatedUser()) return null;
  if (activeHouseholdId) return activeHouseholdId;

  if (!activeHouseholdPromise) {
    activeHouseholdPromise = resolveActiveHousehold();
  }

  try {
    activeHouseholdId = await activeHouseholdPromise;
  } catch (error) {
    warnFirestoreUnavailable("household setup", error);
    activeHouseholdPromise = null;
  }

  return activeHouseholdId;
}

async function resolveActiveHousehold() {
  const storedHouseholdId = localStorage.getItem(getActiveHouseholdStorageKey(activeUser.uid));

  if (storedHouseholdId && await isActiveHouseholdMember(activeUser.uid, storedHouseholdId)) {
    cachedHouseholds = await loadUserHouseholds(activeUser.uid);
    return storedHouseholdId;
  }

  const defaultHouseholdId = await ensureDefaultHousehold(activeUser);
  localStorage.setItem(getActiveHouseholdStorageKey(activeUser.uid), defaultHouseholdId);
  cachedHouseholds = await loadUserHouseholds(activeUser.uid);
  return defaultHouseholdId;
}

export function setAuthenticatedUser(user) {
  const nextUserId = user?.uid || null;
  const currentUserId = activeUser?.uid || null;

  if (nextUserId !== currentUserId) {
    unsubscribeItems();
    unsubscribeMembers();
    activeMembersCallback = null;
    activeHouseholdId = null;
    activeHouseholdPromise = null;
    cachedHouseholds = [];
    cachedMembers = [];
  }

  activeUser = user || null;

  if (!activeUser) {
    cachedItems = loadItems();
    cachedLocations = loadLocations();
  }
}

export async function getHouseholds() {
  if (!hasAuthenticatedUser()) {
    cachedHouseholds = [];
    return cachedHouseholds;
  }

  await ensureActiveHousehold();
  cachedHouseholds = await loadUserHouseholds(activeUser.uid);
  return cachedHouseholds;
}

export async function getActiveHousehold() {
  const householdId = await ensureActiveHousehold();
  if (!householdId) return null;

  if (cachedHouseholds.length === 0) {
    cachedHouseholds = await loadUserHouseholds(activeUser.uid);
  }

  return cachedHouseholds.find(household => household.id === householdId) || null;
}

export async function setActiveHousehold(householdId) {
  if (!hasAuthenticatedUser()) return null;
  if (!(await isActiveHouseholdMember(activeUser.uid, householdId))) return getActiveHousehold();

  unsubscribeItems();
  activeHouseholdId = householdId;
  activeHouseholdPromise = Promise.resolve(householdId);
  localStorage.setItem(getActiveHouseholdStorageKey(activeUser.uid), householdId);
  cachedItems = await loadCloudItems(householdId);
  cachedLocations = await loadCloudLocations(householdId);
  cachedMembers = await loadHouseholdMembers(householdId);

  if (activeMembersCallback) {
    subscribeMembers(activeMembersCallback);
  }

  return getActiveHousehold();
}

export function unsubscribeItems() {
  if (!activeUnsubscribe) return;

  const unsubscribe = activeUnsubscribe;
  activeUnsubscribe = null;
  unsubscribe();
}

export function subscribeItems(callback) {
  unsubscribeItems();

  if (!isUsingFirestore()) {
    return unsubscribeItems;
  }

  activeUnsubscribe = onSnapshot(
    getHouseholdItemsCollection(activeHouseholdId),
    snapshot => {
      cachedItems = normalizeSnapshot(snapshot);
      callback(cachedItems);
    },
    error => {
      warnFirestoreUnavailable("listener", error);
    }
  );

  return unsubscribeItems;
}

export function unsubscribeMembers() {
  if (!activeMembersUnsubscribe) return;

  const unsubscribe = activeMembersUnsubscribe;
  activeMembersUnsubscribe = null;
  unsubscribe();
}

export function subscribeMembers(callback) {
  unsubscribeMembers();
  activeMembersCallback = callback;

  if (!isUsingFirestore()) {
    return unsubscribeMembers;
  }

  activeMembersUnsubscribe = onSnapshot(
    getHouseholdMembersCollection(activeHouseholdId),
    snapshot => {
      cachedMembers = normalizeMembersSnapshot(snapshot);
      callback(cachedMembers);
    },
    error => {
      warnFirestoreUnavailable("members listener", error);
    }
  );

  return unsubscribeMembers;
}

export async function getMembers() {
  if (!hasAuthenticatedUser()) {
    cachedMembers = [];
    return cachedMembers;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedMembers;

  try {
    cachedMembers = await loadHouseholdMembers(householdId);
  } catch (error) {
    warnFirestoreUnavailable("members load", error);
  }

  return cachedMembers;
}

export async function getItems() {
  if (!hasAuthenticatedUser()) {
    cachedItems = loadItems();
    return cachedItems;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedItems;

  try {
    cachedItems = await loadCloudItems(householdId);
  } catch (error) {
    warnFirestoreUnavailable("load", error);
  }

  return cachedItems;
}

export async function getLocations() {
  if (!hasAuthenticatedUser()) {
    cachedLocations = loadLocations();
    return cachedLocations;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedLocations;

  try {
    cachedLocations = await loadCloudLocations(householdId);
  } catch (error) {
    warnFirestoreUnavailable("locations load", error);
  }

  return cachedLocations;
}

export async function saveLocation(location) {
  const locationName = (location.name || "").trim();
  if (!locationName) return null;

  const existingLocation = findMatchingLocation(cachedLocations, locationName);
  if (existingLocation) return existingLocation;

  const savedLocation = normalizeLocation({
    ...location,
    name: locationName
  });

  cachedLocations = [...cachedLocations, savedLocation].sort((a, b) => a.name.localeCompare(b.name));

  if (!hasAuthenticatedUser()) {
    saveLocations(cachedLocations);
    return savedLocation;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return savedLocation;

  try {
    await saveCloudLocation(householdId, savedLocation);
  } catch (error) {
    warnFirestoreUnavailable("location save", error);
  }

  return savedLocation;
}

export async function saveItem(item) {
  const savedItem = normalizeItem(item);
  cachedItems = [...cachedItems, savedItem];

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return savedItem;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return savedItem;

  try {
    await saveCloudItem(householdId, savedItem);
  } catch (error) {
    warnFirestoreUnavailable("save", error);
  }

  return savedItem;
}

export async function updateItem(item) {
  let updatedItem = null;

  cachedItems = cachedItems.map(existingItem => {
    if (existingItem.id !== item.id) return existingItem;

    updatedItem = normalizeItem({
      ...existingItem,
      ...item,
      id: existingItem.id,
      createdAt: existingItem.createdAt
    });

    return updatedItem;
  });

  if (!updatedItem) return null;

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return updatedItem;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return updatedItem;

  try {
    await saveCloudItem(householdId, updatedItem);
  } catch (error) {
    warnFirestoreUnavailable("update", error);
  }

  return updatedItem;
}

export async function deleteItem(id) {
  cachedItems = cachedItems.filter(item => item.id !== id);

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return cachedItems;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedItems;

  try {
    await deleteCloudItem(householdId, id);
  } catch (error) {
    warnFirestoreUnavailable("delete", error);
  }

  return cachedItems;
}

export async function importItems(data) {
  cachedItems = Array.isArray(data)
    ? data
        .map(normalizeItem)
        .filter(item => item.name && item.location)
    : [];

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return cachedItems;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedItems;

  try {
    await replaceCloudItems(householdId, cachedItems);
  } catch (error) {
    warnFirestoreUnavailable("replace", error);
  }

  return cachedItems;
}

export async function exportItems() {
  return getItems();
}
