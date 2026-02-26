# Contributing to Excalib

Thanks for contributing.

## Prerequisites

- Node.js `24.x` (matches CI)
- `pnpm` `10.28.1` (or compatible `10.x`)
- Chrome (for local extension testing)

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create local environment file from the example:

```bash
cp .env.example .env.local
```

3. Set `WXT_GOOGLE_OAUTH_CLIENT_ID` in `.env.local` only if you are working on Google Drive sync.

4. Start development build/watch:

```bash
pnpm dev
```

5. Load the generated extension folder from `.output/chrome-mv3` in `chrome://extensions/` using **Load unpacked**.

## Commands

- `pnpm dev`: development build/watch for Chrome
- `pnpm dev:firefox`: development build/watch for Firefox
- `pnpm build`: production build for Chrome
- `pnpm build:firefox`: production build for Firefox
- `pnpm zip`: create Chrome release zip
- `pnpm zip:firefox`: create Firefox release zip
- `pnpm typecheck`: TypeScript checks
- `pnpm lint`: lint checks (`oxlint`)
- `pnpm test`: run unit tests (`vitest`)
- `pnpm format`: format code (`oxfmt`)

## Quality Gates Before Opening a PR

Run these locally and ensure they pass:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If your change affects release packaging, also run:

```bash
pnpm zip
```

## Architecture Notes

- Extension config/manifest: `wxt.config.ts`
- Entry points: `entrypoints/background.ts`, `entrypoints/content.tsx`
- Background logic: `src/background/*`
- Content-side integration: `src/content/*`
- UI/features: `src/features/*`, `src/components/*`
- Shared contracts/types: `src/shared/*`

## Pull Request Expectations

- Keep PRs focused and small enough to review.
- Add or update tests for behavior changes.
- Update docs when user-facing behavior changes.
- Do not commit secrets or local env files (`.env.local` is intentionally ignored).
- Use clear PR descriptions that include:
  - problem statement
  - approach
  - testing performed
