import {
  signInWithGoogle,
  signOutUser,
  watchAuthState
} from "./firebase.js";
import { loadItems, saveItems, makeId } from "./storage.js";
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

function render() {
  const filtered = getFilteredItems(
    items,
    elements.searchInput.value,
    elements.categoryFilter.value,
    elements.sortMode.value
  );

  renderItems(items, filtered);
}

function upsertItem(formData) {
  const now = new Date().toISOString();

  if (formData.id) {
    items = items.map(item =>
      item.id !== formData.id
        ? item
        : {
            ...item,
            name: formData.name,
            location: formData.location,
            category: formData.category,
            room: formData.room,
            notes: formData.notes,
            updatedAt: now
          }
    );
  } else {
    items.push({
      id: makeId(),
      name: formData.name,
      location: formData.location,
      category: formData.category,
      room: formData.room,
      notes: formData.notes,
      createdAt: now,
      updatedAt: now
    });
  }

  saveItems(items);
  resetForm();
  render();
}

function deleteItem(id) {
  const item = items.find(item => item.id === id);
  if (!item) return;

  const confirmed = confirm(`Delete "${item.name}"?`);
  if (!confirmed) return;

  items = items.filter(item => item.id !== id);
  saveItems(items);
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

function updateAuthDisplay(user) {
  if (user) {
    elements.authStatus.textContent = `Signed in as ${user.displayName || user.email}`;
    elements.signInButton.hidden = true;
    elements.signOutButton.hidden = false;
  } else {
    elements.authStatus.textContent = "Not signed in";
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

  watchAuthState(updateAuthDisplay);
}

elements.itemForm.addEventListener("submit", event => {
  event.preventDefault();
  upsertItem(readForm());
});

elements.cancelEditButton.addEventListener("click", resetForm);
elements.searchInput.addEventListener("input", render);
elements.categoryFilter.addEventListener("change", render);
elements.sortMode.addEventListener("change", render);

elements.itemsList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "edit") editItem(id);
  if (button.dataset.action === "delete") deleteItem(id);
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
      "Import this backup? This will replace your current saved items in this browser."
    );
    if (!confirmed) return;

    items = importedItems;
    saveItems(items);
    resetForm();
    render();
    alert("Backup imported successfully.");
  } catch {
    alert("Import failed. This does not look like a valid backup file.");
  } finally {
    elements.importFile.value = "";
  }
});

elements.clearButton.addEventListener("click", () => {
  if (items.length === 0) return;

  const confirmed = confirm(
    "Delete ALL saved items from this browser? Export a backup first if you might need them."
  );
  if (!confirmed) return;

  items = [];
  saveItems(items);
  resetForm();
  render();
});

populateCategoryControls();
resetForm();
render();
setupAuth();
registerServiceWorker();