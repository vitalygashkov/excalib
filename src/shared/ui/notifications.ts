import { toast } from "solid-sonner";

export type SyncStatus = "synced" | "pending" | "error" | "offline";

const SYNC_TOAST_ID = "sync-status-toast";
const SYNC_DEDUPE_WINDOW_MS = 1_500;

let lastSyncStatus: SyncStatus | null = null;
let lastSyncAt = 0;

export function notifySuccess(message: string) {
  toast.success(message);
}

export function notifyError(message: string, actionLabel?: string, onAction?: () => void) {
  console.error(message);

  if (actionLabel && onAction) {
    toast.error(message, {
      action: {
        label: actionLabel,
        onClick: onAction,
      },
    });
    return;
  }

  toast.error(message);
}

export function notifySyncStatus(status: SyncStatus) {
  const now = Date.now();
  if (status === lastSyncStatus && now - lastSyncAt < SYNC_DEDUPE_WINDOW_MS) {
    return;
  }

  lastSyncStatus = status;
  lastSyncAt = now;

  if (status === "synced") {
    toast.success("All scenes are synced", { id: SYNC_TOAST_ID });
    return;
  }

  if (status === "pending") {
    toast.loading("Sync is pending", { id: SYNC_TOAST_ID });
    return;
  }

  if (status === "offline") {
    toast.warning("Offline mode: sync queued", { id: SYNC_TOAST_ID });
    return;
  }

  toast.error("Sync failed", { id: SYNC_TOAST_ID });
}

export function __resetNotificationsForTests() {
  lastSyncStatus = null;
  lastSyncAt = 0;
}
