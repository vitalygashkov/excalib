import type { AuthState, SceneRecord, SyncState, SyncStatus } from "@/src/shared/types";

export const SAVE_INTERVAL_MS = 10_000;
export const AUTO_SYNC_TICK_MS = 60_000;

export function sortScenes(scenes: SceneRecord[]) {
  return [...scenes].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertScene(scenes: SceneRecord[], scene: SceneRecord) {
  const next = scenes.filter((entry) => entry.id !== scene.id);
  next.push(scene);
  return sortScenes(next);
}

export function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) {
    return "never";
  }

  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) {
    return "just now";
  }

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function parsePositiveInteger(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(1, Math.floor(value));
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function syncBadgeVariant(status: SyncStatus): "default" | "secondary" | "destructive" {
  if (status === "synced") {
    return "default";
  }

  if (status === "error") {
    return "destructive";
  }

  return "secondary";
}

export function deriveInitialSyncStatus(syncState: SyncState, auth: AuthState): SyncStatus {
  if (syncState.lastError) {
    return "error";
  }

  if (syncState.lastSyncAt) {
    return "synced";
  }

  if (!auth.signedIn) {
    return "offline";
  }

  return "pending";
}
