import {
  signInWithGoogle,
  signOutUser,
  watchAuthState
} from "./firebase.js";
import {
  deleteItem as deleteStoredItem,
  exportItems,
  getItems,
  importItems,
  saveItem as saveStoredItem,
  setAuthenticatedUser,
  subscribeItems,
  unsubscribeItems,
  updateItem as updateStoredItem
} from "./dataService.js";
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

let items = [];
let currentUser = null;
let signInInProgress = false;

function render() {
  const filtered = getFilteredItems(
    items,
    elements.searchInput.value,
    elements.categoryFilter.value,
    elements.sortMode.value
  );

  renderItems(items, filtered);
}

function syncItems(nextItems) {
  items = nextItems;
  render();
}

async function upsertItem(formData) {
  const now = new Date().toISOString();
  let itemToSave;

  if (formData.id) {
    itemToSave = await updateStoredItem({
      id: formData.id,
      name: formData.name,
      location: formData.location,
      category: formData.category,
      room: formData.room,
      notes: formData.notes,
      updatedAt: now
    });

    if (!itemToSave) return;
  } else {
    itemToSave = await saveStoredItem({
      name: formData.name,
      location: formData.location,
      category: formData.category,
      room: formData.room,
      notes: formData.notes,
      createdAt: now,
      updatedAt: now
    });
  }

  items = await getItems();
  resetForm();
  render();
}

async function deleteItem(id) {
  const item = items.find(item => item.id === id);
  if (!item) return;

  const confirmed = confirm(`Delete "${item.name}"?`);
  if (!confirmed) return;

  items = await deleteStoredItem(id);
  render();
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
    const displayName = user.displayName || "Google user";
    const email = user.email || "";

    elements.authName.textContent = displayName;
    elements.authEmail.textContent = email;
    elements.authStatus.textContent = message || "Cloud sync on";
    elements.authPhoto.src = user.photoURL || "";
    elements.authPhoto.alt = `${displayName} profile photo`;
    elements.authPhoto.hidden = !user.photoURL;
    elements.authProfile.hidden = false;
    elements.signInButton.hidden = true;
    elements.signInButton.disabled = false;
    elements.signOutButton.hidden = false;
  } else {
    elements.authName.textContent = "";
    elements.authEmail.textContent = "";
    elements.authStatus.textContent = "";
    elements.authPhoto.removeAttribute("src");
    elements.authPhoto.alt = "";
    elements.authPhoto.hidden = true;
    elements.authProfile.hidden = true;
    elements.signInButton.hidden = false;
    elements.signInButton.disabled = false;
    elements.signOutButton.hidden = true;
  }
}

function setupAuth() {
  elements.signInButton.addEventListener("click", async () => {
    if (signInInProgress) return;

    signInInProgress = true;
    elements.signInButton.disabled = true;

    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in failed:", error);
      alert("Google sign-in failed. Check the browser console for details.");
    } finally {
      signInInProgress = false;
      if (!currentUser) {
        elements.signInButton.disabled = false;
      }
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
    setAuthenticatedUser(user);

    if (!user) {
      unsubscribeItems();
      items = await getItems();
      updateAuthDisplay(null);
      render();
      return;
    }

    updateAuthDisplay(user, "Loading cloud items...");

    items = await getItems();
    updateAuthDisplay(user);
    render();
    subscribeItems(syncItems);
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

elements.exportButton.addEventListener("click", async () => {
  items = await exportItems();
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

    items = await importItems(importedItems);
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

  items = await importItems([]);
  resetForm();
  render();
});

async function initializeApp() {
  populateCategoryControls();
  resetForm();
  setAuthenticatedUser(null);
  items = await getItems();
  render();
  setupAuth();
  registerServiceWorker();
}

initializeApp();
