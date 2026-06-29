# Where's My Stuff Architecture

This document describes the current application architecture for developers joining the project later.

## High-Level Architecture

Where's My Stuff is a static, browser-based inventory app. The UI is intentionally separated from the storage implementation so the app can move between local-only and cloud-backed storage without rewriting interface code.

```text
UI
  |
  v
DataService
  |
  v
localStorage OR Firestore
  |
  v
Real-time Firestore listener
```

The UI reads and writes item data through `DataService`. When signed out, `DataService` uses `localStorage`. When signed in, `DataService` uses Cloud Firestore and subscribes to real-time updates for that user's item collection.

## Module Responsibilities

### `js/app.js`

`app.js` is the application coordinator. It wires DOM events to application actions, manages the current in-memory item list, reacts to authentication state changes, and asks the UI layer to render.

It should not know Firestore details. Item persistence should flow through `dataService.js`.

### `js/dataService.js`

`dataService.js` owns the active storage provider. It decides whether item operations use local browser storage or Firestore based on the authenticated user.

It exposes item operations such as get, save, update, delete, import, export, and Firestore subscription lifecycle helpers. It also owns real-time listener setup and teardown.

### `js/storage.js`

`storage.js` contains lower-level persistence helpers. It includes localStorage helpers, item normalization, ID creation, and existing Firestore document helpers.

This module is an implementation detail behind `DataService`; UI modules should not call it directly for item workflows.

### `js/firebase.js`

`firebase.js` initializes Firebase once and exports configured Firebase services and authentication helpers.

It owns Firebase configuration, Google Auth provider setup, sign-in, sign-out, and auth-state observation.

### `js/backup.js`

`backup.js` handles backup file import and export mechanics. It creates downloadable JSON backups and parses uploaded backup files.

It does not decide where imported items are stored; that belongs to `DataService`.

### `js/ui.js`

`ui.js` owns DOM element references, category control population, form state, and item rendering.

It should stay presentation-focused. It should not call storage providers, Firebase, or Firestore.

### `service-worker.js`

`service-worker.js` caches static application files for the installable/offline-capable web app experience.

When adding new runtime modules, include them in `FILES_TO_CACHE` and bump `CACHE_NAME` so browsers receive the updated asset set.

## Authentication

### Signed Out

When no Firebase user is authenticated:

- The app shows the Google sign-in control.
- `DataService` uses localStorage.
- Items are loaded from the current browser only.
- No Firestore listener is active.

### Signed In

When a Firebase user is authenticated:

- The app shows the user's Google profile information and sign-out control.
- `DataService` switches to Firestore for that user's item data.
- Items are loaded from `/users/{uid}/items/{itemId}`.
- A Firestore real-time listener updates the in-memory item list as documents change.

### Provider Switching

Authentication state controls the active provider.

- Signing in switches from localStorage to Firestore and displays Firestore items.
- Signing out unsubscribes from Firestore and returns to localStorage items.
- Changing users should clean up any previous listener before starting a new one.

The current app does not merge signed-out local data into Firestore. That migration strategy is intentionally deferred.

## Storage

`DataService` exists to keep storage decisions out of UI code. This preserves the ability to change persistence behavior without touching rendering, form handling, or event wiring across the app.

The UI never directly calls Firestore because:

- Firestore is an implementation detail.
- Signed-out users must continue using localStorage.
- Future storage changes should be isolated.
- Real-time synchronization and listener cleanup require centralized lifecycle management.

## Firestore Data Model

Signed-in items are stored at:

```text
/users/{uid}/items/{itemId}
```

This structure was chosen because each signed-in user currently owns a private inventory. It is simple to secure with per-user Firestore rules and keeps all item documents for a user under one predictable collection.

Each item document stores the normalized item fields used by the app, including name, location, category, room, notes, created timestamp, and updated timestamp.

## Real-Time Synchronization

When a user is signed in, `DataService` starts a Firestore `onSnapshot` listener for that user's item collection.

The listener:

- Normalizes incoming Firestore documents.
- Sorts items consistently.
- Updates the cached item list.
- Invokes the callback supplied by `app.js`.

`app.js` updates its in-memory list from that callback and re-renders through the UI layer.

Listener cleanup is required whenever the active user changes or signs out. `DataService` tracks the active unsubscribe function and clears it before starting a new listener, preventing duplicate subscriptions.

If the listener reports an error, the app logs a console warning and continues displaying the current in-memory items.

## Design Principles

- UI modules never talk directly to Firestore.
- `DataService` owns persistence and provider switching.
- Firebase initialization remains centralized in `firebase.js`.
- Keep modules focused on one responsibility.
- Prefer composition over duplicated persistence logic.
- Keep user-facing behavior independent of the storage implementation.
- Avoid coupling import/export, rendering, and authentication to the active storage provider.
- Real-time listener lifecycle must be explicit and cleaned up on auth changes.

## Future Roadmap

Planned future phases include:

- Shared households
- Household invitations
- Photos of items and storage locations
- QR codes for bins and labels
- Favorites
- Item history

