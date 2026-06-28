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
- Google sign-in
- Cloud Firestore sync for signed-in users
- Local browser fallback using `localStorage`

## Current architecture

- GitHub Pages hosts the static app.
- Firebase Authentication handles Google sign-in.
- Cloud Firestore stores signed-in user inventory at `users/{userId}/items/{itemId}`.
- `localStorage` remains as local fallback and backup mirror.

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
└── README.md
```

## Next planned step

Shared household inventory, so multiple signed-in family members can access the same inventory instead of each user having a separate inventory.
