import { normalizeItem } from "./storage.js";

export function exportBackup(items) {
  const backup = {
    app: "Where’s My Stuff",
    version: 3,
    exportedAt: new Date().toISOString(),
    items
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `wheres-my-stuff-backup-${date}.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function parseBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const importedItems = Array.isArray(data) ? data : data.items;

        if (!Array.isArray(importedItems)) {
          throw new Error("Invalid backup format.");
        }

        resolve(importedItems.map(normalizeItem).filter(item => item.name && item.location));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsText(file);
  });
}
