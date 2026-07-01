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
  authStatus: document.getElementById("authStatus"),
  householdName: document.getElementById("householdName"),
  householdSelect: document.getElementById("householdSelect"),
  invitationAcceptancePanel: document.getElementById("invitationAcceptancePanel"),
  invitationAcceptanceDetails: document.getElementById("invitationAcceptanceDetails"),
  invitationAcceptanceMessage: document.getElementById("invitationAcceptanceMessage"),
  acceptInvitationButton: document.getElementById("acceptInvitationButton"),
  membersPanel: document.getElementById("membersPanel"),
  membersList: document.getElementById("membersList"),
  invitationsPanel: document.getElementById("invitationsPanel"),
  invitationsList: document.getElementById("invitationsList"),
  invitationForm: document.getElementById("invitationForm"),
  invitationEmail: document.getElementById("invitationEmail"),
  invitationRole: document.getElementById("invitationRole"),
  createInvitationButton: document.getElementById("createInvitationButton")
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

export function readInvitationForm() {
  return {
    email: elements.invitationEmail.value.trim(),
    role: elements.invitationRole.value
  };
}

export function resetInvitationForm() {
  elements.invitationEmail.value = "";
  elements.invitationRole.value = "member";
}

export function renderLocationOptions(locations) {
  elements.locationOptions.innerHTML = locations
    .map(location => {
      const label = location.room ? `${location.name} - ${location.room}` : location.name;
      return `<option value="${escapeHtml(location.name)}" label="${escapeHtml(label)}"></option>`;
    })
    .join("");
}

export function renderHouseholdDisplay(households, activeHousehold) {
  const hasMultipleHouseholds = households.length > 1;
  const householdName = activeHousehold?.name || "My Household";

  elements.householdName.textContent = activeHousehold ? `Household: ${householdName}` : "";
  elements.householdName.hidden = !activeHousehold;
  elements.householdSelect.hidden = !hasMultipleHouseholds;

  if (!hasMultipleHouseholds) {
    elements.householdSelect.innerHTML = "";
    return;
  }

  elements.householdSelect.innerHTML = households
    .map(household => `<option value="${escapeHtml(household.id)}">${escapeHtml(household.name)}</option>`)
    .join("");
  elements.householdSelect.value = activeHousehold?.id || "";
}

function getRoleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function getInitials(member) {
  const name = member.displayName || member.email || "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");
}

export function renderMembers(members) {
  elements.membersPanel.hidden = members.length === 0;

  if (members.length === 0) {
    elements.membersList.innerHTML = "";
    return;
  }

  elements.membersList.innerHTML = members
    .map(member => {
      const displayName = member.displayName || member.email || "Household member";
      const avatar = member.photoURL
        ? `<img class="member-photo" src="${escapeHtml(member.photoURL)}" alt="${escapeHtml(displayName)} profile photo" referrerpolicy="no-referrer" />`
        : `<span class="member-photo member-initials">${escapeHtml(getInitials(member))}</span>`;

      return `
        <div class="member">
          ${avatar}
          <div class="member-details">
            <strong>${escapeHtml(displayName)}</strong>
            <span>${escapeHtml(getRoleLabel(member.role))}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

export function renderInvitationAcceptance(invitation, message, canAccept) {
  const shouldShow = Boolean(invitation || message);
  elements.invitationAcceptancePanel.hidden = !shouldShow;
  elements.acceptInvitationButton.hidden = !canAccept;
  elements.invitationAcceptanceMessage.textContent = message || "";

  if (!invitation) {
    elements.invitationAcceptanceDetails.innerHTML = "";
    return;
  }

  elements.invitationAcceptanceDetails.innerHTML = `
    <strong>${escapeHtml(invitation.householdName || "Household")}</strong>
    <span>Role: ${escapeHtml(getRoleLabel(invitation.role))}</span>
    <span>Invited by: ${escapeHtml(invitation.invitedByName || "Household member")}</span>
  `;
}

export function renderInvitations(invitations, isSignedIn, canManageInvitations = false) {
  elements.invitationsPanel.hidden = !isSignedIn;
  elements.invitationForm.hidden = !isSignedIn;

  if (!isSignedIn) {
    elements.invitationsList.innerHTML = "";
    return;
  }

  if (invitations.length === 0) {
    elements.invitationsList.innerHTML = `<div class="empty-inline">No pending invitations.</div>`;
    return;
  }

  elements.invitationsList.innerHTML = invitations
    .map(invitation => `
      <div class="invitation">
        <div class="invitation-details">
          <strong>${escapeHtml(invitation.email)}</strong>
          <span>${escapeHtml(getRoleLabel(invitation.role))} - ${escapeHtml(invitation.status)}</span>
        </div>
        <div class="invitation-actions">
          <button class="small secondary" type="button" data-action="copy-invite-link" data-id="${escapeHtml(invitation.id)}">Copy Invite Link</button>
          ${canManageInvitations ? `<button class="small danger" type="button" data-action="revoke-invitation" data-id="${escapeHtml(invitation.id)}">Revoke</button>` : ""}
        </div>
      </div>
    `)
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
