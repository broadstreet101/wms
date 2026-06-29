import { CATEGORIES } from "./config.js";
import { escapeHtml, formatDate } from "./utils.js";

export const elements = {
  itemForm: document.getElementById("itemForm"),
  itemId: document.getElementById("itemId"),
  itemName: document.getElementById("itemName"),
  itemLocation: document.getElementById("itemLocation"),
  locationOptions: document.getElementById("locationOptions"),
  itemCategory: document.getElementById("itemCategory"),
  itemRoom: document.getElementById("itemRoom"),
  itemNotes: document.getElementById("itemNotes"),
  formTitle: document.getElementById("formTitle"),
  saveButton: document.getElementById("saveButton"),
  cancelEditButton: document.getElementById("cancelEditButton"),
  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  sortMode: document.getElementById("sortMode"),
  itemsList: document.getElementById("itemsList"),
  totalCount: document.getElementById("totalCount"),
  shownCount: document.getElementById("shownCount"),
  categoryCount: document.getElementById("categoryCount"),
  exportButton: document.getElementById("exportButton"),
  importFile: document.getElementById("importFile"),
  clearButton: document.getElementById("clearButton"),
  signInButton: document.getElementById("signInButton"),
  authProfile: document.getElementById("authProfile"),
  authPhoto: document.getElementById("authPhoto"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  signOutButton: document.getElementById("signOutButton"),
  authStatus: document.getElementById("authStatus")
};

export function populateCategoryControls() {
  elements.itemCategory.innerHTML = CATEGORIES
    .map(category => `<option>${escapeHtml(category)}</option>`)
    .join("");

  elements.categoryFilter.innerHTML = [
    `<option value="">All categories</option>`,
    ...CATEGORIES.map(category => `<option>${escapeHtml(category)}</option>`)
  ].join("");
}

export function resetForm() {
  elements.itemId.value = "";
  elements.itemName.value = "";
  elements.itemLocation.value = "";
  elements.itemCategory.value = "Documents";
  elements.itemRoom.value = "";
  elements.itemNotes.value = "";
  elements.formTitle.textContent = "Add Item";
  elements.saveButton.textContent = "Save Item";
  elements.cancelEditButton.hidden = true;
}

export function fillFormForEdit(item) {
  elements.itemId.value = item.id;
  elements.itemName.value = item.name;
  elements.itemLocation.value = item.location;
  elements.itemCategory.value = item.category || "Other";
  elements.itemRoom.value = item.room || "";
  elements.itemNotes.value = item.notes || "";

  elements.formTitle.textContent = "Edit Item";
  elements.saveButton.textContent = "Update Item";
  elements.cancelEditButton.hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function readForm() {
  return {
    id: elements.itemId.value,
    name: elements.itemName.value.trim(),
    location: elements.itemLocation.value.trim(),
    category: elements.itemCategory.value,
    room: elements.itemRoom.value.trim(),
    notes: elements.itemNotes.value.trim()
  };
}

export function renderLocationOptions(locations) {
  elements.locationOptions.innerHTML = locations
    .map(location => {
      const label = location.room ? `${location.name} - ${location.room}` : location.name;
      return `<option value="${escapeHtml(location.name)}" label="${escapeHtml(label)}"></option>`;
    })
    .join("");
}

export function renderItems(items, filteredItems) {
  const categories = new Set(items.map(item => item.category || "Other"));

  elements.totalCount.textContent = items.length;
  elements.shownCount.textContent = filteredItems.length;
  elements.categoryCount.textContent = categories.size;

  if (filteredItems.length === 0) {
    elements.itemsList.innerHTML = `<div class="empty">No matching stuff found. Either it is truly gone, or future-you has not logged it yet.</div>`;
    return;
  }

  elements.itemsList.innerHTML = filteredItems
    .map(
      item => `
    <article class="item">
      <h3>${escapeHtml(item.name)}</h3>
      <span class="pill">${escapeHtml(item.category || "Other")}</span>
      <div class="location">📍 ${escapeHtml(item.location)}</div>
      ${item.room ? `<div><strong>Room / Area:</strong> ${escapeHtml(item.room)}</div>` : ""}
      ${item.notes ? `<div class="notes">${escapeHtml(item.notes)}</div>` : ""}
      <div class="meta">
        Added: ${formatDate(item.createdAt)}<br>
        Updated: ${formatDate(item.updatedAt)}
      </div>
      <div class="buttons">
        <button class="small" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
        <button class="small danger" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>
  `
    )
    .join("");
}
