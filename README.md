# Excalidraw Shelf

Chrome extension for Excalidraw Free users that adds:

- Multi-scene management (create, open, rename, soft-delete, restore, purge)
- Scene library sidebar injected into `excalidraw.com` / `app.excalidraw.com`
- Google Drive sync (manual and automatic intervals)
- Local conflict backups and trash retention
- Single in-page settings surface (inside the injected sidebar)

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
- Sync uses a manifest file (`manifest.json`) inside a Drive folder named `Excalidraw Shelf`.
- Scene delete is soft-delete first (Trash). Purge permanently removes local scene and backups.
