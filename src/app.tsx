import { Show, type Accessor } from "solid-js";
import { Cloud, Library, X } from "lucide-solid";
import { Badge, Button, Tabs, TabsList, TabsTrigger, Toaster } from "@/src/components/ui";
import { ScenesTab } from "@/src/features/scenes/scenes-tab";
import { SettingsTab } from "@/src/features/settings/settings-tab";
import { ArchiveTab } from "@/src/features/archive/archive-tab";
import { syncBadgeVariant, formatRelativeTime } from "@/src/features/shelf/utils";
import { useShelfController } from "@/src/features/shelf/use-shelf-controller";

type AppProps = {
  theme: Accessor<"light" | "dark">;
};

export function App(props: AppProps) {
  const controller = useShelfController();

  return (
    <>
      <Toaster theme={props.theme()} />

      <div class="style-vega fixed right-[68px] bottom-4 z-2147483646 flex items-center gap-3">
        <Show when={controller.currentSceneId()}>
          <div
            title="Click to rename scene"
            class="text-foreground text-xl font-medium cursor-pointer"
            onClick={() =>
              void controller.renameScene(
                controller.sceneRows().find((scene) => scene.id === controller.currentSceneId())!,
              )
            }
          >
            {controller.currentSceneName()}
          </div>
        </Show>
        <Button
          aria-label="Open shelf"
          onClick={() => controller.setPanelOpen(true)}
          size="icon-lg"
          variant="secondary"
        >
          <Library class="size-5" />
        </Button>
      </div>

      <aside
        class="style-vega fixed right-0 top-0 bottom-0 z-2147483647 h-screen w-[360px] bg-background text-foreground p-3 shadow-xl"
        classList={{ "translate-x-[400px] opacity-0": !controller.panelOpen() }}
        onKeyDown={controller.stopShortcutPropagation}
        onKeyPress={controller.stopShortcutPropagation}
        onKeyUp={controller.stopShortcutPropagation}
      >
        <header class="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold">Shelf</h2>
            <p class="text-muted-foreground text-xs">
              Last sync {formatRelativeTime(controller.syncState().lastSyncAt)}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Badge variant={syncBadgeVariant(controller.syncStatus())}>
              {controller.syncStatus()}
            </Badge>

            <Button
              aria-label="Close shelf"
              onClick={() => controller.setPanelOpen(false)}
              size="icon-lg"
              variant="ghost"
            >
              <X class="size-5" />
            </Button>
          </div>
        </header>

        <Show
          when={controller.ready()}
          fallback={
            <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading shelf...
            </div>
          }
        >
          <Tabs class="flex h-[calc(100%-3.5rem)] flex-col gap-2" defaultValue="scenes">
            <TabsList class="grid w-full grid-cols-3" variant="line">
              <TabsTrigger value="scenes">Scenes</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <ScenesTab
              busy={controller.busy}
              currentSceneId={controller.currentSceneId}
              densityClass={controller.densityClass}
              newSceneTitle={controller.newSceneTitle}
              onArchiveOtherScenes={() => void controller.archiveOtherScenes()}
              onCreateScene={() => void controller.createScene()}
              onDeleteScene={(scene) => void controller.deleteScene(scene)}
              onOpenScene={(sceneId) => void controller.openScene(sceneId)}
              onRenameScene={(scene) => void controller.renameScene(scene)}
              sceneRows={controller.sceneRows}
              setNewSceneTitle={controller.setNewSceneTitle}
            />

            <ArchiveTab
              busy={controller.busy}
              densityClass={controller.densityClass}
              onClearArchive={() => void controller.clearArchive()}
              onPurgeScene={(scene) => void controller.purgeScene(scene)}
              onRestoreScene={(sceneId) => void controller.restoreScene(sceneId)}
              archiveRows={controller.archiveRows}
            />

            <SettingsTab
              auth={controller.auth}
              busy={controller.busy}
              onRefreshSceneList={controller.refreshSceneList}
              onRunManualSync={controller.runManualSync}
              onSignIn={controller.signIn}
              onSignOut={controller.signOut}
              onUpdateSettings={controller.updateSettings}
              settings={controller.settings}
              syncState={controller.syncState}
              syncStatus={controller.syncStatus}
            />
          </Tabs>
        </Show>

        <div class="pointer-events-none absolute bottom-3 right-3 text-xs text-muted-foreground">
          v1
        </div>

        <Show when={controller.busy() === "sync"}>
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
