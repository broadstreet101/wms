# Changelog

## Unreleased / Current

- Added household-based Firestore data model.
- Added default household creation for signed-in users.
- Moved signed-in items and locations to household-owned collections.
- Added Firestore security rules for user, household, member, item, and location paths.
- Fixed signed-in persistence after refresh.
- Confirmed cross-device sync through household-owned Firestore data.

## Earlier Milestones

- Built initial localStorage prototype.
- Deployed app through GitHub Pages.
- Added PWA structure with manifest, icons, and service worker caching.
- Refactored code into focused JavaScript modules.
- Added Google Authentication.
- Added Authentication UI with profile display and sign-out control.
- Added DataService abstraction between UI and storage providers.
- Added Firestore sync for signed-in users.
- Added real-time Firestore listener.
- Added saved locations.
- Added `ARCHITECTURE.md`.
- Added `DEVELOPER_SETUP.md`.
