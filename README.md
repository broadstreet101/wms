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
- Stores data locally in the browser using `localStorage`

## Version 3 refactor

The app is now split into separate HTML, CSS, and JavaScript modules.

```text
wms/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── backup.js
│   ├── config.js
│   ├── search.js
│   ├── storage.js
│   ├── ui.js
│   └── utils.js
├── assets/
│   └── icons/
│       └── icon.svg
├── manifest.json
├── service-worker.js
└── README.md
```

## Current limitation

This version does **not** sync between devices or family members yet.

Next planned step: Firebase Authentication + Cloud Firestore for secure shared family inventory.
