# Developer Setup

This guide documents the local development setup for Where's My Stuff.

## Required Tools

- VS Code
- Git
- Node.js
- npm
- Firebase CLI
- A live/local server option

For a simple local server, you can use the VS Code Live Server extension or another static-file server.

## Setup Steps

1. Clone the repository.

   ```powershell
   git clone <repository-url>
   cd wms
   ```

2. Open the project in VS Code.

   ```powershell
   code .
   ```

3. Verify Node.js is available.

   ```powershell
   node -v
   ```

4. Verify npm from PowerShell.

   ```powershell
   npm.cmd -v
   ```

5. Install the Firebase CLI.

   ```powershell
   npm.cmd install -g firebase-tools
   ```

6. Verify the Firebase CLI.

   ```powershell
   firebase.cmd --version
   ```

7. Log in to Firebase.

   ```powershell
   firebase.cmd login
   ```

8. Start a local server.

   Use VS Code Live Server, or run another static server from the project root. The app is static and does not require a build step.

## Firebase Deployment

Firestore rules are defined in `firestore.rules`.

Deploy Firestore rules with:

```powershell
firebase.cmd deploy --only firestore:rules --project where-s-my-stuff-49e68
```

Deploy rules after any security-rule change and smoke test the signed-in workflow afterward.

## Git Workflow

- Work on `main` for now unless instructed otherwise.
- Test locally before preparing changes.
- Commit only after approval.
- Push after successful test.

## Current Project Status

The app currently supports:

- Google sign-in
- Firestore sync
- Real-time updates
- Saved locations
- Household-based data model
- Cross-device persistence

## Troubleshooting

### PowerShell Blocks npm Scripts

If PowerShell blocks script execution when running `npm`, use the Windows command shim instead:

```powershell
npm.cmd -v
npm.cmd install -g firebase-tools
```

Use the same pattern for Firebase:

```powershell
firebase.cmd --version
firebase.cmd login
```

### Firebase Authorized Domain

Google sign-in requires the deployed app domain to be authorized in Firebase Authentication.

Ensure this domain is authorized:

```text
broadstreet101.github.io
```

### Service Worker And Cache Issues

The app uses a service worker to cache static files. If a browser keeps showing old behavior after a code change:

- Hard refresh the page.
- Close and reopen the tab.
- Clear site data for the local or GitHub Pages origin.
- Confirm `CACHE_NAME` was bumped when cached app files changed.

### GitHub Pages Deployment Delay

GitHub Pages can take a short time to publish changes after a push. If the live app does not update immediately:

- Wait a few minutes.
- Refresh the page.
- Check the repository's Pages deployment status.
- Watch for service-worker caching if the page loads but behavior looks stale.
