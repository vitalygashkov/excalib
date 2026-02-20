import {
  DEFAULT_SETTINGS,
  DEFAULT_SYNC_STATE,
  type ExtensionSettings,
  type SyncState,
} from "@/src/shared/types";

const SETTINGS_KEY = "shelf.settings";
const SYNC_STATE_KEY = "shelf.sync-state";

export async function getSettings() {
  console.log("getSettings");
  const data = await browser.storage.local.get(SETTINGS_KEY);
  const stored = data[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
  } satisfies ExtensionSettings;
}

export async function updateSettings(patch: Partial<ExtensionSettings>) {
  const current = await getSettings();
  const next = {
    ...current,
    ...patch,
  } satisfies ExtensionSettings;

  next.autoSyncIntervalMinutes = Math.min(
    120,
    Math.max(1, Math.floor(next.autoSyncIntervalMinutes)),
  );

  await browser.storage.local.set({
    [SETTINGS_KEY]: next,
  });

  return next;
}

export async function getSyncState() {
  console.log("getSyncState");
  const data = await browser.storage.local.get(SYNC_STATE_KEY);
  const stored = data[SYNC_STATE_KEY] as Partial<SyncState> | undefined;
  return {
    ...DEFAULT_SYNC_STATE,
    ...stored,
  } satisfies SyncState;
}

export async function updateSyncState(patch: Partial<SyncState>) {
  console.log("updateSyncState", patch);
  const current = await getSyncState();
  const next = {
    ...current,
    ...patch,
  } satisfies SyncState;

  await browser.storage.local.set({
    [SYNC_STATE_KEY]: next,
  });

  return next;
}
