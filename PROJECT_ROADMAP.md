# Where’s My Stuff — Project Roadmap

## Current Version

Version 5 preview — Google Sign-In + Cloud Firestore Sync

## Current Architecture

- GitHub Pages hosts the app.
- Browser runs the app.
- Firebase Authentication handles Google sign-in.
- Cloud Firestore stores signed-in user inventory at `users/{userId}/items/{itemId}`.
- localStorage remains as local fallback and backup mirror.

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
- Google Authentication
- Firestore database
- Per-user cloud item storage

## Next Milestone

Version 6 — Shared Household Inventory

Goal:
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
