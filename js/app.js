import {
  signInWithGoogle,
  signOutUser,
  watchAuthState
} from "./firebase.js";
import {
  deleteCloudItem,
  loadItems,
  makeId,
  migrateLocalItemsToCloudIfEmpty,
  replaceCloudItems,
  saveCloudItem,
  saveItems
} from "./storage.js";
import { getFilteredItems } from "./search.js";
import { exportBackup, parseBackupFile } from "./backup.js";
import {
  elements,
  populateCategoryControls,
  resetForm,
  fillFormForEdit,
  readForm,
  renderItems
} from "./ui.js";

let items = loadItems();
let currentUser = null;
let cloudReady = false;

function render() {
  const filtered = getFilteredItems(
    items,
    elements.searchInput.value,
    elements.categoryFilter.value,
    elements.sortMode.value
  );

  renderItems(items, filtered);
}

async function persistItem(item) {
  saveItems(items);

  if (currentUser && cloudReady) {
    await saveCloudItem(currentUser.uid, item);
  }
}

async function persistAllItems() {
  saveItems(items);

  if (currentUser && cloudReady) {
    await replaceCloudItems(currentUser.uid, items);
  }
}

async function upsertItem(formData) {
  const now = new Date().toISOString();
  let itemToSave;

  if (formData.id) {
    items = items.map(item => {
      if (item.id !== formData.id) return item;

      itemToSave = {
        ...item,
        name: formData.name,
        location: formData.location,
        category: formData.category,
        room: formData.room,
        notes: formData.notes,
        updatedAt: now
      };

      return itemToSave;
    });
  } else {
    itemToSave = {
      id: makeId(),
      name: formData.name,
      location: formData.location,
      category: formData.category,
      room: formData.room,
      notes: formData.notes,
      createdAt: now,
      updatedAt: now
    };

    items.push(itemToSave);
  }

  resetForm();
  render();

  try {
    await persistItem(itemToSave);
  } catch (error) {
    console.error("Save failed:", error);
    alert("The item was saved locally, but cloud sync failed. Check the console for details.");
  }
}

async function deleteItem(id) {
  const item = items.find(item => item.id === id);
  if (!item) return;

  const confirmed = confirm(`Delete "${item.name}"?`);
  if (!confirmed) return;

  items = items.filter(item => item.id !== id);
  saveItems(items);
  render();

  if (currentUser && cloudReady) {
    try {
      await deleteCloudItem(currentUser.uid, id);
    } catch (error) {
      console.error("Cloud delete failed:", error);
      alert("The item was deleted locally, but cloud sync failed. Check the console for details.");
    }
  }
}

function editItem(id) {
  const item = items.find(item => item.id === id);
  if (!item) return;

  fillFormForEdit(item);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function updateAuthDisplay(user, message) {
  if (user) {
    elements.authStatus.textContent = message || `Signed in as ${user.displayName || user.email} · Cloud sync on`;
    elements.signInButton.hidden = true;
    elements.signOutButton.hidden = false;
  } else {
    elements.authStatus.textContent = "Not signed in · Local-only mode";
    elements.signInButton.hidden = false;
    elements.signOutButton.hidden = true;
  }
}

function setupAuth() {
  elements.signInButton.addEventListener("click", async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in failed:", error);
      alert("Google sign-in failed. Check the browser console for details.");
    }
  });

  elements.signOutButton.addEventListener("click", async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Sign-out failed:", error);
      alert("Sign-out failed. Check the browser console for details.");
    }
  });

  watchAuthState(async user => {
    currentUser = user;
    cloudReady = false;

    if (!user) {
      items = loadItems();
      updateAuthDisplay(null);
      render();
      return;
    }

    updateAuthDisplay(user, `Signed in as ${user.displayName || user.email} · Loading cloud items...`);

    try {
      const localItems = loadItems();
      items = await migrateLocalItemsToCloudIfEmpty(user.uid, localItems);
      saveItems(items);
      cloudReady = true;
      updateAuthDisplay(user);
      render();
    } catch (error) {
      console.error("Cloud load failed:", error);
      items = loadItems();
      updateAuthDisplay(user, `Signed in as ${user.displayName || user.email} · Cloud sync unavailable`);
      render();
      alert("Signed in, but cloud items could not load. Check Firestore rules and the browser console.");
    }
  });
}

elements.itemForm.addEventListener("submit", async event => {
  event.preventDefault();
  await upsertItem(readForm());
});

elements.cancelEditButton.addEventListener("click", resetForm);
elements.searchInput.addEventListener("input", render);
elements.categoryFilter.addEventListener("change", render);
elements.sortMode.addEventListener("change", render);

elements.itemsList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "edit") editItem(id);
  if (button.dataset.action === "delete") await deleteItem(id);
});

elements.exportButton.addEventListener("click", () => {
  exportBackup(items);
});

elements.importFile.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const importedItems = await parseBackupFile(file);

    const confirmed = confirm(
      "Import this backup? This will replace your current saved items in this browser and cloud account."
    );
    if (!confirmed) return;

    items = importedItems;
    await persistAllItems();
    resetForm();
    render();
    alert("Backup imported successfully.");
  } catch (error) {
    console.error("Import failed:", error);
    alert("Import failed. This does not look like a valid backup file.");
  } finally {
    elements.importFile.value = "";
  }
});

elements.clearButton.addEventListener("click", async () => {
  if (items.length === 0) return;

  const confirmed = confirm(
    "Delete ALL saved items from this browser and cloud account? Export a backup first if you might need them."
  );
  if (!confirmed) return;

  items = [];
  await persistAllItems();
  resetForm();
  render();
});

populateCategoryControls();
resetForm();
render();
setupAuth();
registerServiceWorker();
