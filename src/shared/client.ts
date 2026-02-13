import type {
  AuthResponse,
  InitResponse,
  SceneCurrentResponse,
  SceneListResponse,
  SceneMutationResponse,
  SettingsResponse,
  SyncResponse,
} from "@/src/shared/protocol";
import type { ExtensionSettings, ScenePayload } from "@/src/shared/types";
import { sendShelfMessage } from "@/src/shared/runtime";

export function initShelf() {
  return sendShelfMessage<InitResponse>({ type: "init" });
}

export function listShelfScenes(includeDeleted = true) {
  return sendShelfMessage<SceneListResponse>({ includeDeleted, type: "scene.list" });
}

export function getShelfCurrentScene() {
  return sendShelfMessage<SceneCurrentResponse>({ type: "scene.current" });
}

export function createShelfScene(title?: string) {
  return sendShelfMessage<SceneMutationResponse>({ title, type: "scene.create" });
}

export function renameShelfScene(sceneId: string, title: string) {
  return sendShelfMessage<SceneMutationResponse>({ sceneId, title, type: "scene.rename" });
}

export function deleteShelfScene(sceneId: string) {
  return sendShelfMessage<SceneMutationResponse>({ sceneId, type: "scene.delete" });
}

export function restoreShelfScene(sceneId: string) {
  return sendShelfMessage<SceneMutationResponse>({ sceneId, type: "scene.restore" });
}

export function purgeShelfScene(sceneId: string) {
  return sendShelfMessage({ sceneId, type: "scene.purge" });
}

export function saveShelfScene(sceneId: string, payload: ScenePayload) {
  return sendShelfMessage<SceneMutationResponse>({ payload, sceneId, type: "scene.capture-current" });
}

export function getShelfSettings() {
  return sendShelfMessage<SettingsResponse>({ type: "settings.get" });
}

export function updateShelfSettings(patch: Partial<ExtensionSettings>) {
  return sendShelfMessage<SettingsResponse>({ patch, type: "settings.update" });
}

export function runShelfSync(mode: "manual" | "auto") {
  return sendShelfMessage<SyncResponse>({ type: mode === "manual" ? "sync.manual" : "sync.auto" });
}

export function getShelfAuthStatus() {
  return sendShelfMessage<AuthResponse>({ type: "auth.status" });
}

export function signInShelf() {
  return sendShelfMessage<AuthResponse>({ type: "auth.signin" });
}

export function signOutShelf() {
  return sendShelfMessage<AuthResponse>({ type: "auth.signout" });
}
