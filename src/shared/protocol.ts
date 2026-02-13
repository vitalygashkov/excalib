import type {
  AuthState,
  ExtensionSettings,
  ScenePayload,
  SceneRecord,
  SyncState,
  SyncStatus,
} from "@/src/shared/types";

export type InitRequest = { type: "init" };
export type SceneListRequest = { includeDeleted?: boolean; type: "scene.list" };
export type SceneCreateRequest = { title?: string; type: "scene.create" };
export type SceneRenameRequest = { sceneId: string; title: string; type: "scene.rename" };
export type SceneDeleteRequest = { sceneId: string; type: "scene.delete" };
export type SceneRestoreRequest = { sceneId: string; type: "scene.restore" };
export type ScenePurgeRequest = { sceneId: string; type: "scene.purge" };
export type SceneOpenRequest = { sceneId: string; type: "scene.open" };
export type SceneCaptureCurrentRequest = {
  payload: ScenePayload;
  sceneId?: string;
  type: "scene.capture-current";
};
export type SceneGetCurrentRequest = { type: "scene.current" };

export type SettingsGetRequest = { type: "settings.get" };
export type SettingsUpdateRequest = {
  patch: Partial<ExtensionSettings>;
  type: "settings.update";
};

export type SyncManualRequest = { type: "sync.manual" };
export type SyncAutoRequest = { type: "sync.auto" };

export type AuthStatusRequest = { type: "auth.status" };
export type AuthSignInRequest = { type: "auth.signin" };
export type AuthSignOutRequest = { type: "auth.signout" };

export type ShelfRequest =
  | AuthSignInRequest
  | AuthSignOutRequest
  | AuthStatusRequest
  | InitRequest
  | SceneCaptureCurrentRequest
  | SceneCreateRequest
  | SceneDeleteRequest
  | SceneGetCurrentRequest
  | SceneListRequest
  | SceneOpenRequest
  | ScenePurgeRequest
  | SceneRenameRequest
  | SceneRestoreRequest
  | SettingsGetRequest
  | SettingsUpdateRequest
  | SyncAutoRequest
  | SyncManualRequest;

export interface SyncResult {
  message?: string;
  status: SyncStatus;
  summary?: {
    downloaded: number;
    uploaded: number;
  };
}

export interface InitResponse {
  auth: AuthState;
  currentSceneId: string;
  scenes: SceneRecord[];
  settings: ExtensionSettings;
  syncState: SyncState;
}

export interface SceneOpenResponse {
  payload: ScenePayload;
  scene: SceneRecord;
}

export interface SceneCurrentResponse {
  currentSceneId: string;
}

export interface SettingsResponse {
  settings: ExtensionSettings;
}

export interface AuthResponse {
  auth: AuthState;
}

export interface SyncResponse {
  result: SyncResult;
  syncState: SyncState;
}

export interface SceneListResponse {
  scenes: SceneRecord[];
}

export interface SceneMutationResponse {
  scene: SceneRecord;
}

export interface ShelfErrorResponse {
  error: {
    message: string;
  };
}

export type ShelfResponse =
  | AuthResponse
  | InitResponse
  | ShelfErrorResponse
  | SceneCurrentResponse
  | SceneListResponse
  | SceneMutationResponse
  | SceneOpenResponse
  | SettingsResponse
  | SyncResponse
  | { ok: true };

export class ShelfProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShelfProtocolError";
  }
}
