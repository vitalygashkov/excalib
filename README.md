# Excalib

Excalib is a browser extension for Excalidraw users (primarily for Free users) that adds scene management features and optional Google Drive sync.

> Excalib is an independent enhancement and is not officially affiliated with the Excalidraw project.

## Features

- Multi-scene management (create, open, rename, archive, restore, purge)
- Local conflict backups and archive retention
- Google Drive sync (manual and interval sync) (experimental, expect nothing to work)

## Install From GitHub Release

1. Download the latest `excalib-<version>-chrome.zip` (Firefox supported as well) from [Releases](https://github.com/vitalygashkov/excalib/releases).
2. Unzip the file to a folder on your disk.
3. Open `chrome://extensions/` in Chrome.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the unzipped folder that contains `manifest.json`.

If Chrome rejects the extension folder, you likely selected the `.zip` directly or picked the wrong directory level.

## Permissions

Excalib requests:

- `storage`: persist extension settings and scene metadata.
- `identity`: Google OAuth sign-in for Drive sync.
- `alarms`: interval-based auto-sync scheduling.
- Host permissions:
  - `https://excalidraw.com/*` and `https://app.excalidraw.com/*`: integrate with Excalidraw pages.
  - Google API hosts: used only for Drive sync flows.

## Known Limitations

- Google Drive sync is experimental and optional.

## Documentation

- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
