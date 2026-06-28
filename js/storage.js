import { STORAGE_KEY, LEGACY_STORAGE_KEYS } from "./config.js";

export function loadItems() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(current)) return current;

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}
