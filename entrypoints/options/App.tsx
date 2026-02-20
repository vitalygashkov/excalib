import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Cloud, CloudAlert, CloudCheck, FolderSync, Info, Settings2 } from "lucide-solid";
import { ConfirmDialogHost } from "@/src/components/confirm-dialog-host";
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui";
import {
  initShelf,
  runShelfSync,
  signInShelf,
  signOutShelf,
  updateShelfSettings,
} from "@/src/shared/client";
import {
  DEFAULT_SETTINGS,
  type SceneRecord,
  type SyncStatus,
  type UiDensity,
} from "@/src/shared/types";
import { confirmConflictOverwrite } from "@/src/shared/ui/confirm";
import { notifyError, notifySuccess, notifySyncStatus } from "@/src/shared/ui/notifications";

const syncModeOptions = [
  { label: "Automatic", value: "auto" as const },
  { label: "Manual", value: "manual" as const },
];

const densityOptions = [
  { label: "Comfortable", value: "comfortable" as UiDensity },
  { label: "Compact", value: "compact" as UiDensity },
];

function sortScenes(scenes: SceneRecord[]) {
  return [...scenes].sort((a, b) => b.updatedAt - a.updatedAt);
}

function statusFromState(lastError: string | null, lastSyncAt: number | null): SyncStatus {
  if (lastError) {
    return "error";
  }

  if (lastSyncAt) {
    return "synced";
  }

  return "pending";
}

function iconForSyncStatus(status: SyncStatus) {
  if (status === "synced") {
    return <CloudCheck class="size-4" />;
  }

  if (status === "error") {
    return <CloudAlert class="size-4" />;
  }

  return <Cloud class="size-4" />;
}

function App() {
  const [ready, setReady] = createSignal(false);
  const [busy, setBusy] = createSignal<string | null>(null);
  const [settings, setSettings] = createSignal(DEFAULT_SETTINGS);
  const [authSignedIn, setAuthSignedIn] = createSignal(false);
  const [currentSceneId, setCurrentSceneId] = createSignal("");
  const [scenes, setScenes] = createSignal<SceneRecord[]>([]);
  const [lastError, setLastError] = createSignal<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = createSignal<number | null>(null);

  const syncStatus = createMemo(() => statusFromState(lastError(), lastSyncAt()));
  const dirtyCurrentScene = createMemo(
    () => scenes().find((scene) => scene.id === currentSceneId()) ?? null,
  );

  const loadState = async () => {
    const init = await initShelf();

    setSettings(init.settings);
    setAuthSignedIn(init.auth.signedIn);
    setCurrentSceneId(init.currentSceneId);
    setScenes(sortScenes(init.scenes));
    setLastError(init.syncState.lastError);
    setLastSyncAt(init.syncState.lastSyncAt);

    setReady(true);
  };

  const patchSettings = async (patch: Partial<typeof DEFAULT_SETTINGS>) => {
    setBusy("settings");
    try {
      const response = await updateShelfSettings(patch);
      setSettings(response.settings);
      notifySuccess("Settings saved");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    const active = dirtyCurrentScene();
    if (active?.dirty) {
      const accepted = await confirmConflictOverwrite(active.id);
      if (!accepted) {
        return;
      }
    }

    setBusy("sync");

    try {
      const response = await runShelfSync("manual");
      setLastError(response.syncState.lastError);
      setLastSyncAt(response.syncState.lastSyncAt);

      const status = response.result.status;
      notifySyncStatus(status);

      if (status === "synced") {
        notifySuccess(response.result.message ?? "Sync complete");
      } else {
        notifyError(response.result.message ?? "Sync failed");
      }

      await loadState();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const connectDrive = async () => {
    setBusy("auth");
    try {
      const response = await signInShelf();
      setAuthSignedIn(response.auth.signedIn);
      notifySuccess("Google Drive connected");
    } catch (error) {
      notifyError(
        error instanceof Error
          ? `${error.message}. Configure WXT_GOOGLE_OAUTH_CLIENT_ID before signing in.`
          : String(error),
      );
    } finally {
      setBusy(null);
    }
  };

  const disconnectDrive = async () => {
    setBusy("auth");
    try {
      const response = await signOutShelf();
      setAuthSignedIn(response.auth.signedIn);
      notifySuccess("Google Drive disconnected");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  onMount(() => {
    void loadState().catch((error) => {
      notifyError(error instanceof Error ? error.message : String(error));
    });
  });

  return (
    <main class="style-vega min-h-screen bg-background p-5 text-foreground">
      <Toaster />
      <ConfirmDialogHost />

      <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold">Excalidraw Shelf Settings</h1>
            <p class="text-muted-foreground text-sm">
              Control scene sync, retention policy, and sidebar density.
            </p>
          </div>
          <Badge
            variant={
              syncStatus() === "error"
                ? "destructive"
                : syncStatus() === "synced"
                  ? "default"
                  : "secondary"
            }
          >
            <span class="mr-1 inline-flex">{iconForSyncStatus(syncStatus())}</span>
            {syncStatus()}
          </Badge>
        </header>

        <Show
          when={ready()}
          fallback={<p class="text-muted-foreground">Loading extension state...</p>}
        >
          <Tabs class="gap-4" defaultValue="sync">
            <TabsList>
              <TabsTrigger value="sync">Sync</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
              <TabsTrigger value="scenes">Scenes</TabsTrigger>
            </TabsList>

            <TabsContent class="space-y-4" value="sync">
              <section class="rounded-xl border p-4">
                <div class="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p class="font-medium">Google Drive</p>
                    <p class="text-muted-foreground text-sm">Auth is required for cloud sync.</p>
                  </div>
                  <Badge variant={authSignedIn() ? "default" : "secondary"}>
                    {authSignedIn() ? "Connected" : "Disconnected"}
                  </Badge>
                </div>

                <div class="flex flex-wrap gap-2">
                  <Button disabled={Boolean(busy())} onClick={() => void syncNow()}>
                    <FolderSync class="size-4" />
                    Sync now
                  </Button>
                  <Button
                    disabled={Boolean(busy())}
                    onClick={() => {
                      if (authSignedIn()) {
                        void disconnectDrive();
                        return;
                      }
                      void connectDrive();
                    }}
                    variant="outline"
                  >
                    {authSignedIn() ? "Disconnect Drive" : "Connect Drive"}
                  </Button>
                </div>

                <Show when={lastError()}>
                  <p class="mt-3 text-sm text-destructive">{lastError()}</p>
                </Show>
              </section>

              <section class="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <p class="text-sm font-medium">Sync mode</p>
                  <Select
                    itemComponent={(itemProps) => (
                      <SelectItem item={itemProps.item}>{itemProps.item.rawValue.label}</SelectItem>
                    )}
                    onChange={(next) => {
                      if (next) {
                        void patchSettings({ syncMode: next.value });
                      }
                    }}
                    optionTextValue="label"
                    optionValue="value"
                    options={syncModeOptions}
                    value={
                      syncModeOptions.find((option) => option.value === settings().syncMode) ??
                      syncModeOptions[0]
                    }
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue>
                        {(state: { selectedOption: () => { label?: string } | undefined }) =>
                          state.selectedOption()?.label ?? "Select mode"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>

                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <p class="text-sm font-medium">Auto sync enabled</p>
                    <Switch
                      checked={settings().autoSyncEnabled}
                      onChange={(checked) => {
                        void patchSettings({ autoSyncEnabled: checked });
                      }}
                    />
                  </div>

                  <label class="text-sm" for="interval-input">
                    Auto-sync interval (minutes)
                  </label>
                  <Input
                    id="interval-input"
                    min="1"
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (Number.isFinite(value)) {
                        void patchSettings({ autoSyncIntervalMinutes: value });
                      }
                    }}
                    step="1"
                    type="number"
                    value={String(settings().autoSyncIntervalMinutes)}
                  />
                </div>
              </section>
            </TabsContent>

            <TabsContent class="space-y-4" value="storage">
              <section class="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <p class="text-sm font-medium">Sidebar density</p>
                  <Select
                    itemComponent={(itemProps) => (
                      <SelectItem item={itemProps.item}>{itemProps.item.rawValue.label}</SelectItem>
                    )}
                    onChange={(next) => {
                      if (next) {
                        void patchSettings({ uiDensity: next.value });
                      }
                    }}
                    optionTextValue="label"
                    optionValue="value"
                    options={densityOptions}
                    value={
                      densityOptions.find((option) => option.value === settings().uiDensity) ??
                      densityOptions[0]
                    }
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue>
                        {(state: { selectedOption: () => { label?: string } | undefined }) =>
                          state.selectedOption()?.label ?? "Select density"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>

                <div class="space-y-2">
                  <label class="text-sm" for="retention-input">
                    Trash retention (days)
                  </label>
                  <Input
                    id="retention-input"
                    min="1"
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (Number.isFinite(value)) {
                        void patchSettings({ trashRetentionDays: value });
                      }
                    }}
                    type="number"
                    value={String(settings().trashRetentionDays)}
                  />

                  <label class="text-sm" for="backup-input">
                    Conflict backups to keep
                  </label>
                  <Input
                    id="backup-input"
                    min="1"
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (Number.isFinite(value)) {
                        void patchSettings({ backupRetention: value });
                      }
                    }}
                    type="number"
                    value={String(settings().backupRetention)}
                  />
                </div>
              </section>

              <Sheet>
                <SheetTrigger as={Button} variant="outline">
                  <Info class="size-4" />
                  View integration notes
                </SheetTrigger>
                <SheetContent class="w-[420px]" side="right">
                  <SheetHeader>
                    <SheetTitle>Google OAuth setup</SheetTitle>
                    <SheetDescription>
                      Add `WXT_GOOGLE_OAUTH_CLIENT_ID` in `.env.local`, then reload the extension.
                    </SheetDescription>
                  </SheetHeader>

                  <div class="mt-4 space-y-2 text-sm">
                    <p>
                      1. Create OAuth client in Google Cloud Console (Chrome extension app type).
                    </p>
                    <p>2. Grant Drive API and scope `drive.file`.</p>
                    <p>3. Set the env var and rebuild with `pnpm dev` or `pnpm build`.</p>
                  </div>
                </SheetContent>
              </Sheet>
            </TabsContent>

            <TabsContent class="space-y-4" value="scenes">
              <section class="rounded-xl border p-4">
                <div class="mb-3 flex items-center justify-between">
                  <p class="font-medium">Tracked scenes</p>
                  <Tooltip>
                    <TooltipTrigger as={Button} size="icon-sm" variant="ghost">
                      <Settings2 class="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>Scene titles sync from the content sidebar.</TooltipContent>
                  </Tooltip>
                </div>

                <div class="space-y-1">
                  <For
                    each={scenes()
                      .filter((scene) => scene.deletedAt === null)
                      .slice(0, 12)}
                  >
                    {(scene) => (
                      <div class="flex items-center justify-between rounded-md border px-2 py-2 text-sm">
                        <span class="truncate">{scene.title}</span>
                        <Badge variant={scene.id === currentSceneId() ? "default" : "secondary"}>
                          {scene.id === currentSceneId() ? "Current" : "Saved"}
                        </Badge>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </Show>
      </div>
    </main>
  );
}

export default App;
