import { For, type Accessor } from "solid-js";
import { RotateCcw, Trash } from "lucide-solid";
import { Button, TabsContent } from "@/src/components/ui";
import type { SceneRecord } from "@/src/shared/types";
import { formatRelativeTime } from "@/src/features/shelf/utils";

interface ArchiveTabProps {
  busy: Accessor<string | null>;
  densityClass: Accessor<string>;
  archiveRows: Accessor<SceneRecord[]>;
  onClearArchive: () => void;
  onPurgeScene: (scene: SceneRecord) => void;
  onRestoreScene: (sceneId: string) => void;
}

export function ArchiveTab(props: ArchiveTabProps) {
  return (
    <TabsContent class="flex min-h-0 flex-1 flex-col gap-2" value="archive">
      <div class="flex justify-end">
        <Button
          disabled={Boolean(props.busy()) || props.archiveRows().length === 0}
          onClick={props.onClearArchive}
          size="sm"
          variant="destructive"
        >
          Clear archive
        </Button>
      </div>

      <div class="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        <For
          each={props.archiveRows()}
          fallback={<p class="text-muted-foreground px-1 py-2 text-sm">Archive is empty.</p>}
        >
          {(scene) => (
            <div class="flex items-center gap-2 rounded-md border px-2">
              <div class={`min-w-0 flex-1 ${props.densityClass()}`}>
                <p class="truncate font-medium">{scene.title}</p>
                <p class="text-muted-foreground text-xs">
                  Deleted {formatRelativeTime(scene.deletedAt)}
                </p>
              </div>

              <Button
                aria-label="Restore scene"
                disabled={Boolean(props.busy())}
                onClick={() => props.onRestoreScene(scene.id)}
                size="icon-sm"
                variant="ghost"
              >
                <RotateCcw class="size-4" />
                <span class="sr-only">Restore scene</span>
              </Button>

              <Button
                aria-label="Purge scene"
                disabled={Boolean(props.busy())}
                onClick={() => props.onPurgeScene(scene)}
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
  );
}
