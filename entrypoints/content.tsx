import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import {
  Cloud,
  FolderSync,
  LogIn,
  LogOut,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Trash,
  X,
  Library,
} from "lucide-solid";

import styleText from "@/src/styles.css?inline";
import {
  Badge,
  Button,
  Input,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
} from "@/src/components/ui";
import {
  captureScenePayloadFromPage,
  applyScenePayloadToPage,
  reloadAfterSceneApply,
} from "@/src/content/excalidraw-bridge";
import { sendShelfMessage } from "@/src/shared/runtime";
import type {
  InitResponse,
  SceneCurrentResponse,
  SceneListResponse,
  SceneMutationResponse,
  SceneOpenResponse,
  SettingsResponse,
  SyncResponse,
} from "@/src/shared/protocol";
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

const SAVE_INTERVAL_MS = 10_000;
const AUTO_SYNC_TICK_MS = 60_000;

function sortScenes(scenes: SceneRecord[]) {
  return [...scenes].sort((a, b) => b.updatedAt - a.updatedAt);
}

function upsertScene(scenes: SceneRecord[], scene: SceneRecord) {
  const next = scenes.filter((entry) => entry.id !== scene.id);
  next.push(scene);
  return sortScenes(next);
}

function formatRelativeTime(timestamp: number | null) {
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

function syncBadgeVariant(status: SyncStatus): "default" | "secondary" | "destructive" {
  if (status === "synced") {
    return "default";
  }

  if (status === "error") {
    return "destructive";
  }

  return "secondary";
}

function ContentShelfApp() {
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
  const trashRows = createMemo(() => scenes().filter((scene) => scene.deletedAt !== null));
  const densityClass = createMemo(() =>
    settings().uiDensity === "compact" ? "py-1.5 text-xs" : "py-2.5 text-sm",
  );

  const updateSyncStatus = (status: SyncStatus) => {
    setSyncStatus(status);
    notifySyncStatus(status);
  };

  const refreshScenes = async () => {
    const response = await sendShelfMessage<SceneListResponse>({
      includeDeleted: true,
      type: "scene.list",
    });
    setScenes(sortScenes(response.scenes));

    const current = await sendShelfMessage<SceneCurrentResponse>({ type: "scene.current" });
    setCurrentSceneId(current.currentSceneId);
  };

  const initialize = async () => {
    try {
      const response = await sendShelfMessage<InitResponse>({ type: "init" });
      setSettings(response.settings);
      setSyncState(response.syncState);
      setAuth(response.auth);
      setScenes(sortScenes(response.scenes));
      setCurrentSceneId(response.currentSceneId);

      console.log("initialize", response);
      if (response.syncState.lastError) {
        setSyncStatus("error");
      } else if (response.syncState.lastSyncAt) {
        setSyncStatus("synced");
      } else if (!response.auth.signedIn) {
        setSyncStatus("offline");
      } else {
        setSyncStatus("pending");
      }
    } catch {
      // Local-first fallback: still load scene/settings data even if full init response fails.
      const [sceneResult, currentResult, settingsResult] = await Promise.allSettled([
        sendShelfMessage<SceneListResponse>({ includeDeleted: true, type: "scene.list" }),
        sendShelfMessage<SceneCurrentResponse>({ type: "scene.current" }),
        sendShelfMessage<SettingsResponse>({ type: "settings.get" }),
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

  const saveCurrentScene = async () => {
    const sceneId = currentSceneId();
    if (!sceneId) {
      return;
    }

    const payload = await captureScenePayloadFromPage();
    const response = await sendShelfMessage<SceneMutationResponse>({
      payload,
      sceneId,
      type: "scene.capture-current",
    });

    setScenes((prev) => upsertScene(prev, response.scene));
  };

  const handleOpenScene = async (sceneId: string, captureBefore = true, force = false) => {
    if (sceneId === currentSceneId() && !force) {
      setPanelOpen(false);
      return;
    }

    setBusy(`open:${sceneId}`);

    try {
      if (captureBefore) {
        await saveCurrentScene();
      }

      const response = await sendShelfMessage<SceneOpenResponse>({ sceneId, type: "scene.open" });
      await applyScenePayloadToPage(response.payload);
      notifySuccess(`Opened ${response.scene.title}`);
      reloadAfterSceneApply();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateScene = async () => {
    setBusy("create");

    try {
      await saveCurrentScene();
      console.log("sendShelfMessage", {
        title: newSceneTitle().trim() || undefined,
        type: "scene.create",
      });
      const created = await sendShelfMessage<SceneMutationResponse>({
        title: newSceneTitle().trim() || undefined,
        type: "scene.create",
      });
      console.log("created", created);

      setScenes((prev) => upsertScene(prev, created.scene));
      setNewSceneTitle("");

      await handleOpenScene(created.scene.id, false);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
      setBusy(null);
    }
  };

  const handleDeleteScene = async (scene: SceneRecord) => {
    const accepted = await confirmSceneDelete(scene.id);
    if (!accepted) {
      return;
    }

    setBusy(`delete:${scene.id}`);

    try {
      const response = await sendShelfMessage<SceneMutationResponse>({
        sceneId: scene.id,
        type: "scene.delete",
      });
      setScenes((prev) => upsertScene(prev, response.scene));

      notifyError(`Moved ${scene.title} to Trash`, "Undo", () => {
        void handleRestoreScene(scene.id);
      });

      if (scene.id === currentSceneId()) {
        const current = await sendShelfMessage<SceneCurrentResponse>({ type: "scene.current" });
        setCurrentSceneId(current.currentSceneId);

        if (current.currentSceneId !== scene.id) {
          await handleOpenScene(current.currentSceneId, false, true);
        }
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreScene = async (sceneId: string) => {
    setBusy(`restore:${sceneId}`);

    try {
      const response = await sendShelfMessage<SceneMutationResponse>({
        sceneId,
        type: "scene.restore",
      });
      setScenes((prev) => upsertScene(prev, response.scene));
      notifySuccess(`Restored ${response.scene.title}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const handlePurgeScene = async (scene: SceneRecord) => {
    const accepted = window.confirm(`Permanently delete "${scene.title}"?`);
    if (!accepted) {
      return;
    }

    setBusy(`purge:${scene.id}`);

    try {
      await sendShelfMessage({ sceneId: scene.id, type: "scene.purge" });
      setScenes((prev) => prev.filter((entry) => entry.id !== scene.id));
      notifySuccess(`Deleted ${scene.title}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleRenameScene = async (scene: SceneRecord) => {
    const title = window.prompt("Rename scene", scene.title)?.trim();
    if (!title || title === scene.title) {
      return;
    }

    setBusy(`rename:${scene.id}`);

    try {
      const response = await sendShelfMessage<SceneMutationResponse>({
        sceneId: scene.id,
        title,
        type: "scene.rename",
      });
      setScenes((prev) => upsertScene(prev, response.scene));
      notifySuccess(`Renamed to ${response.scene.title}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const runSync = async (type: "sync.auto" | "sync.manual") => {
    if (busy() === "sync") {
      return;
    }

    if (type === "sync.manual") {
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
      await saveCurrentScene();
      const response = await sendShelfMessage<SyncResponse>({ type });
      setSyncState(response.syncState);
      updateSyncStatus(response.result.status);

      if (response.result.status === "synced") {
        notifySuccess(response.result.message ?? "Sync complete");
      } else if (response.result.status === "error" || response.result.status === "offline") {
        notifyError(response.result.message ?? "Sync failed");
      }

      await refreshScenes();
    } catch (error) {
      updateSyncStatus("error");
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const updateExtensionSettings = async (patch: Partial<ExtensionSettings>) => {
    setBusy("settings");

    try {
      const response = await sendShelfMessage<SettingsResponse>({ patch, type: "settings.update" });
      setSettings(response.settings);
      notifySuccess("Settings updated");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleSignIn = async () => {
    setBusy("auth");

    try {
      const response = await sendShelfMessage<{ auth: AuthState }>({ type: "auth.signin" });
      setAuth(response.auth);
      console.log("handleSignIn", response);
      setSyncStatus("pending");
      notifySuccess("Google Drive connected");
    } catch (error) {
      notifyError(
        error instanceof Error
          ? `${error.message}. Set WXT_GOOGLE_OAUTH_CLIENT_ID in .env.local if missing.`
          : String(error),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    setBusy("auth");

    try {
      const response = await sendShelfMessage<{ auth: AuthState }>({ type: "auth.signout" });
      setAuth(response.auth);
      console.log("handleSignOut", response);
      setSyncStatus("pending");
      notifySuccess("Google Drive disconnected");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  onMount(() => {
    void initialize().catch((error) => {
      notifyError(error instanceof Error ? error.message : String(error));
      setReady(true);
    });

    const saveTimer = window.setInterval(() => {
      if (!document.hidden) {
        void saveCurrentScene().catch(() => {
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
        void runSync("sync.auto");
      }
    }, AUTO_SYNC_TICK_MS);

    const visibilityHandler = () => {
      if (document.hidden) {
        void saveCurrentScene().catch(() => {
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

  return (
    <>
      <Toaster />

      <div class="style-vega fixed right-[68px] bottom-4 z-[2147483647] flex items-center gap-2">
        <Button
          aria-label={panelOpen() ? "Collapse library" : "Open library"}
          size="icon-lg"
          variant="secondary"
          onClick={() => setPanelOpen((open) => !open)}
        >
          <Show when={panelOpen()}>
            <X class="size-5" />
          </Show>
          <Show when={!panelOpen()}>
            <Library class="size-5" />
          </Show>
        </Button>
      </div>

      <aside
        class="style-vega fixed right-0 top-0 bottom-0 z-[2147483646] h-screen w-[360px] border border-border bg-background p-3 shadow-xl"
        classList={{ "translate-x-[400px] opacity-0": !panelOpen() }}
      >
        <header class="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold">Shelf</h2>
            <p class="text-muted-foreground text-xs">
              Last sync {formatRelativeTime(syncState().lastSyncAt)}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Badge variant={syncBadgeVariant(syncStatus())}>{syncStatus()}</Badge>
          </div>
        </header>

        <Show
          when={ready()}
          fallback={
            <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading shelf...
            </div>
          }
        >
          <Tabs class="flex h-[calc(100%-3.5rem)] flex-col gap-2" defaultValue="scenes">
            <TabsList class="grid w-full grid-cols-3" variant="line">
              <TabsTrigger value="scenes">Scenes</TabsTrigger>
              <TabsTrigger value="trash">Trash</TabsTrigger>
              <TabsTrigger value="settings">Sync</TabsTrigger>
            </TabsList>

            <TabsContent class="flex min-h-0 flex-1 flex-col gap-2" value="scenes">
              <div class="flex gap-2">
                <Input
                  onInput={(event) => setNewSceneTitle(event.currentTarget.value)}
                  placeholder="New scene title"
                  value={newSceneTitle()}
                />
                <Button
                  disabled={Boolean(busy())}
                  onClick={() => void handleCreateScene()}
                  size="icon-sm"
                >
                  <Plus class="size-4" />
                  <span class="sr-only">Create scene</span>
                </Button>
              </div>

              <div class="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                <For
                  each={sceneRows()}
                  fallback={<p class="text-muted-foreground px-1 py-2 text-sm">No scenes yet.</p>}
                >
                  {(scene) => (
                    <div
                      class="flex items-center gap-2 rounded-md border px-2"
                      classList={{
                        "border-primary bg-primary/5": scene.id === currentSceneId(),
                      }}
                    >
                      <button
                        class={`min-w-0 flex-1 text-left ${densityClass()}`}
                        onClick={() => void handleOpenScene(scene.id)}
                        type="button"
                      >
                        <p class="truncate font-medium">{scene.title}</p>
                        <p class="text-muted-foreground text-xs">
                          Updated {formatRelativeTime(scene.updatedAt)}
                        </p>
                      </button>

                      <Button
                        aria-label="Rename scene"
                        disabled={Boolean(busy())}
                        onClick={() => void handleRenameScene(scene)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <PenLine class="size-4" />
                        <span class="sr-only">Rename scene</span>
                      </Button>

                      <Button
                        aria-label="Delete scene"
                        disabled={Boolean(busy())}
                        onClick={() => void handleDeleteScene(scene)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2 class="size-4" />
                        <span class="sr-only">Delete scene</span>
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </TabsContent>

            <TabsContent class="flex min-h-0 flex-1 flex-col gap-2" value="trash">
              <div class="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                <For
                  each={trashRows()}
                  fallback={<p class="text-muted-foreground px-1 py-2 text-sm">Trash is empty.</p>}
                >
                  {(scene) => (
                    <div class="flex items-center gap-2 rounded-md border px-2">
                      <div class={`min-w-0 flex-1 ${densityClass()}`}>
                        <p class="truncate font-medium">{scene.title}</p>
                        <p class="text-muted-foreground text-xs">
                          Deleted {formatRelativeTime(scene.deletedAt)}
                        </p>
                      </div>

                      <Button
                        aria-label="Restore scene"
                        disabled={Boolean(busy())}
                        onClick={() => void handleRestoreScene(scene.id)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <RotateCcw class="size-4" />
                        <span class="sr-only">Restore scene</span>
                      </Button>

                      <Button
                        aria-label="Purge scene"
                        disabled={Boolean(busy())}
                        onClick={() => void handlePurgeScene(scene)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash class="size-4" />
                        <span class="sr-only">Purge scene</span>
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </TabsContent>

            <TabsContent class="space-y-3" value="settings">
              <div class="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border p-2">
                <div>
                  <p class="text-sm font-medium">Auto sync</p>
                  <p class="text-muted-foreground text-xs">Use alarm + live tab checks</p>
                </div>
                <Switch
                  checked={settings().autoSyncEnabled}
                  onChange={(checked) => {
                    void updateExtensionSettings({ autoSyncEnabled: checked });
                  }}
                />
              </div>

              <div class="space-y-1 rounded-md border p-2">
                <label class="text-sm font-medium" for="sync-interval-input">
                  Interval (minutes)
                </label>
                <Input
                  id="sync-interval-input"
                  min="1"
                  onChange={(event) => {
                    const next = Number(event.currentTarget.value);
                    if (!Number.isFinite(next)) {
                      return;
                    }
                    void updateExtensionSettings({ autoSyncIntervalMinutes: next });
                  }}
                  step="1"
                  type="number"
                  value={String(settings().autoSyncIntervalMinutes)}
                />
              </div>

              <div class="grid grid-cols-2 gap-2">
                <Button disabled={Boolean(busy())} onClick={() => void runSync("sync.manual")}>
                  <FolderSync class="size-4" />
                  Sync now
                </Button>

                <Button
                  disabled={Boolean(busy())}
                  onClick={() => {
                    if (auth().signedIn) {
                      void handleSignOut();
                      return;
                    }
                    void handleSignIn();
                  }}
                  variant="outline"
                >
                  <Show when={auth().signedIn} fallback={<LogIn class="size-4" />}>
                    <LogOut class="size-4" />
                  </Show>
                  {auth().signedIn ? "Sign out" : "Sign in"}
                </Button>
              </div>

              <div class="rounded-md border p-2 text-xs text-muted-foreground">
                <p>Sync mode: {settings().syncMode}</p>
                <p>Drive: {auth().signedIn ? "Connected" : "Not connected"}</p>
                <Show when={syncState().lastError}>
                  <p class="mt-1 text-destructive">{syncState().lastError}</p>
                </Show>
              </div>

              <Button
                disabled={Boolean(busy())}
                onClick={() => {
                  void refreshScenes();
                  notifySuccess("Scene list refreshed");
                }}
                variant="ghost"
              >
                <RefreshCw class="size-4" />
                Refresh list
              </Button>
            </TabsContent>
          </Tabs>
        </Show>

        <div class="pointer-events-none absolute bottom-3 right-3 text-xs text-muted-foreground">
          v1
        </div>

        <Show when={busy() === "sync"}>
          <div class="pointer-events-none absolute inset-0 rounded-xl bg-background/30" />
          <div class="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-background px-2 py-1 text-xs shadow">
            <Cloud class="size-3" />
            Syncing...
          </div>
        </Show>
      </aside>
    </>
  );
}

function setupKeyboardShortcutFirewall(host: HTMLElement, shadowRoot: ShadowRoot) {
  const intercept = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const isFromShelf = path.includes(host);
    const isFocusedInShelf = shadowRoot.activeElement !== null;

    if (!isFromShelf && !isFocusedInShelf) {
      return;
    }

    event.stopImmediatePropagation();
    event.stopPropagation();
  };

  window.addEventListener("keydown", intercept, true);
  window.addEventListener("keypress", intercept, true);
  window.addEventListener("keyup", intercept, true);

  return () => {
    window.removeEventListener("keydown", intercept, true);
    window.removeEventListener("keypress", intercept, true);
    window.removeEventListener("keyup", intercept, true);
  };
}

export default defineContentScript({
  matches: ["https://excalidraw.com/*", "https://app.excalidraw.com/*"],
  main() {
    if (document.getElementById("excalidraw-shelf-shadow-host")) {
      return;
    }

    const host = document.createElement("div");
    host.id = "excalidraw-shelf-shadow-host";

    const shadowRoot = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = styleText;
    shadowRoot.append(style);

    const mount = document.createElement("div");
    shadowRoot.append(mount);

    document.documentElement.append(host);
    setupKeyboardShortcutFirewall(host, shadowRoot);
    render(() => <ContentShelfApp />, mount);
  },
});
