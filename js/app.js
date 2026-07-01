import {
  signInWithGoogle,
  signOutUser,
  watchAuthState
} from "./firebase.js";
import {
  acceptInvitation,
  createInvitation,
  deleteItem as deleteStoredItem,
  getDirectInvitation,
  getActiveHousehold,
  getHouseholds,
  exportItems,
  getInvitations,
  getItems,
  getLocations,
  getMembers,
  importItems,
  saveLocation,
  saveItem as saveStoredItem,
  setActiveHousehold,
  setAuthenticatedUser,
  subscribeItems,
  subscribeInvitations,
  subscribeMembers,
  unsubscribeItems,
  unsubscribeInvitations,
  unsubscribeMembers,
  updateItem as updateStoredItem
} from "./dataService.js";
import { getFilteredItems } from "./search.js";
import { exportBackup, parseBackupFile } from "./backup.js";
import {
  elements,
  populateCategoryControls,
  resetForm,
  fillFormForEdit,
  readInvitationForm,
  readForm,
  renderInvitationAcceptance,
  renderItems,
  renderHouseholdDisplay,
  renderInvitations,
  renderMembers,
  renderLocationOptions,
  resetInvitationForm
} from "./ui.js";

let items = [];
let locations = [];
let households = [];
let activeHousehold = null;
let members = [];
let invitations = [];
let directInvitation = null;
let directInvitationMessage = "";
let directInvitationParams = getDirectInvitationParams();
let currentUser = null;
let signInInProgress = false;

function getDirectInvitationParams() {
  const params = new URLSearchParams(window.location.search);
  const householdId = params.get("householdId");
  const invitationId = params.get("invitationId");

  if (!householdId || !invitationId) return null;
  return { householdId, invitationId };
}

function clearInvitationUrlParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("householdId");
  url.searchParams.delete("invitationId");
  window.history.replaceState({}, "", url);
  directInvitationParams = null;
}

function makeInvitationLink(invitation) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("householdId", invitation.householdId);
  url.searchParams.set("invitationId", invitation.id);
  return url.toString();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function getLocationSuggestions() {
  const suggestions = new Map();

  locations.forEach(location => {
    if (location.name) suggestions.set(location.name.toLocaleLowerCase(), location);
  });

  items.forEach(item => {
    const name = (item.location || "").trim();
    if (!name) return;

    const key = name.toLocaleLowerCase();
    if (!suggestions.has(key)) {
      suggestions.set(key, {
        id: key,
        name,
        room: item.room || "",
        notes: ""
      });
    }
  });

  return [...suggestions.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function render() {
  const filtered = getFilteredItems(
    items,
    elements.searchInput.value,
    elements.categoryFilter.value,
    elements.sortMode.value
  );

  renderItems(items, filtered);
  renderLocationOptions(getLocationSuggestions());
  renderHouseholdDisplay(households, activeHousehold);
  renderInvitationAcceptance(
    directInvitation,
    directInvitationMessage,
    Boolean(currentUser && directInvitation)
  );
  renderMembers(members);
  renderInvitations(invitations, Boolean(currentUser));
}

function syncItems(nextItems) {
  items = nextItems;
  render();
}

function syncMembers(nextMembers) {
  members = nextMembers;
  render();
}

function syncInvitations(nextInvitations) {
  invitations = nextInvitations;
  render();
}

async function loadDirectInvitationForCurrentUser() {
  directInvitationParams = getDirectInvitationParams();

  if (!directInvitationParams) {
    directInvitation = null;
    directInvitationMessage = "";
    return;
  }

  if (!currentUser) {
    directInvitation = null;
    directInvitationMessage = "Sign in to accept this invitation.";
    return;
  }

  try {
    directInvitation = await getDirectInvitation(
      directInvitationParams.householdId,
      directInvitationParams.invitationId
    );
    directInvitationMessage = "";
  } catch (error) {
    directInvitation = null;
    directInvitationMessage = error.message || "This invitation could not be loaded.";
  }
}

async function reloadSignedInData() {
  items = await getItems();
  locations = await getLocations();
  households = await getHouseholds();
  activeHousehold = await getActiveHousehold();
  members = await getMembers();
  invitations = await getInvitations();
}

async function upsertItem(formData) {
  const now = new Date().toISOString();
  let itemToSave;

  if (formData.location) {
    await saveLocation({
      name: formData.location,
      room: formData.room,
      updatedAt: now
    });
    locations = await getLocations();
  }

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
    households = [];
    activeHousehold = null;
    members = [];
    invitations = [];
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
      unsubscribeMembers();
      unsubscribeInvitations();
      items = await getItems();
      locations = await getLocations();
      households = [];
      activeHousehold = null;
      members = [];
      invitations = [];
      await loadDirectInvitationForCurrentUser();
      updateAuthDisplay(null);
      render();
      return;
    }

    updateAuthDisplay(user, "Loading cloud items...");

    await reloadSignedInData();
    await loadDirectInvitationForCurrentUser();
    updateAuthDisplay(user);
    render();
    subscribeItems(syncItems);
    subscribeMembers(syncMembers);
    subscribeInvitations(syncInvitations);
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

elements.householdSelect.addEventListener("change", async () => {
  const householdId = elements.householdSelect.value;
  if (!householdId) return;

  activeHousehold = await setActiveHousehold(householdId);
  households = await getHouseholds();
  items = await getItems();
  locations = await getLocations();
  members = await getMembers();
  invitations = await getInvitations();
  render();
  subscribeItems(syncItems);
  subscribeMembers(syncMembers);
  subscribeInvitations(syncInvitations);
});

elements.acceptInvitationButton.addEventListener("click", async () => {
  if (!directInvitationParams) return;

  elements.acceptInvitationButton.disabled = true;

  try {
    activeHousehold = await acceptInvitation(
      directInvitationParams.householdId,
      directInvitationParams.invitationId
    );
    await reloadSignedInData();
    directInvitation = null;
    directInvitationMessage = `Invitation accepted. ${activeHousehold?.name || "Household"} is now active.`;
    clearInvitationUrlParams();
    render();
    subscribeItems(syncItems);
    subscribeMembers(syncMembers);
    subscribeInvitations(syncInvitations);
  } catch (error) {
    directInvitationMessage = error.message || "This invitation could not be accepted.";
    render();
  } finally {
    elements.acceptInvitationButton.disabled = false;
  }
});

elements.invitationForm.addEventListener("submit", async event => {
  event.preventDefault();

  const invitationData = readInvitationForm();
  if (!invitationData.email) {
    alert("Enter an email address before creating an invitation.");
    return;
  }

  try {
    const invitation = await createInvitation(invitationData);
    if (!invitation) return;

    invitations = await getInvitations();
    resetInvitationForm();
    render();
  } catch (error) {
    if (error.code === "duplicate-invitation") {
      alert("A pending invitation already exists for that email address.");
      return;
    }

    console.error("Invitation failed:", error);
    alert("Invitation failed. Check the browser console for details.");
  }
});

elements.invitationsList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action='copy-invite-link']");
  if (!button) return;

  const invitation = invitations.find(existingInvitation => existingInvitation.id === button.dataset.id);
  if (!invitation) return;

  try {
    await copyText(makeInvitationLink(invitation));
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy Invite Link";
    }, 1600);
  } catch (error) {
    console.error("Copy invite link failed:", error);
    alert("Copy failed. Check the browser console for details.");
  }
});

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
    locations = await getLocations();
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
  locations = await getLocations();
  resetForm();
  render();
});

async function initializeApp() {
  populateCategoryControls();
  resetForm();
  setAuthenticatedUser(null);
  items = await getItems();
  locations = await getLocations();
  households = [];
  activeHousehold = null;
  members = [];
  invitations = [];
  await loadDirectInvitationForCurrentUser();
  render();
  setupAuth();
  registerServiceWorker();
}

initializeApp();
