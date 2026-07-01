import {
  acceptHouseholdInvitation,
  deleteCloudItem,
  ensureDefaultHousehold,
  isActiveHouseholdMember,
  loadCloudLocations,
  loadHouseholdInvitation,
  loadHouseholdMembers,
  loadHouseholdInvitations,
  loadItems,
  loadCloudItems,
  loadLocations,
  loadUserHouseholds,
  normalizeInvitation,
  normalizeItem,
  normalizeLocation,
  replaceCloudItems,
  removeHouseholdMember as removeCloudHouseholdMember,
  revokeHouseholdInvitation,
  saveCloudItem,
  saveHouseholdInvitation,
  saveCloudLocation,
  saveItems,
  saveLocations,
  updateHouseholdName as saveCloudHouseholdName
} from "./storage.js";
import { db } from "./firebase.js";
import {
  collection,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let activeUser = null;
let activeHouseholdId = null;
let activeHouseholdPromise = null;
let activeUnsubscribe = null;
let activeMembersUnsubscribe = null;
let activeMembersCallback = null;
let activeInvitationsUnsubscribe = null;
let activeInvitationsCallback = null;
let activeHouseholdUnsubscribe = null;
let activeHouseholdCallback = null;
let cachedItems = loadItems();
let cachedLocations = loadLocations();
let cachedHouseholds = [];
let cachedMembers = [];
let cachedInvitations = [];

function getActiveHouseholdStorageKey(userId) {
  return `wheresMyStuff.activeHousehold.${userId}`;
}

function hasAuthenticatedUser() {
  return Boolean(activeUser?.uid);
}

function isUsingFirestore() {
  return Boolean(activeHouseholdId);
}

function getHouseholdItemsCollection(householdId) {
  return collection(db, "households", householdId, "items");
}

function getHouseholdMembersCollection(householdId) {
  return collection(db, "households", householdId, "members");
}

function getHouseholdInvitationsCollection(householdId) {
  return collection(db, "households", householdId, "invitations");
}

function getHouseholdDocument(householdId) {
  return doc(db, "households", householdId);
}

function findMatchingLocation(locations, name) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return locations.find(location => location.name.toLocaleLowerCase() === normalizedName);
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

function getNormalizedUserEmail() {
  return (activeUser?.email || "").trim().toLocaleLowerCase();
}

function makeInvitationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function makeDataError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cacheHousehold(household) {
  const existingHousehold = cachedHouseholds.find(existing => existing.id === household.id);

  cachedHouseholds = [
    ...cachedHouseholds.filter(existing => existing.id !== household.id),
    { ...existingHousehold, ...household }
  ].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function normalizeMembersSnapshot(snapshot) {
  return snapshot.docs
    .map(documentSnapshot => ({
      userId: documentSnapshot.id,
      ...documentSnapshot.data()
    }))
    .filter(member => member.status !== "removed")
    .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
}

function normalizeInvitationsSnapshot(snapshot) {
  return snapshot.docs
    .map(documentSnapshot =>
      normalizeInvitation({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      })
    )
    .filter(invitation => invitation.status === "pending")
    .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
}

async function ensureActiveHousehold() {
  if (!hasAuthenticatedUser()) return null;
  if (activeHouseholdId) return activeHouseholdId;

  if (!activeHouseholdPromise) {
    activeHouseholdPromise = resolveActiveHousehold();
  }

  try {
    activeHouseholdId = await activeHouseholdPromise;
  } catch (error) {
    warnFirestoreUnavailable("household setup", error);
    activeHouseholdPromise = null;
  }

  return activeHouseholdId;
}

async function resolveActiveHousehold() {
  const storedHouseholdId = localStorage.getItem(getActiveHouseholdStorageKey(activeUser.uid));

  if (storedHouseholdId && await isActiveHouseholdMember(activeUser.uid, storedHouseholdId)) {
    cachedHouseholds = await loadUserHouseholds(activeUser.uid);
    return storedHouseholdId;
  }

  const defaultHouseholdId = await ensureDefaultHousehold(activeUser);
  localStorage.setItem(getActiveHouseholdStorageKey(activeUser.uid), defaultHouseholdId);
  cachedHouseholds = await loadUserHouseholds(activeUser.uid);
  return defaultHouseholdId;
}

export function setAuthenticatedUser(user) {
  const nextUserId = user?.uid || null;
  const currentUserId = activeUser?.uid || null;

  if (nextUserId !== currentUserId) {
    unsubscribeItems();
    unsubscribeMembers();
    unsubscribeInvitations();
    unsubscribeActiveHousehold();
    activeMembersCallback = null;
    activeInvitationsCallback = null;
    activeHouseholdCallback = null;
    activeHouseholdId = null;
    activeHouseholdPromise = null;
    cachedHouseholds = [];
    cachedMembers = [];
    cachedInvitations = [];
  }

  activeUser = user || null;

  if (!activeUser) {
    cachedItems = loadItems();
    cachedLocations = loadLocations();
  }
}

export async function getHouseholds() {
  if (!hasAuthenticatedUser()) {
    cachedHouseholds = [];
    return cachedHouseholds;
  }

  await ensureActiveHousehold();
  cachedHouseholds = await loadUserHouseholds(activeUser.uid);
  return cachedHouseholds;
}

export async function getActiveHousehold() {
  const householdId = await ensureActiveHousehold();
  if (!householdId) return null;

  if (cachedHouseholds.length === 0) {
    cachedHouseholds = await loadUserHouseholds(activeUser.uid);
  }

  return cachedHouseholds.find(household => household.id === householdId) || null;
}

export async function setActiveHousehold(householdId) {
  if (!hasAuthenticatedUser()) return null;
  if (!(await isActiveHouseholdMember(activeUser.uid, householdId))) return getActiveHousehold();

  unsubscribeItems();
  activeHouseholdId = householdId;
  activeHouseholdPromise = Promise.resolve(householdId);
  localStorage.setItem(getActiveHouseholdStorageKey(activeUser.uid), householdId);
  cachedItems = await loadCloudItems(householdId);
  cachedLocations = await loadCloudLocations(householdId);
  cachedMembers = await loadHouseholdMembers(householdId);
  cachedInvitations = await loadHouseholdInvitations(householdId);

  if (activeMembersCallback) {
    subscribeMembers(activeMembersCallback);
  }

  if (activeInvitationsCallback) {
    subscribeInvitations(activeInvitationsCallback);
  }

  if (activeHouseholdCallback) {
    subscribeActiveHousehold(activeHouseholdCallback);
  }

  return getActiveHousehold();
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
    getHouseholdItemsCollection(activeHouseholdId),
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

export function unsubscribeMembers() {
  if (!activeMembersUnsubscribe) return;

  const unsubscribe = activeMembersUnsubscribe;
  activeMembersUnsubscribe = null;
  unsubscribe();
}

export function subscribeMembers(callback) {
  unsubscribeMembers();
  activeMembersCallback = callback;

  if (!isUsingFirestore()) {
    return unsubscribeMembers;
  }

  activeMembersUnsubscribe = onSnapshot(
    getHouseholdMembersCollection(activeHouseholdId),
    snapshot => {
      cachedMembers = normalizeMembersSnapshot(snapshot);
      callback(cachedMembers);
    },
    error => {
      warnFirestoreUnavailable("members listener", error);
    }
  );

  return unsubscribeMembers;
}

export function unsubscribeInvitations() {
  if (!activeInvitationsUnsubscribe) return;

  const unsubscribe = activeInvitationsUnsubscribe;
  activeInvitationsUnsubscribe = null;
  unsubscribe();
}

export function subscribeInvitations(callback) {
  unsubscribeInvitations();
  activeInvitationsCallback = callback;

  if (!isUsingFirestore()) {
    return unsubscribeInvitations;
  }

  activeInvitationsUnsubscribe = onSnapshot(
    getHouseholdInvitationsCollection(activeHouseholdId),
    snapshot => {
      cachedInvitations = normalizeInvitationsSnapshot(snapshot);
      callback(cachedInvitations);
    },
    error => {
      warnFirestoreUnavailable("invitations listener", error);
    }
  );

  return unsubscribeInvitations;
}

export function unsubscribeActiveHousehold() {
  if (!activeHouseholdUnsubscribe) return;

  const unsubscribe = activeHouseholdUnsubscribe;
  activeHouseholdUnsubscribe = null;
  unsubscribe();
}

export function subscribeActiveHousehold(callback) {
  unsubscribeActiveHousehold();
  activeHouseholdCallback = callback;

  if (!isUsingFirestore()) {
    return unsubscribeActiveHousehold;
  }

  activeHouseholdUnsubscribe = onSnapshot(
    getHouseholdDocument(activeHouseholdId),
    snapshot => {
      if (!snapshot.exists()) return;

      const existing = cachedHouseholds.find(household => household.id === activeHouseholdId);
      const household = {
        ...existing,
        id: activeHouseholdId,
        ...snapshot.data()
      };

      cacheHousehold(household);
      callback(household, cachedHouseholds);
    },
    error => {
      warnFirestoreUnavailable("household listener", error);
    }
  );

  return unsubscribeActiveHousehold;
}

export async function updateHouseholdName(name) {
  if (!hasAuthenticatedUser()) return null;

  const householdId = await ensureActiveHousehold();
  const trimmedName = (name || "").trim();
  if (!householdId || !trimmedName) return null;

  const activeHousehold = await getActiveHousehold();
  if (activeHousehold?.role !== "owner") {
    throw makeDataError("not-owner", "Only the household owner can rename this household.");
  }

  try {
    const updatedHousehold = {
      ...activeHousehold,
      ...(await saveCloudHouseholdName(householdId, trimmedName))
    };
    cacheHousehold(updatedHousehold);
    return updatedHousehold;
  } catch (error) {
    warnFirestoreUnavailable("household rename", error);
    throw makeDataError("household-rename-failed", "This household could not be renamed.");
  }
}

export async function removeHouseholdMember(userId) {
  if (!hasAuthenticatedUser()) return cachedMembers;

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedMembers;

  const member = cachedMembers.find(existing => existing.userId === userId);
  const activeHousehold = await getActiveHousehold();

  if (!member) {
    throw makeDataError("member-not-found", "This household member was not found.");
  }

  if (member.userId === activeUser.uid) {
    throw makeDataError("cannot-remove-self", "You cannot remove yourself in this phase.");
  }

  if (member.role === "owner") {
    throw makeDataError("cannot-remove-owner", "The household owner cannot be removed.");
  }

  if (activeHousehold?.role !== "owner" && activeHousehold?.role !== "admin") {
    throw makeDataError("not-household-admin", "Only a household owner or admin can remove members.");
  }

  if (member.role === "admin" && activeHousehold?.role !== "owner") {
    throw makeDataError("owner-required", "Only the household owner can remove an admin.");
  }

  try {
    await removeCloudHouseholdMember(householdId, userId, activeUser.uid);
    cachedMembers = cachedMembers.filter(existing => existing.userId !== userId);
  } catch (error) {
    warnFirestoreUnavailable("member removal", error);
    throw makeDataError("member-remove-failed", "This household member could not be removed.");
  }

  return cachedMembers;
}

export async function getMembers() {
  if (!hasAuthenticatedUser()) {
    cachedMembers = [];
    return cachedMembers;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedMembers;

  try {
    cachedMembers = await loadHouseholdMembers(householdId);
  } catch (error) {
    warnFirestoreUnavailable("members load", error);
  }

  return cachedMembers;
}

export async function getInvitations() {
  if (!hasAuthenticatedUser()) {
    cachedInvitations = [];
    return cachedInvitations;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedInvitations;

  try {
    cachedInvitations = await loadHouseholdInvitations(householdId);
  } catch (error) {
    warnFirestoreUnavailable("invitations load", error);
  }

  return cachedInvitations;
}

export async function getDirectInvitation(householdId, invitationId) {
  if (!hasAuthenticatedUser()) {
    throw makeInvitationError("not-signed-in", "Sign in to view this invitation.");
  }

  const normalizedUserEmail = getNormalizedUserEmail();
  if (!normalizedUserEmail) {
    throw makeInvitationError("missing-email", "Your account does not have an email address.");
  }

  let invitation = null;

  try {
    invitation = await loadHouseholdInvitation(householdId, invitationId);
  } catch (error) {
    warnFirestoreUnavailable("invitation load", error);
    throw makeInvitationError(
      "invitation-unavailable",
      "This invitation is invalid, expired, or not available for this Google account."
    );
  }

  validateDirectInvitation(invitation, normalizedUserEmail);
  return invitation;
}

export async function acceptInvitation(householdId, invitationId) {
  const invitation = await getDirectInvitation(householdId, invitationId);

  try {
    await acceptHouseholdInvitation(householdId, invitation, activeUser);
    cachedInvitations = cachedInvitations.filter(existing => existing.id !== invitation.id);
    await setActiveHousehold(householdId);
  } catch (error) {
    warnFirestoreUnavailable("invitation acceptance", error);
    throw makeInvitationError(
      "acceptance-failed",
      "This invitation could not be accepted. It may already be accepted, expired, or for a different Google account."
    );
  }

  return getActiveHousehold();
}

function validateDirectInvitation(invitation, normalizedUserEmail) {
  if (!invitation) {
    throw makeInvitationError("not-found", "This invitation was not found.");
  }

  if (invitation.status !== "pending") {
    throw makeInvitationError("not-pending", "This invitation has already been accepted or is no longer pending.");
  }

  if (invitation.normalizedEmail !== normalizedUserEmail) {
    throw makeInvitationError(
      "email-mismatch",
      "This invitation is for a different email address. Sign in with the invited Google account."
    );
  }

  const expiresAtMillis = invitation.expiresAtMillis || (
    invitation.expiresAt ? new Date(invitation.expiresAt).getTime() : null
  );

  if (expiresAtMillis && expiresAtMillis <= Date.now()) {
    throw makeInvitationError("expired", "This invitation has expired.");
  }
}

export async function createInvitation(invitation) {
  if (!hasAuthenticatedUser()) return null;

  const email = (invitation?.email || "").trim().toLocaleLowerCase();
  if (!email) return null;

  const householdId = await ensureActiveHousehold();
  if (!householdId) return null;

  const normalizedEmail = email.toLocaleLowerCase();
  const existingInvitation = cachedInvitations.find(existing =>
    existing.status === "pending"
    && existing.householdId === householdId
    && existing.normalizedEmail === normalizedEmail
  );

  if (existingInvitation) {
    const error = new Error("A pending invitation already exists for this email.");
    error.code = "duplicate-invitation";
    throw error;
  }

  const role = invitation?.role === "admin" ? "admin" : "member";
  const activeHousehold = await getActiveHousehold();
  const invitedAt = new Date().toISOString();
  const expiresAtMillis = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(expiresAtMillis).toISOString();
  const savedInvitation = normalizeInvitation({
    ...invitation,
    householdId,
    householdName: activeHousehold?.name || "My Household",
    email,
    normalizedEmail,
    role,
    status: "pending",
    invitedBy: activeUser.uid,
    invitedByName: activeUser.displayName || activeUser.email || "Household member",
    invitedAt,
    expiresAt,
    expiresAtMillis
  });

  try {
    await saveHouseholdInvitation(householdId, savedInvitation);
    cachedInvitations = [
      savedInvitation,
      ...cachedInvitations.filter(existingInvitation => existingInvitation.id !== savedInvitation.id)
    ].sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
  } catch (error) {
    warnFirestoreUnavailable("invitation save", error);
  }

  return savedInvitation;
}

export async function revokeInvitation(invitationId) {
  if (!hasAuthenticatedUser()) return null;

  const householdId = await ensureActiveHousehold();
  if (!householdId) return null;

  const invitation = cachedInvitations.find(existing => existing.id === invitationId)
    || await loadHouseholdInvitation(householdId, invitationId);

  if (!invitation) {
    throw makeInvitationError("not-found", "This invitation was not found.");
  }

  if (invitation.status !== "pending") {
    throw makeInvitationError("not-pending", "Only pending invitations can be revoked.");
  }

  try {
    await revokeHouseholdInvitation(householdId, invitationId, activeUser.uid);
    cachedInvitations = cachedInvitations.filter(existing => existing.id !== invitationId);
  } catch (error) {
    warnFirestoreUnavailable("invitation revoke", error);
    throw makeInvitationError("revoke-failed", "This invitation could not be revoked.");
  }

  return cachedInvitations;
}

export async function getItems() {
  if (!hasAuthenticatedUser()) {
    cachedItems = loadItems();
    return cachedItems;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedItems;

  try {
    cachedItems = await loadCloudItems(householdId);
  } catch (error) {
    warnFirestoreUnavailable("load", error);
  }

  return cachedItems;
}

export async function getLocations() {
  if (!hasAuthenticatedUser()) {
    cachedLocations = loadLocations();
    return cachedLocations;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedLocations;

  try {
    cachedLocations = await loadCloudLocations(householdId);
  } catch (error) {
    warnFirestoreUnavailable("locations load", error);
  }

  return cachedLocations;
}

export async function saveLocation(location) {
  const locationName = (location.name || "").trim();
  if (!locationName) return null;

  const existingLocation = findMatchingLocation(cachedLocations, locationName);
  if (existingLocation) return existingLocation;

  const savedLocation = normalizeLocation({
    ...location,
    name: locationName
  });

  cachedLocations = [...cachedLocations, savedLocation].sort((a, b) => a.name.localeCompare(b.name));

  if (!hasAuthenticatedUser()) {
    saveLocations(cachedLocations);
    return savedLocation;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return savedLocation;

  try {
    await saveCloudLocation(householdId, savedLocation);
  } catch (error) {
    warnFirestoreUnavailable("location save", error);
  }

  return savedLocation;
}

export async function saveItem(item) {
  const savedItem = normalizeItem(item);
  cachedItems = [...cachedItems, savedItem];

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return savedItem;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return savedItem;

  try {
    await saveCloudItem(householdId, savedItem);
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

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return updatedItem;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return updatedItem;

  try {
    await saveCloudItem(householdId, updatedItem);
  } catch (error) {
    warnFirestoreUnavailable("update", error);
  }

  return updatedItem;
}

export async function deleteItem(id) {
  cachedItems = cachedItems.filter(item => item.id !== id);

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return cachedItems;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedItems;

  try {
    await deleteCloudItem(householdId, id);
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

  if (!hasAuthenticatedUser()) {
    saveItems(cachedItems);
    return cachedItems;
  }

  const householdId = await ensureActiveHousehold();
  if (!householdId) return cachedItems;

  try {
    await replaceCloudItems(householdId, cachedItems);
  } catch (error) {
    warnFirestoreUnavailable("replace", error);
  }

  return cachedItems;
}

export async function exportItems() {
  return getItems();
}
