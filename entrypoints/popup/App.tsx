import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { ExternalLink, FolderSync, MoreHorizontal, User } from "lucide-solid";
import { ConfirmDialogHost } from "@/src/components/confirm-dialog-host";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Switch,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui";
import { initShelf, runShelfSync, signInShelf, signOutShelf, updateShelfSettings } from "@/src/shared/client";
import type { SceneRecord, SyncStatus } from "@/src/shared/types";
import { confirmConflictOverwrite } from "@/src/shared/ui/confirm";
import { notifyError, notifySuccess, notifySyncStatus } from "@/src/shared/ui/notifications";

function deriveStatus(lastError: string | null, lastSyncAt: number | null): SyncStatus {
  if (lastError) {
    return "error";
  }

  if (lastSyncAt) {
    return "synced";
  }

  return "pending";
}

function sortScenes(scenes: SceneRecord[]) {
  return [...scenes].sort((a, b) => b.updatedAt - a.updatedAt);
}

function formatShortTime(timestamp: number | null) {
  if (!timestamp) {
    return "never";
  }

  return new Date(timestamp).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

async function focusExcalidrawTab() {
  const tabs = await browser.tabs.query({
    url: ["https://excalidraw.com/*", "https://app.excalidraw.com/*"],
  });

  const existing = tabs[0];
  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true });
    if (existing.windowId) {
      await browser.windows.update(existing.windowId, { focused: true });
    }
    return;
  }

  await browser.tabs.create({ url: "https://excalidraw.com" });
}

function App() {
  const [busy, setBusy] = createSignal<string | null>(null);
  const [ready, setReady] = createSignal(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = createSignal(false);
  const [authSignedIn, setAuthSignedIn] = createSignal(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = createSignal(true);
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus>("pending");
  const [lastSyncAt, setLastSyncAt] = createSignal<number | null>(null);
  const [currentSceneId, setCurrentSceneId] = createSignal("");
  const [scenes, setScenes] = createSignal<SceneRecord[]>([]);

  const visibleScenes = createMemo(() => scenes().filter((scene) => scene.deletedAt === null).slice(0, 6));
  const currentScene = createMemo(() => scenes().find((scene) => scene.id === currentSceneId()) ?? null);

  const refresh = async () => {
    const init = await initShelf();
    setAuthSignedIn(init.auth.signedIn);
    setAutoSyncEnabled(init.settings.autoSyncEnabled);
    setSyncStatus(deriveStatus(init.syncState.lastError, init.syncState.lastSyncAt));
    setLastSyncAt(init.syncState.lastSyncAt);
    setCurrentSceneId(init.currentSceneId);
    setScenes(sortScenes(init.scenes));
    setReady(true);
  };

  const runSyncNow = async () => {
    const active = currentScene();
    if (active?.dirty) {
      const accepted = await confirmConflictOverwrite(active.id);
      if (!accepted) {
        return;
      }
    }

    setBusy("sync");

    try {
      const response = await runShelfSync("manual");
      setSyncStatus(response.result.status);
      setLastSyncAt(response.syncState.lastSyncAt);
      notifySyncStatus(response.result.status);

      if (response.result.status === "synced") {
        notifySuccess("Sync complete");
      } else {
        notifyError(response.result.message ?? "Sync failed");
      }

      await refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const toggleAutoSync = async (checked: boolean) => {
    setBusy("settings");

    try {
      const response = await updateShelfSettings({ autoSyncEnabled: checked });
      setAutoSyncEnabled(response.settings.autoSyncEnabled);
      notifySuccess(`Auto sync ${response.settings.autoSyncEnabled ? "enabled" : "disabled"}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("auth");

    try {
      const response = await signInShelf();
      setAuthSignedIn(response.auth.signedIn);
      notifySuccess("Google Drive connected");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("auth");

    try {
      const response = await signOutShelf();
      setAuthSignedIn(response.auth.signedIn);
      notifySuccess("Google Drive disconnected");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
      setConfirmSignOutOpen(false);
    }
  };

  onMount(() => {
    void refresh().catch((error) => {
      notifyError(error instanceof Error ? error.message : String(error));
    });
  });

  return (
    <main class="style-vega w-[380px] bg-background p-3 text-foreground">
      <Toaster />
      <ConfirmDialogHost />

      <Dialog onOpenChange={setConfirmSignOutOpen} open={confirmSignOutOpen()}>
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect Google Drive?</DialogTitle>
            <DialogDescription>
              Existing synced files stay in Drive, but sync will stop until you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmSignOutOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={() => void disconnect()} variant="destructive">
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 class="font-semibold">Excalidraw Shelf</h1>
          <p class="text-muted-foreground text-xs">Last sync: {formatShortTime(lastSyncAt())}</p>
        </div>

        <div class="flex items-center gap-1">
          <Badge variant={syncStatus() === "error" ? "destructive" : syncStatus() === "synced" ? "default" : "secondary"}>
            {syncStatus()}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger as={Button} class="" size="icon-sm" variant="ghost">
              <MoreHorizontal class="size-4" />
              <span class="sr-only">More actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void browser.runtime.openOptionsPage()}>
                Open settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void focusExcalidrawTab()}>
                Open Excalidraw
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <Show when={authSignedIn()} fallback={<DropdownMenuItem onSelect={() => void connect()}>Connect Drive</DropdownMenuItem>}>
                <DropdownMenuItem onSelect={() => setConfirmSignOutOpen(true)}>Disconnect Drive</DropdownMenuItem>
              </Show>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Show when={ready()} fallback={<p class="text-muted-foreground text-sm">Loading...</p>}>
        <section class="mb-3 grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-2">
          <div>
            <p class="text-sm font-medium">Google Drive</p>
            <p class="text-muted-foreground text-xs">{authSignedIn() ? "Connected" : "Not connected"}</p>
          </div>

          <Show when={authSignedIn()} fallback={<Button onClick={() => void connect()} size="sm"><User class="size-4" />Connect</Button>}>
            <Button onClick={() => setConfirmSignOutOpen(true)} size="sm" variant="outline">
              Disconnect
            </Button>
          </Show>
        </section>

        <section class="mb-3 grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-2">
          <div>
            <p class="text-sm font-medium">Auto sync</p>
            <p class="text-muted-foreground text-xs">Background alarm + active tab tick</p>
          </div>
          <Switch checked={autoSyncEnabled()} onChange={(checked) => void toggleAutoSync(checked)} />
        </section>

        <section class="mb-3 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger as={Button} disabled={Boolean(busy())} onClick={() => void runSyncNow()}>
              <FolderSync class="size-4" />
              Sync now
            </TooltipTrigger>
            <TooltipContent>Runs immediate sync with Google Drive.</TooltipContent>
          </Tooltip>

          <Button disabled={Boolean(busy())} onClick={() => void focusExcalidrawTab()} variant="outline">
            <ExternalLink class="size-4" />
            Open Excalidraw
          </Button>
        </section>

        <section class="space-y-1">
          <p class="text-sm font-medium">Recent scenes</p>
          <For each={visibleScenes()} fallback={<p class="text-muted-foreground text-xs">No scenes captured yet.</p>}>
            {(scene) => (
              <div class="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                <span class="max-w-[200px] truncate">{scene.title}</span>
                <Badge variant={scene.id === currentSceneId() ? "default" : "secondary"}>
                  {scene.id === currentSceneId() ? "Current" : "Saved"}
                </Badge>
              </div>
            )}
          </For>
        </section>
      </Show>
    </main>
  );
}

export default App;
