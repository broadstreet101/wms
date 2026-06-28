# Where’s My Stuff — Project Roadmap

## Current Version

Version 4.1 — Google Authentication added, local storage preserved

## Current Architecture

- GitHub Pages hosts the app.
- Browser runs the app.
- `localStorage` still stores item data locally per device.
- Firebase project exists.
- Google Authentication is enabled.
- Cloud Firestore database exists but is not used by the app yet.
- Firebase Auth is connected through `js/firebase.js`.

## Completed

- Single-page app
- Mobile-friendly design
- Add/edit/delete items
- Search
- Category filtering
- Sorting
- Export/import backup
- GitHub repository
- GitHub Pages deployment
- VS Code local development setup
- Firebase project setup
- Google sign-in UI
- Firebase Authentication module

## Current Milestone

Version 4.1 — Google Sign-In

Goal:
- Add Sign in with Google button.
- Show signed-in user.
- Allow sign-out.
- Keep existing `localStorage` behavior unchanged.

## Next Milestone

Version 5 — Cloud Firestore Sync

- Save inventory items to Firestore.
- Sync across devices.
- Preserve a migration path from local-only items.

## Later Milestone

Version 6 — Shared Household Inventory

- Household-based sharing.
- Members: Doug, Lauren, Juliet.
- Track who added or updated each item.

## Future Ideas

- Photos of items
- Photos of storage locations
- QR code labels for bins
- Favorites
- Location presets
- Item history
- Dark mode
