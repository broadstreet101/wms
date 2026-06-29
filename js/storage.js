import { STORAGE_KEY, LOCATION_STORAGE_KEY, LEGACY_STORAGE_KEYS } from "./config.js";
import { db } from "./firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function getUserItemsCollection(userId) {
  return collection(db, "users", userId, "items");
}

function getUserItemDocument(userId, itemId) {
  return doc(db, "users", userId, "items", itemId);
}

function getUserLocationsCollection(userId) {
  return collection(db, "users", userId, "locations");
}

function getUserLocationDocument(userId, locationId) {
  return doc(db, "users", userId, "locations", locationId);
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

export async function loadCloudItems(userId) {
  const snapshot = await getDocs(getUserItemsCollection(userId));
  const items = snapshot.docs.map(documentSnapshot =>
    normalizeItem({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    })
  );

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveCloudItem(userId, item) {
  const normalized = normalizeItem(item);
  await setDoc(getUserItemDocument(userId, normalized.id), normalized);
}

export async function deleteCloudItem(userId, itemId) {
  await deleteDoc(getUserItemDocument(userId, itemId));
}

export async function replaceCloudItems(userId, items) {
  const existingItems = await loadCloudItems(userId);

  await Promise.all(
    existingItems.map(item => deleteCloudItem(userId, item.id))
  );

  await Promise.all(
    items.map(item => saveCloudItem(userId, item))
  );
}

export async function loadCloudLocations(userId) {
  const snapshot = await getDocs(getUserLocationsCollection(userId));
  const locations = snapshot.docs.map(documentSnapshot =>
    normalizeLocation({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    })
  );

  return locations.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCloudLocation(userId, location) {
  const normalized = normalizeLocation(location);
  await setDoc(getUserLocationDocument(userId, normalized.id), normalized);
}

export async function migrateLocalItemsToCloudIfEmpty(userId, localItems) {
  const cloudItems = await loadCloudItems(userId);

  if (cloudItems.length > 0 || localItems.length === 0) {
    return cloudItems;
  }

  await Promise.all(
    localItems.map(item => saveCloudItem(userId, item))
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
