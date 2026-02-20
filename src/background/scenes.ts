import { getShelfDb } from "@/src/background/db";
import { hashJson } from "@/src/background/hash";
import type {
  DriveManifestScene,
  SceneBackup,
  ScenePayload,
  SceneRecord,
} from "@/src/shared/types";

const CURRENT_SCENE_META_KEY = "currentSceneId";
const SCENE_COUNTER_META_KEY = "sceneCounter";

function now() {
  return Date.now();
}

function emptyScenePayload(): ScenePayload {
  return {
    appState: {},
    capturedAt: now(),
    elements: [],
    files: {},
  };
}

function toSortedScenes(scenes: SceneRecord[]) {
  return scenes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function ensureBootstrap() {
  const db = await getShelfDb();
  const count = await db.count("scenes");

  if (count > 0) {
    const currentSceneId = await db.get("meta", CURRENT_SCENE_META_KEY);
    if (typeof currentSceneId !== "string") {
      const scenes = await db.getAll("scenes");
      const first = toSortedScenes(scenes)[0];
      if (first) {
        await db.put("meta", first.id, CURRENT_SCENE_META_KEY);
      }
    }
    return;
  }

  const payload = emptyScenePayload();
  const hash = await hashJson(payload);
  const timestamp = now();

  const scene: SceneRecord = {
    createdAt: timestamp,
    deletedAt: null,
    dirty: true,
    driveFileId: null,
    driveModifiedTime: null,
    hash,
    id: crypto.randomUUID(),
    revision: 1,
    title: "Scene 1",
    updatedAt: timestamp,
  };

  const tx = db.transaction(["meta", "payloads", "scenes"], "readwrite");
  await tx.objectStore("scenes").put(scene);
  await tx.objectStore("payloads").put(payload, scene.id);
  await tx.objectStore("meta").put(scene.id, CURRENT_SCENE_META_KEY);
  await tx.objectStore("meta").put(1, SCENE_COUNTER_META_KEY);
  await tx.done;
}

export async function listScenes(includeDeleted = false) {
  console.log("listScenes", { includeDeleted });
  await ensureBootstrap();
  const db = await getShelfDb();
  const scenes = await db.getAll("scenes");
  return toSortedScenes(scenes).filter((scene) => includeDeleted || scene.deletedAt === null);
}

export async function getCurrentSceneId() {
  console.log("getCurrentSceneId");
  await ensureBootstrap();
  const db = await getShelfDb();
  const sceneId = await db.get("meta", CURRENT_SCENE_META_KEY);
  if (typeof sceneId === "string") {
    return sceneId;
  }

  const scenes = await listScenes();
  if (!scenes[0]) {
    throw new Error("No scenes found");
  }

  await db.put("meta", scenes[0].id, CURRENT_SCENE_META_KEY);
  return scenes[0].id;
}

export async function setCurrentSceneId(sceneId: string) {
  const db = await getShelfDb();
  await db.put("meta", sceneId, CURRENT_SCENE_META_KEY);
}

export async function getScene(sceneId: string) {
  const db = await getShelfDb();
  const scene = await db.get("scenes", sceneId);
  if (!scene) {
    throw new Error(`Scene ${sceneId} not found`);
  }

  return scene;
}

export async function getScenePayload(sceneId: string) {
  const db = await getShelfDb();
  return (await db.get("payloads", sceneId)) ?? null;
}

async function nextSceneNumber() {
  const db = await getShelfDb();
  const current = await db.get("meta", SCENE_COUNTER_META_KEY);
  const number = typeof current === "number" ? current + 1 : 1;
  await db.put("meta", number, SCENE_COUNTER_META_KEY);
  return number;
}

export async function createScene(title?: string) {
  const db = await getShelfDb();
  const timestamp = now();
  const payload = emptyScenePayload();
  const hash = await hashJson(payload);
  const sceneNumber = await nextSceneNumber();

  const scene: SceneRecord = {
    createdAt: timestamp,
    deletedAt: null,
    dirty: true,
    driveFileId: null,
    driveModifiedTime: null,
    hash,
    id: crypto.randomUUID(),
    revision: 1,
    title: title?.trim() || `Scene ${sceneNumber}`,
    updatedAt: timestamp,
  };

  const tx = db.transaction(["payloads", "scenes"], "readwrite");
  await tx.objectStore("scenes").put(scene);
  await tx.objectStore("payloads").put(payload, scene.id);
  await tx.done;

  return scene;
}

export async function renameScene(sceneId: string, title: string) {
  const db = await getShelfDb();
  const scene = await getScene(sceneId);
  const timestamp = now();
  const next: SceneRecord = {
    ...scene,
    dirty: true,
    revision: scene.revision + 1,
    title: title.trim() || scene.title,
    updatedAt: timestamp,
  };

  await db.put("scenes", next);
  return next;
}

export async function deleteScene(sceneId: string) {
  const db = await getShelfDb();
  const scene = await getScene(sceneId);

  const next: SceneRecord = {
    ...scene,
    deletedAt: now(),
    dirty: true,
    revision: scene.revision + 1,
    updatedAt: now(),
  };

  await db.put("scenes", next);

  const currentSceneId = await getCurrentSceneId();
  if (currentSceneId === sceneId) {
    const remaining = (await listScenes()).filter((entry) => entry.id !== sceneId);
    if (remaining[0]) {
      await setCurrentSceneId(remaining[0].id);
    }
  }

  return next;
}

export async function restoreScene(sceneId: string) {
  const db = await getShelfDb();
  const scene = await getScene(sceneId);

  const next: SceneRecord = {
    ...scene,
    deletedAt: null,
    dirty: true,
    revision: scene.revision + 1,
    updatedAt: now(),
  };

  await db.put("scenes", next);
  return next;
}

export async function purgeScene(sceneId: string) {
  const db = await getShelfDb();

  const tx = db.transaction(["backups", "payloads", "scenes"], "readwrite");
  const backupStore = tx.objectStore("backups");
  const sceneBackups = await backupStore.index("by-sceneId").getAllKeys(sceneId);
  await Promise.all(sceneBackups.map((key) => backupStore.delete(key)));

  await tx.objectStore("payloads").delete(sceneId);
  await tx.objectStore("scenes").delete(sceneId);
  await tx.done;

  const currentSceneId = await getCurrentSceneId();
  if (currentSceneId === sceneId) {
    const scenes = await listScenes();
    if (scenes[0]) {
      await setCurrentSceneId(scenes[0].id);
    }
  }
}

export async function openScene(sceneId: string) {
  const scene = await getScene(sceneId);
  const payload = await getScenePayload(sceneId);

  if (!payload) {
    throw new Error(`Scene payload ${sceneId} not found`);
  }

  await setCurrentSceneId(sceneId);
  return { payload, scene };
}

export async function saveCurrentScene(payload: ScenePayload, sceneId?: string) {
  const id = sceneId ?? (await getCurrentSceneId());
  const db = await getShelfDb();
  const scene = await getScene(id);
  const hash = await hashJson(payload);

  if (scene.hash === hash && scene.deletedAt === null) {
    return scene;
  }

  const timestamp = now();
  const next: SceneRecord = {
    ...scene,
    deletedAt: null,
    dirty: true,
    hash,
    revision: scene.revision + 1,
    updatedAt: timestamp,
  };

  const tx = db.transaction(["payloads", "scenes"], "readwrite");
  await tx.objectStore("payloads").put(payload, id);
  await tx.objectStore("scenes").put(next);
  await tx.done;

  return next;
}

export async function createBackup(
  sceneId: string,
  payload: ScenePayload,
  reason: SceneBackup["reason"],
  retention: number,
) {
  const db = await getShelfDb();

  const backup: SceneBackup = {
    createdAt: now(),
    id: `${sceneId}:${crypto.randomUUID()}`,
    payload,
    reason,
    sceneId,
  };

  await db.put("backups", backup);

  const backups = await db.getAllFromIndex("backups", "by-sceneId", sceneId);
  const extra = backups.sort((a, b) => b.createdAt - a.createdAt).slice(Math.max(0, retention));

  await Promise.all(extra.map((item) => db.delete("backups", item.id)));
}

export async function applyRemoteScene(remote: DriveManifestScene, payload: ScenePayload) {
  const db = await getShelfDb();
  const existing = await db.get("scenes", remote.id);

  const next: SceneRecord = {
    createdAt: existing?.createdAt ?? remote.updatedAt,
    deletedAt: remote.deletedAt,
    dirty: false,
    driveFileId: remote.fileId,
    driveModifiedTime: remote.updatedAt,
    hash: remote.hash,
    id: remote.id,
    revision: remote.revision,
    title: remote.title,
    updatedAt: remote.updatedAt,
  };

  const tx = db.transaction(["payloads", "scenes"], "readwrite");
  await tx.objectStore("scenes").put(next);
  await tx.objectStore("payloads").put(payload, next.id);
  await tx.done;

  return next;
}

export async function applyRemoteDeletion(remote: DriveManifestScene) {
  const db = await getShelfDb();
  const existing = await db.get("scenes", remote.id);

  if (!existing) {
    const placeholderPayload = emptyScenePayload();
    await applyRemoteScene(remote, placeholderPayload);
    return;
  }

  const next: SceneRecord = {
    ...existing,
    deletedAt: remote.deletedAt,
    dirty: false,
    driveFileId: remote.fileId,
    driveModifiedTime: remote.updatedAt,
    hash: remote.hash,
    revision: remote.revision,
    title: remote.title,
    updatedAt: remote.updatedAt,
  };

  await db.put("scenes", next);
}

export async function markSceneSynced(sceneId: string, patch: Partial<SceneRecord>) {
  const db = await getShelfDb();
  const scene = await getScene(sceneId);

  const next: SceneRecord = {
    ...scene,
    ...patch,
    dirty: false,
  };

  await db.put("scenes", next);
  return next;
}

export async function cleanupDeletedScenes(retentionDays: number) {
  const db = await getShelfDb();
  const threshold = now() - retentionDays * 24 * 60 * 60 * 1000;
  const scenes = await db.getAll("scenes");

  const stale = scenes.filter((scene) => scene.deletedAt !== null && scene.deletedAt < threshold);
  await Promise.all(stale.map((scene) => purgeScene(scene.id)));
}
