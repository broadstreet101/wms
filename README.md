# Where’s My Stuff

A small local-first household inventory app for remembering where important things are stored.

## Current features

- Add item locations
- Edit and delete saved items
- Search by item, room, category, location, or notes
- Filter by category
- Sort by recent update, item name, or category
- Export backup as JSON
- Import backup from JSON
- Stores item data locally in the browser using `localStorage`
- Google sign-in UI and Firebase Authentication connection

## Version 4.1

Version 4.1 adds Google Authentication while preserving all existing local functionality.

Important: signing in does **not** sync item data yet. Item data remains stored only in the current browser until the Firestore sync milestone is added.

## Project structure

```text
wms/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── backup.js
│   ├── config.js
│   ├── firebase.js
│   ├── search.js
│   ├── storage.js
│   ├── ui.js
│   └── utils.js
├── assets/
│   └── icons/
│       └── icon.svg
├── manifest.json
├── service-worker.js
├── PROJECT_ROADMAP.md
└── README.md
```

## Current limitation

This version authenticates users but does **not** sync between devices or family members yet.

Next planned step: Cloud Firestore sync for secure shared family inventory.
