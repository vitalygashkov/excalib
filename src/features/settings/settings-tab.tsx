import { Show, type Accessor } from "solid-js";
import { FolderSync, LogIn, LogOut, RefreshCw } from "lucide-solid";
import { Badge, Button, Input, Switch, TabsContent } from "@/src/components/ui";
import type { AuthState, ExtensionSettings, SyncState, SyncStatus } from "@/src/shared/types";
import { notifySuccess } from "@/src/shared/ui/notifications";
import { parsePositiveInteger } from "@/src/features/shelf/utils";

interface SettingsTabProps {
  auth: Accessor<AuthState>;
  busy: Accessor<string | null>;
  settings: Accessor<ExtensionSettings>;
  syncState: Accessor<SyncState>;
  syncStatus: Accessor<SyncStatus>;
  onRefreshSceneList: () => Promise<void>;
  onRunManualSync: () => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateSettings: (patch: Partial<ExtensionSettings>) => Promise<void>;
}

export function SettingsTab(props: SettingsTabProps) {
  return (
    <TabsContent class="space-y-3" value="settings">
      <div class="space-y-3 rounded-md border p-2">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-sm font-medium">Google Drive sync</p>
            <p class="text-muted-foreground text-xs">
              Scenes stay local by default. Connect Drive for cloud sync.
            </p>
          </div>
          <Badge variant={props.auth().signedIn ? "default" : "secondary"}>
            {props.auth().signedIn ? "Connected" : "Local only"}
          </Badge>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Button disabled={Boolean(props.busy())} onClick={() => void props.onRunManualSync()}>
            <FolderSync class="size-4" />
            Sync now
          </Button>

          <Button
            disabled={Boolean(props.busy())}
            onClick={() => {
              if (props.auth().signedIn) {
                void props.onSignOut();
                return;
              }
              void props.onSignIn();
            }}
            variant="outline"
          >
            <Show when={props.auth().signedIn} fallback={<LogIn class="size-4" />}>
              <LogOut class="size-4" />
            </Show>
            {props.auth().signedIn ? "Sign out" : "Sign in"}
          </Button>
        </div>

        <div class="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border p-2">
          <div>
            <p class="text-sm font-medium">Auto sync</p>
            <p class="text-muted-foreground text-xs">Background alarm + active-tab checks</p>
          </div>
          <Switch
            checked={props.settings().autoSyncEnabled}
            onChange={(checked) => {
              void props.onUpdateSettings({ autoSyncEnabled: checked });
            }}
          />
        </div>

        <div class="space-y-1 rounded-md border p-2">
          <p class="text-sm font-medium">Sync mode</p>
          <div class="grid grid-cols-2 gap-2">
            <Button
              disabled={Boolean(props.busy())}
              onClick={() => void props.onUpdateSettings({ syncMode: "manual" })}
              variant={props.settings().syncMode === "manual" ? "default" : "outline"}
            >
              Manual
            </Button>
            <Button
              disabled={Boolean(props.busy())}
              onClick={() => void props.onUpdateSettings({ syncMode: "auto" })}
              variant={props.settings().syncMode === "auto" ? "default" : "outline"}
            >
              Auto
            </Button>
          </div>
        </div>

        <div class="space-y-1 rounded-md border p-2">
          <label class="text-sm font-medium" for="sync-interval-input">
            Auto-sync interval (minutes)
          </label>
          <Input
            id="sync-interval-input"
            min="1"
            onChange={(event) => {
              const next = parsePositiveInteger(event.currentTarget.value);
              if (next === null) {
                return;
              }

              void props.onUpdateSettings({ autoSyncIntervalMinutes: next });
            }}
            step="1"
            type="number"
            value={String(props.settings().autoSyncIntervalMinutes)}
          />
        </div>
      </div>

      <div class="space-y-3 rounded-md border p-2">
        <p class="text-sm font-medium">Library settings</p>

        <div class="space-y-1 rounded-md border p-2">
          <p class="text-sm font-medium">Scene row density</p>
          <div class="grid grid-cols-2 gap-2">
            <Button
              disabled={Boolean(props.busy())}
              onClick={() => void props.onUpdateSettings({ uiDensity: "comfortable" })}
              variant={props.settings().uiDensity === "comfortable" ? "default" : "outline"}
            >
              Comfortable
            </Button>
            <Button
              disabled={Boolean(props.busy())}
              onClick={() => void props.onUpdateSettings({ uiDensity: "compact" })}
              variant={props.settings().uiDensity === "compact" ? "default" : "outline"}
            >
              Compact
            </Button>
          </div>
        </div>

        <div class="space-y-1 rounded-md border p-2">
          <label class="text-sm font-medium" for="archive-retention-input">
            Archive retention (days)
          </label>
          <Input
            id="archive-retention-input"
            min="1"
            onChange={(event) => {
              const next = parsePositiveInteger(event.currentTarget.value);
              if (next === null) {
                return;
              }

              void props.onUpdateSettings({ archiveRetentionDays: next });
            }}
            step="1"
            type="number"
            value={String(props.settings().archiveRetentionDays)}
          />
        </div>

        <div class="space-y-1 rounded-md border p-2">
          <label class="text-sm font-medium" for="backup-retention-input">
            Conflict backups to keep
          </label>
          <Input
            id="backup-retention-input"
            min="1"
            onChange={(event) => {
              const next = parsePositiveInteger(event.currentTarget.value);
              if (next === null) {
                return;
              }

              void props.onUpdateSettings({ backupRetention: next });
            }}
            step="1"
            type="number"
            value={String(props.settings().backupRetention)}
          />
        </div>
      </div>

      <div class="rounded-md border p-2 text-xs text-muted-foreground">
        <p>Sync status: {props.syncStatus()}</p>
        <p>Drive: {props.auth().signedIn ? "Connected" : "Local only"}</p>
        <Show when={props.syncState().lastError}>
          <p class="mt-1 text-destructive">{props.syncState().lastError}</p>
        </Show>
      </div>

      <Button
        disabled={Boolean(props.busy())}
        onClick={() => {
          void props.onRefreshSceneList();
          notifySuccess("Scene list refreshed");
        }}
        variant="ghost"
      >
        <RefreshCw class="size-4" />
        Refresh list
      </Button>
    </TabsContent>
  );
}
