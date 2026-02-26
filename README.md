# Excalib

Chrome extension for Excalidraw Free users that adds:

- Multi-scene management (create, open, rename, soft-delete, restore, purge)
- Local conflict backups and archive retention
- Google Drive sync (manual and automatic intervals) (experimental, expect nothing to work)

> Excalib is an independent enhancement and is not officially affiliated with the Excalidraw project.

## Stack

- TypeScript
- [WXT](https://wxt.dev/) + SolidJS
- Tailwind CSS v4
- Zaidan-style local UI components
- `solid-sonner` (toasts via shared notification wrappers)
- `oxlint` + `oxfmt`
- `vitest`

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure Google OAuth client ID (required for Drive sync):

Create `.env.local` in project root:

```bash
WXT_GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

3. Run extension dev mode:

```bash
pnpm dev
```

4. Load generated extension folder in Chrome (`chrome://extensions`, Developer mode, Load unpacked).

## Scripts

- `pnpm dev` - start dev build/watch
- `pnpm build` - production build
- `pnpm zip` - zip bundle
- `pnpm test` - run vitest
- `pnpm lint` - run oxlint
- `pnpm format` - run oxfmt
- `pnpm typecheck` - TypeScript checks

## Releases

GitHub Releases are used to publish installable extension bundles for Chrome and Firefox.

- Workflow: `Release Extension Bundles`
- Auto trigger: push a version tag matching `package.json` version (`vX.Y.Z`)
- Manual trigger: run `workflow_dispatch` (uses existing matching tag only)

Release rules:

- `package.json` version is authoritative
- Pushed tag must exactly match `v${package.json.version}` or workflow fails
- Manual runs use `v${package.json.version}`
- If the matching tag is missing in a manual run, the workflow fails with instructions to push the tag first

Published release assets:

- `.output/excalib-<version>-chrome.zip`
- `.output/excalib-<version>-firefox.zip`

## Main Architecture

- Background service
  - IndexedDB scene store (`scenes`, `payloads`, `backups`, `meta`)
  - Google Drive integration (folder + manifest + scene files)
  - Runtime message protocol dispatcher
  - Auto-sync alarm scheduler
- Content script
  - Shadow-root mounted library sidebar UI
  - Excalidraw data bridge for local storage + files IndexedDB snapshot/apply
  - Autosave and auto-sync tick when tab is active
  - Auth, sync controls, and settings editing
  - Shared notification and confirm wrappers

## Notes

- Switching scenes applies the selected payload, then reloads the Excalidraw tab to ensure the app consumes the updated local data.
- Sync uses a manifest file (`manifest.json`) inside a Drive folder named `Excalib`.
- Scene delete is soft-delete first (Archive). Purge permanently removes local scene and backups.
