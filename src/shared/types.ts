export type UiDensity = "comfortable" | "compact";
export type SyncMode = "manual" | "auto";

export type SyncStatus = "synced" | "pending" | "error" | "offline";

export type ExcalidrawElement = Record<string, unknown> & {
  fileId?: string;
  id?: string;
};

export type ExcalidrawFileData = Record<string, unknown> & {
  id?: string;
};

export interface ScenePayload {
  appState: Record<string, unknown> | null;
  capturedAt: number;
  elements: ExcalidrawElement[];
  files: Record<string, ExcalidrawFileData>;
}

export interface SceneRecord {
  createdAt: number;
  deletedAt: number | null;
  dirty: boolean;
  driveFileId: string | null;
  driveModifiedTime: number | null;
  hash: string;
  id: string;
  revision: number;
  title: string;
  updatedAt: number;
}

export interface SceneBackup {
  createdAt: number;
  id: string;
  payload: ScenePayload;
  reason: "conflict" | "manual";
  sceneId: string;
}

export interface DriveManifestScene {
  deletedAt: number | null;
  fileId: string | null;
  hash: string;
  id: string;
  revision: number;
  title: string;
  updatedAt: number;
}

export interface DriveManifest {
  scenes: DriveManifestScene[];
  updatedAt: number;
  version: 1;
}

export interface ExtensionSettings {
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  backupRetention: number;
  syncMode: SyncMode;
  archiveRetentionDays: number;
  uiDensity: UiDensity;
}

export interface SyncState {
  driveFolderId: string | null;
  driveManifestFileId: string | null;
  lastError: string | null;
  lastSyncAt: number | null;
}

export interface AuthState {
  signedIn: boolean;
  tokenAvailable: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoSyncEnabled: true,
  autoSyncIntervalMinutes: 5,
  backupRetention: 3,
  syncMode: "auto",
  archiveRetentionDays: 30,
  uiDensity: "comfortable",
};

export const DEFAULT_SYNC_STATE: SyncState = {
  driveFolderId: null,
  driveManifestFileId: null,
  lastError: null,
  lastSyncAt: null,
};

export const EXCALIDRAW_KEYS = {
  APP_STATE: "excalidraw-state",
  ELEMENTS: "excalidraw",
  VERSION_DATA_STATE: "version-dataState",
  VERSION_FILES: "version-files",
} as const;
