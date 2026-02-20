import { createMemo, createSignal, onCleanup, onMount, type Accessor, type Setter } from "solid-js";
import {
  applyScenePayloadToPage,
  captureScenePayloadFromPage,
  reloadAfterSceneApply,
} from "@/src/content/excalidraw-bridge";
import {
  createShelfScene,
  deleteShelfScene,
  getShelfCurrentScene,
  getShelfSettings,
  initShelf,
  listShelfScenes,
  openShelfScene,
  purgeShelfScene,
  renameShelfScene,
  restoreShelfScene,
  runShelfSync,
  saveShelfScene,
  signInShelf,
  signOutShelf,
  updateShelfSettings,
} from "@/src/shared/client";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SYNC_STATE,
  type AuthState,
  type ExtensionSettings,
  type SceneRecord,
  type SyncState,
  type SyncStatus,
} from "@/src/shared/types";
import { confirmConflictOverwrite, confirmSceneDelete } from "@/src/shared/ui/confirm";
import { notifyError, notifySuccess, notifySyncStatus } from "@/src/shared/ui/notifications";
import {
  AUTO_SYNC_TICK_MS,
  deriveInitialSyncStatus,
  SAVE_INTERVAL_MS,
  sortScenes,
  toErrorMessage,
  upsertScene,
} from "./utils";

export interface ShelfController {
  auth: Accessor<AuthState>;
  busy: Accessor<string | null>;
  currentSceneId: Accessor<string>;
  currentSceneName: Accessor<string>;
  densityClass: Accessor<string>;
  newSceneTitle: Accessor<string>;
  panelOpen: Accessor<boolean>;
  ready: Accessor<boolean>;
  sceneRows: Accessor<SceneRecord[]>;
  settings: Accessor<ExtensionSettings>;
  syncState: Accessor<SyncState>;
  syncStatus: Accessor<SyncStatus>;
  archiveRows: Accessor<SceneRecord[]>;
  createScene: () => Promise<void>;
  deleteScene: (scene: SceneRecord) => Promise<void>;
  openScene: (sceneId: string, captureBefore?: boolean, force?: boolean) => Promise<void>;
  purgeScene: (scene: SceneRecord) => Promise<void>;
  refreshSceneList: () => Promise<void>;
  renameScene: (scene: SceneRecord) => Promise<void>;
  restoreScene: (sceneId: string) => Promise<void>;
  runManualSync: () => Promise<void>;
  setNewSceneTitle: Setter<string>;
  setPanelOpen: Setter<boolean>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  stopShortcutPropagation: (event: KeyboardEvent) => void;
  updateSettings: (patch: Partial<ExtensionSettings>) => Promise<void>;
}

export function useShelfController(): ShelfController {
  const [ready, setReady] = createSignal(false);
  const [panelOpen, setPanelOpen] = createSignal(false);
  const [settings, setSettings] = createSignal<ExtensionSettings>(DEFAULT_SETTINGS);
  const [syncState, setSyncState] = createSignal<SyncState>(DEFAULT_SYNC_STATE);
  const [auth, setAuth] = createSignal<AuthState>({ signedIn: false, tokenAvailable: false });
  const [scenes, setScenes] = createSignal<SceneRecord[]>([]);
  const [currentSceneId, setCurrentSceneId] = createSignal<string>("");
  const [newSceneTitle, setNewSceneTitle] = createSignal("");
  const [busy, setBusy] = createSignal<string | null>(null);
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus>("offline");

  const sceneRows = createMemo(() => scenes().filter((scene) => scene.deletedAt === null));
  const archiveRows = createMemo(() => scenes().filter((scene) => scene.deletedAt !== null));
  const densityClass = createMemo(() =>
    settings().uiDensity === "compact" ? "py-1.5 text-xs" : "py-2.5 text-sm",
  );
  const currentScene = createMemo(() => sceneRows().find((scene) => scene.id === currentSceneId()));
  const currentSceneName = createMemo(() => currentScene()?.title ?? "Untitled");

  const updateSyncStatus = (status: SyncStatus) => {
    setSyncStatus(status);
    notifySyncStatus(status);
  };

  const stopShortcutPropagation = (event: KeyboardEvent) => {
    event.stopPropagation();
  };

  const refreshSceneList = async () => {
    const [sceneList, current] = await Promise.all([listShelfScenes(true), getShelfCurrentScene()]);
    setScenes(sortScenes(sceneList.scenes));
    setCurrentSceneId(current.currentSceneId);
  };

  const initialize = async () => {
    try {
      const response = await initShelf();
      setSettings(response.settings);
      setSyncState(response.syncState);
      setAuth(response.auth);
      setScenes(sortScenes(response.scenes));
      setCurrentSceneId(response.currentSceneId);
      setSyncStatus(deriveInitialSyncStatus(response.syncState, response.auth));
      return;
    } catch {
      // Local-first fallback: load local scene/settings data even when init fails.
      const [sceneResult, currentResult, settingsResult] = await Promise.allSettled([
        listShelfScenes(true),
        getShelfCurrentScene(),
        getShelfSettings(),
      ]);

      if (sceneResult.status === "fulfilled") {
        setScenes(sortScenes(sceneResult.value.scenes));
      }

      if (currentResult.status === "fulfilled") {
        setCurrentSceneId(currentResult.value.currentSceneId);
      }

      if (settingsResult.status === "fulfilled") {
        setSettings(settingsResult.value.settings);
      }

      setSyncStatus("offline");
    } finally {
      setReady(true);
    }
  };

  const saveCurrentSceneSnapshot = async () => {
    const sceneId = currentSceneId();
    if (!sceneId) {
      return;
    }

    const payload = await captureScenePayloadFromPage();
    const response = await saveShelfScene(sceneId, payload);
    setScenes((prev) => upsertScene(prev, response.scene));
  };

  const openScene = async (sceneId: string, captureBefore = true, force = false) => {
    if (sceneId === currentSceneId() && !force) {
      setPanelOpen(false);
      return;
    }

    setBusy(`open:${sceneId}`);

    try {
      if (captureBefore) {
        await saveCurrentSceneSnapshot();
      }

      const response = await openShelfScene(sceneId);
      await applyScenePayloadToPage(response.payload);
      notifySuccess(`Opened ${response.scene.title}`);
      reloadAfterSceneApply();
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const createScene = async () => {
    setBusy("create");

    try {
      await saveCurrentSceneSnapshot();
      const created = await createShelfScene(newSceneTitle().trim() || undefined);

      setScenes((prev) => upsertScene(prev, created.scene));
      setNewSceneTitle("");
      await openScene(created.scene.id, false);
    } catch (error) {
      notifyError(toErrorMessage(error));
      setBusy(null);
    }
  };

  const restoreScene = async (sceneId: string) => {
    setBusy(`restore:${sceneId}`);

    try {
      const response = await restoreShelfScene(sceneId);
      setScenes((prev) => upsertScene(prev, response.scene));
      notifySuccess(`Restored ${response.scene.title}`);
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const deleteScene = async (scene: SceneRecord) => {
    const accepted = await confirmSceneDelete(scene.id);
    if (!accepted) {
      return;
    }

    setBusy(`delete:${scene.id}`);

    try {
      const response = await deleteShelfScene(scene.id);
      setScenes((prev) => upsertScene(prev, response.scene));

      notifyError(`Moved ${scene.title} to Archive`, "Undo", () => {
        void restoreScene(scene.id);
      });

      if (scene.id !== currentSceneId()) {
        return;
      }

      const current = await getShelfCurrentScene();
      setCurrentSceneId(current.currentSceneId);

      if (current.currentSceneId !== scene.id) {
        await openScene(current.currentSceneId, false, true);
      }
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const purgeScene = async (scene: SceneRecord) => {
    const accepted = window.confirm(`Permanently delete "${scene.title}"?`);
    if (!accepted) {
      return;
    }

    setBusy(`purge:${scene.id}`);

    try {
      await purgeShelfScene(scene.id);
      setScenes((prev) => prev.filter((entry) => entry.id !== scene.id));
      notifySuccess(`Deleted ${scene.title}`);
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const renameScene = async (scene: SceneRecord) => {
    const title = window.prompt("Rename scene", scene.title)?.trim();
    if (!title || title === scene.title) {
      return;
    }

    setBusy(`rename:${scene.id}`);

    try {
      const response = await renameShelfScene(scene.id, title);
      setScenes((prev) => upsertScene(prev, response.scene));
      notifySuccess(`Renamed to ${response.scene.title}`);
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const runSync = async (mode: "auto" | "manual") => {
    if (busy() === "sync") {
      return;
    }

    if (mode === "manual") {
      const activeScene = sceneRows().find((scene) => scene.id === currentSceneId());
      if (activeScene?.dirty) {
        const accepted = await confirmConflictOverwrite(activeScene.id);
        if (!accepted) {
          return;
        }
      }
    }

    setBusy("sync");

    try {
      await saveCurrentSceneSnapshot();
      const response = await runShelfSync(mode);
      setSyncState(response.syncState);
      updateSyncStatus(response.result.status);

      if (response.result.status === "synced") {
        notifySuccess(response.result.message ?? "Sync complete");
      } else if (response.result.status === "error" || response.result.status === "offline") {
        notifyError(response.result.message ?? "Sync failed");
      }

      await refreshSceneList();
    } catch (error) {
      updateSyncStatus("error");
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const runManualSync = async () => {
    await runSync("manual");
  };

  const updateSettings = async (patch: Partial<ExtensionSettings>) => {
    setBusy("settings");

    try {
      const response = await updateShelfSettings(patch);
      setSettings(response.settings);
      notifySuccess("Settings updated");
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const signIn = async () => {
    setBusy("auth");

    try {
      const response = await signInShelf();
      setAuth(response.auth);
      setSyncStatus("pending");
      notifySuccess("Google Drive connected");
    } catch (error) {
      const message = toErrorMessage(error);
      notifyError(`${message}. Set WXT_GOOGLE_OAUTH_CLIENT_ID in .env.local if missing.`);
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy("auth");

    try {
      const response = await signOutShelf();
      setAuth(response.auth);
      setSyncStatus("offline");
      notifySuccess("Google Drive disconnected");
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  onMount(() => {
    void initialize();

    const saveTimer = window.setInterval(() => {
      if (!document.hidden) {
        void saveCurrentSceneSnapshot().catch(() => {
          // best-effort autosave
        });
      }
    }, SAVE_INTERVAL_MS);

    const syncTimer = window.setInterval(() => {
      const nextSettings = settings();
      const signedIn = auth().signedIn;

      if (
        !document.hidden &&
        signedIn &&
        nextSettings.autoSyncEnabled &&
        nextSettings.syncMode === "auto"
      ) {
        void runSync("auto");
      }
    }, AUTO_SYNC_TICK_MS);

    const visibilityHandler = () => {
      if (document.hidden) {
        void saveCurrentSceneSnapshot().catch(() => {
          // best-effort autosave on tab blur
        });
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    onCleanup(() => {
      window.clearInterval(saveTimer);
      window.clearInterval(syncTimer);
      document.removeEventListener("visibilitychange", visibilityHandler);
    });
  });

  return {
    auth,
    busy,
    createScene,
    currentSceneId,
    currentSceneName,
    deleteScene,
    densityClass,
    newSceneTitle,
    openScene,
    panelOpen,
    purgeScene,
    ready,
    refreshSceneList,
    renameScene,
    restoreScene,
    runManualSync,
    sceneRows,
    setNewSceneTitle,
    setPanelOpen,
    settings,
    signIn,
    signOut,
    stopShortcutPropagation,
    syncState,
    syncStatus,
    archiveRows,
    updateSettings,
  };
}
