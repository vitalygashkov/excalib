import { getAuthState, getAuthToken, signOut } from "@/src/background/drive";
import {
  createScene,
  deleteScene,
  ensureBootstrap,
  getCurrentSceneId,
  listScenes,
  openScene,
  purgeScene,
  renameScene,
  restoreScene,
  saveCurrentScene,
} from "@/src/background/scenes";
import {
  getSettings,
  getSyncState,
  updateSettings,
  updateSyncState,
} from "@/src/background/settings";
import { runSync } from "@/src/background/sync";
import type {
  InitResponse,
  SceneCurrentResponse,
  SceneListResponse,
  SceneMutationResponse,
  SceneOpenResponse,
  SettingsResponse,
  ShelfRequest,
  ShelfResponse,
  SyncResponse,
} from "@/src/shared/protocol";
import { ShelfProtocolError } from "@/src/shared/protocol";

export async function handleShelfMessage(message: ShelfRequest): Promise<ShelfResponse> {
  console.log("handleShelfMessage", message);
  await ensureBootstrap();

  const safeAuthState = async () => {
    try {
      return await getAuthState();
    } catch {
      return {
        signedIn: false,
        tokenAvailable: false,
      };
    }
  };

  switch (message.type) {
    case "init": {
      const scenes = await listScenes(true);
      const currentSceneId = await getCurrentSceneId();
      const settings = await getSettings();
      const syncState = await getSyncState();
      const auth = await safeAuthState();

      const response: InitResponse = {
        auth,
        currentSceneId,
        scenes,
        settings,
        syncState,
      };

      return response;
    }

    case "scene.list": {
      const response: SceneListResponse = {
        scenes: await listScenes(message.includeDeleted ?? false),
      };
      return response;
    }

    case "scene.current": {
      const response: SceneCurrentResponse = {
        currentSceneId: await getCurrentSceneId(),
      };
      return response;
    }

    case "scene.create": {
      const scene = await createScene(message.title);
      console.log("scene.create", scene);
      const response: SceneMutationResponse = { scene };
      return response;
    }

    case "scene.rename": {
      const scene = await renameScene(message.sceneId, message.title);
      const response: SceneMutationResponse = { scene };
      return response;
    }

    case "scene.delete": {
      const scene = await deleteScene(message.sceneId);
      const response: SceneMutationResponse = { scene };
      return response;
    }

    case "scene.restore": {
      const scene = await restoreScene(message.sceneId);
      const response: SceneMutationResponse = { scene };
      return response;
    }

    case "scene.purge": {
      await purgeScene(message.sceneId);
      return { ok: true };
    }

    case "scene.open": {
      const data = await openScene(message.sceneId);
      const response: SceneOpenResponse = {
        payload: data.payload,
        scene: data.scene,
      };
      return response;
    }

    case "scene.capture-current": {
      const scene = await saveCurrentScene(message.payload, message.sceneId);
      const response: SceneMutationResponse = { scene };
      return response;
    }

    case "settings.get": {
      const settings = await getSettings();
      const response: SettingsResponse = { settings };
      return response;
    }

    case "settings.update": {
      const settings = await updateSettings(message.patch);
      await configureAutoSyncAlarm();
      const response: SettingsResponse = { settings };
      return response;
    }

    case "sync.manual": {
      const response: SyncResponse = await runSync("manual");
      return response;
    }

    case "sync.auto": {
      const settings = await getSettings();
      if (!settings.autoSyncEnabled || settings.syncMode !== "auto") {
        const syncState = await getSyncState();
        return {
          result: {
            message: "Auto sync disabled",
            status: "pending",
          },
          syncState,
        };
      }

      const response: SyncResponse = await runSync("auto");
      return response;
    }

    case "auth.status": {
      return {
        auth: await safeAuthState(),
      };
    }

    case "auth.signin": {
      const token = await getAuthToken(true);
      const auth = await safeAuthState();

      if (!token || !auth.signedIn) {
        throw new ShelfProtocolError("Google Drive sign-in failed");
      }

      await updateSyncState({
        lastError: null,
      });

      return { auth };
    }

    case "auth.signout": {
      await signOut();
      await updateSyncState({
        lastError: null,
      });
      return {
        auth: await safeAuthState(),
      };
    }

    default:
      throw new ShelfProtocolError(`Unknown message type: ${(message as ShelfRequest).type}`);
  }
}
import { configureAutoSyncAlarm } from "@/src/background/alarms";
