import { MoreHorizontal } from "lucide-solid";
import { createSignal } from "solid-js";
import { ConfirmDialogHost } from "@/src/components/confirm-dialog-host";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { DEFAULT_SETTINGS, type UiDensity } from "@/src/shared/types";
import {
  notifyError,
  notifySuccess,
  notifySyncStatus,
  type SyncStatus,
} from "@/src/shared/ui/notifications";
import { confirmConflictOverwrite, confirmSceneDelete } from "@/src/shared/ui/confirm";

const intervalOptions = [
  { label: "1 min", value: 1 },
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
];

type UiStackDemoProps = {
  title: string;
};

export function UiStackDemo(props: UiStackDemoProps) {
  const [sceneName, setSceneName] = createSignal("Roadmap");
  const [density, setDensity] = createSignal<UiDensity>(DEFAULT_SETTINGS.uiDensity);
  const [autoSync, setAutoSync] = createSignal(true);
  const [selectedInterval, setSelectedInterval] = createSignal(intervalOptions[1]);
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus>("pending");
  const [sheetOpen, setSheetOpen] = createSignal(false);

  const markSyncStatus = (status: SyncStatus) => {
    setSyncStatus(status);
    notifySyncStatus(status);
  };

  const runDeleteFlow = async () => {
    const accepted = await confirmSceneDelete(sceneName());
    if (!accepted) {
      notifyError("Scene delete canceled");
      return;
    }

    notifySuccess(`Scene "${sceneName()}" moved to Trash`);
  };

  const runConflictFlow = async () => {
    const accepted = await confirmConflictOverwrite(sceneName());
    if (accepted) {
      notifySuccess(`Applied latest cloud version for "${sceneName()}"`);
      markSyncStatus("synced");
      return;
    }

    notifyError("Kept local changes and queued sync");
    markSyncStatus("pending");
  };

  return (
    <main class="style-vega min-w-[360px] space-y-4 p-4">
      <Toaster />
      <ConfirmDialogHost />

      <header class="flex items-center justify-between gap-2">
        <div>
          <h1 class="text-lg font-semibold">{props.title}</h1>
          <p class="text-muted-foreground text-sm">UI stack powered by Zaidan + solid-sonner</p>
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
          {syncStatus()}
        </Badge>
      </header>

      <Tabs class="gap-3" defaultValue="controls">
        <TabsList>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="sidebar">Sidebar</TabsTrigger>
        </TabsList>

        <TabsContent class="space-y-4" value="controls">
          <section class="space-y-2">
            <label class="text-sm font-medium" for="scene-name-input">
              Scene name
            </label>
            <Input
              id="scene-name-input"
              onInput={(event) => setSceneName(event.currentTarget.value)}
              placeholder="Enter scene name"
              value={sceneName()}
            />
          </section>

          <section class="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-3">
            <div>
              <p class="text-sm font-medium">Compact density</p>
              <p class="text-muted-foreground text-xs">Default is comfortable</p>
            </div>
            <Switch
              checked={density() === "compact"}
              onChange={(checked) => setDensity(checked ? "compact" : "comfortable")}
            />
          </section>

          <section class="space-y-2">
            <p class="text-sm font-medium">Auto-sync interval</p>
            <Select
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>{itemProps.item.rawValue.label}</SelectItem>
              )}
              onChange={(next) => {
                if (next) {
                  setSelectedInterval(next);
                }
              }}
              optionTextValue="label"
              optionValue="value"
              options={intervalOptions}
              value={selectedInterval()}
            >
              <SelectTrigger class="w-full">
                <SelectValue>
                  {(state: { selectedOption: () => { label?: string } | undefined }) =>
                    state.selectedOption()?.label ?? "Select interval"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </section>

          <section class="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p class="text-sm font-medium">Auto-sync enabled</p>
              <p class="text-muted-foreground text-xs">Manual mode remains available</p>
            </div>
            <Switch checked={autoSync()} onChange={setAutoSync} />
          </section>

          <section class="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                as={Button}
                onClick={() => markSyncStatus("pending")}
                variant="outline"
              >
                Queue Sync
              </TooltipTrigger>
              <TooltipContent>Marks sync as pending and shows loading toast</TooltipContent>
            </Tooltip>

            <Button onClick={() => markSyncStatus("synced")}>Mark Synced</Button>
            <Button onClick={() => markSyncStatus("offline")} variant="secondary">
              Go Offline
            </Button>
            <Button onClick={() => markSyncStatus("error")} variant="destructive">
              Mark Error
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger as={Button} class="size-9" size="icon" variant="ghost">
                <MoreHorizontal class="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={runDeleteFlow}>Delete Scene</DropdownMenuItem>
                <DropdownMenuItem onSelect={runConflictFlow}>Resolve Conflict</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    notifyError("Sync failed", "Retry", () => {
                      notifySuccess("Retry started");
                      markSyncStatus("pending");
                    })
                  }
                >
                  Show Retry Toast
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </section>
        </TabsContent>

        <TabsContent class="space-y-3" value="sidebar">
          <Sheet onOpenChange={setSheetOpen} open={sheetOpen()}>
            <SheetTrigger as={Button} variant="outline">
              Open Collapsible Sidebar
            </SheetTrigger>
            <SheetContent class="w-[360px]" side="right">
              <SheetHeader>
                <SheetTitle>Scene Manager</SheetTitle>
                <SheetDescription>
                  Ready for the Excalidraw Shelf scene list and sync controls.
                </SheetDescription>
              </SheetHeader>
              <div class="mt-4 space-y-2 text-sm">
                <p>Density: {density()}</p>
                <p>Auto-sync: {autoSync() ? "enabled" : "disabled"}</p>
                <p>Interval: {selectedInterval().label}</p>
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>
      </Tabs>
    </main>
  );
}
