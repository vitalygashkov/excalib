import {
  applyRemoteDeletion,
  applyRemoteScene,
  cleanupDeletedScenes,
  createBackup,
  getScenePayload,
  listScenes,
  markSceneSynced,
} from "@/src/background/scenes";
import {
  downloadSceneFile,
  ensureManifest,
  ensureShelfFolder,
  getAuthToken,
  saveManifest,
  uploadSceneFile,
} from "@/src/background/drive";
import { getSettings, getSyncState, updateSyncState } from "@/src/background/settings";
import type { DriveManifest, DriveManifestScene } from "@/src/shared/types";

function isLikelyOfflineError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("network") ||
    text.includes("failed to fetch") ||
    text.includes("token") ||
    text.includes("not signed")
  );
}

function buildManifestScene(local: {
  deletedAt: number | null;
  driveFileId: string | null;
  hash: string;
  id: string;
  revision: number;
  title: string;
  updatedAt: number;
}): DriveManifestScene {
  return {
    deletedAt: local.deletedAt,
    fileId: local.driveFileId,
    hash: local.hash,
    id: local.id,
    revision: local.revision,
    title: local.title,
    updatedAt: local.updatedAt,
  };
}

export async function runSync(mode: "auto" | "manual") {
  const settings = await getSettings();
  await cleanupDeletedScenes(settings.trashRetentionDays);

  const token = await getAuthToken(mode === "manual");

  if (!token) {
    const syncState = await updateSyncState({
      lastError: "Not signed in to Google Drive",
    });

    return {
      result: {
        message: "Sign in to Google Drive first",
        status: "offline",
      } as const,
      syncState,
    };
  }

  try {
    const syncState = await getSyncState();

    const folderId = await ensureShelfFolder(token, syncState.driveFolderId);
    const manifestInfo = await ensureManifest(token, folderId, syncState.driveManifestFileId);

    const manifestByScene = new Map<string, DriveManifestScene>();
    for (const item of manifestInfo.manifest.scenes) {
      manifestByScene.set(item.id, item);
    }

    let uploaded = 0;
    let downloaded = 0;

    const localScenesBefore = await listScenes(true);
    const localBeforeMap = new Map(localScenesBefore.map((scene) => [scene.id, scene]));

    for (const remote of manifestInfo.manifest.scenes) {
      const local = localBeforeMap.get(remote.id);

      if (!local) {
        if (remote.deletedAt !== null || !remote.fileId) {
          continue;
        }

        const payload = await downloadSceneFile(token, remote.fileId);
        await applyRemoteScene(remote, payload);
        downloaded += 1;
        continue;
      }

      if (remote.updatedAt <= local.updatedAt) {
        continue;
      }

      if (remote.deletedAt !== null) {
        await applyRemoteDeletion(remote);
        continue;
      }

      if (!remote.fileId) {
        continue;
      }

      const localPayload = await getScenePayload(local.id);
      if (localPayload && local.dirty) {
        await createBackup(local.id, localPayload, "conflict", settings.backupRetention);
      }

      const remotePayload = await downloadSceneFile(token, remote.fileId);
      await applyRemoteScene(remote, remotePayload);
      downloaded += 1;
    }

    const localScenes = await listScenes(true);

    for (const local of localScenes) {
      const remote = manifestByScene.get(local.id);
      const shouldUpload =
        !remote ||
        local.updatedAt > remote.updatedAt ||
        (mode === "manual" && local.dirty && local.deletedAt === null);

      if (!shouldUpload) {
        continue;
      }

      if (local.deletedAt !== null) {
        const tombstone = buildManifestScene(local);
        manifestByScene.set(local.id, tombstone);
        await markSceneSynced(local.id, {
          deletedAt: local.deletedAt,
          driveFileId: remote?.fileId ?? local.driveFileId,
          driveModifiedTime: local.updatedAt,
          updatedAt: local.updatedAt,
        });
        continue;
      }

      const payload = await getScenePayload(local.id);
      if (!payload) {
        continue;
      }

      const upload = await uploadSceneFile(token, folderId, local, payload, remote?.fileId ?? local.driveFileId);

      const updatedAt = upload.modifiedTime;
      const nextManifestScene: DriveManifestScene = {
        deletedAt: null,
        fileId: upload.fileId,
        hash: local.hash,
        id: local.id,
        revision: local.revision,
        title: local.title,
        updatedAt,
      };

      manifestByScene.set(local.id, nextManifestScene);

      await markSceneSynced(local.id, {
        deletedAt: null,
        driveFileId: upload.fileId,
        driveModifiedTime: updatedAt,
        updatedAt,
      });

      uploaded += 1;
    }

    const nextManifest: DriveManifest = {
      scenes: Array.from(manifestByScene.values()).sort((a, b) => b.updatedAt - a.updatedAt),
      updatedAt: Date.now(),
      version: 1,
    };

    const manifestWrite = await saveManifest(token, manifestInfo.fileId, nextManifest);

    const nextSyncState = await updateSyncState({
      driveFolderId: folderId,
      driveManifestFileId: manifestWrite.fileId,
      lastError: null,
      lastSyncAt: Date.now(),
    });

    return {
      result: {
        message: "Sync completed",
        status: "synced",
        summary: {
          downloaded,
          uploaded,
        },
      } as const,
      syncState: nextSyncState,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const nextSyncState = await updateSyncState({
      lastError: message,
    });

    return {
      result: {
        message,
        status: isLikelyOfflineError(message) ? "offline" : "error",
      } as const,
      syncState: nextSyncState,
    };
  }
}
