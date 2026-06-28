import {
  deleteCloudItem,
  loadItems,
  loadCloudItems,
  normalizeItem,
  replaceCloudItems,
  saveCloudItem,
  saveItems
} from "./storage.js";
import { db } from "./firebase.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let activeUser = null;
let activeUnsubscribe = null;
let cachedItems = loadItems();

function isUsingFirestore() {
  return Boolean(activeUser?.uid);
}

function getUserItemsCollection(userId) {
  return collection(db, "users", userId, "items");
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

export function setAuthenticatedUser(user) {
  const nextUserId = user?.uid || null;
  const currentUserId = activeUser?.uid || null;

  if (nextUserId !== currentUserId) {
    unsubscribeItems();
  }

  activeUser = user || null;

  if (!activeUser) {
    cachedItems = loadItems();
  }
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
    getUserItemsCollection(activeUser.uid),
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

export async function getItems() {
  if (!isUsingFirestore()) {
    cachedItems = loadItems();
    return cachedItems;
  }

  try {
    cachedItems = await loadCloudItems(activeUser.uid);
  } catch (error) {
    warnFirestoreUnavailable("load", error);
  }

  return cachedItems;
}

export async function saveItem(item) {
  const savedItem = normalizeItem(item);
  cachedItems = [...cachedItems, savedItem];

  if (!isUsingFirestore()) {
    saveItems(cachedItems);
    return savedItem;
  }

  try {
    await saveCloudItem(activeUser.uid, savedItem);
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

  if (!isUsingFirestore()) {
    saveItems(cachedItems);
    return updatedItem;
  }

  try {
    await saveCloudItem(activeUser.uid, updatedItem);
  } catch (error) {
    warnFirestoreUnavailable("update", error);
  }

  return updatedItem;
}

export async function deleteItem(id) {
  cachedItems = cachedItems.filter(item => item.id !== id);

  if (!isUsingFirestore()) {
    saveItems(cachedItems);
    return cachedItems;
  }

  try {
    await deleteCloudItem(activeUser.uid, id);
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

  if (!isUsingFirestore()) {
    saveItems(cachedItems);
    return cachedItems;
  }

  try {
    await replaceCloudItems(activeUser.uid, cachedItems);
  } catch (error) {
    warnFirestoreUnavailable("replace", error);
  }

  return cachedItems;
}

export async function exportItems() {
  return getItems();
}
