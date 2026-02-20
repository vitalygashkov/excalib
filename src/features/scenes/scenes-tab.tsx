import { For, type Accessor, type Setter } from "solid-js";
import { PenLine, Plus, Trash2 } from "lucide-solid";
import { Button, Input, TabsContent } from "@/src/components/ui";
import type { SceneRecord } from "@/src/shared/types";
import { formatRelativeTime } from "@/src/features/shelf/utils";

interface ScenesTabProps {
  busy: Accessor<string | null>;
  currentSceneId: Accessor<string>;
  densityClass: Accessor<string>;
  newSceneTitle: Accessor<string>;
  sceneRows: Accessor<SceneRecord[]>;
  setNewSceneTitle: Setter<string>;
  onCreateScene: () => void;
  onDeleteScene: (scene: SceneRecord) => void;
  onOpenScene: (sceneId: string) => void;
  onRenameScene: (scene: SceneRecord) => void;
}

export function ScenesTab(props: ScenesTabProps) {
  return (
    <TabsContent class="flex min-h-0 flex-1 flex-col gap-2" value="scenes">
      <div class="flex gap-2">
        <Input
          onInput={(event) => props.setNewSceneTitle(event.currentTarget.value)}
          placeholder="New scene title"
          value={props.newSceneTitle()}
        />
        <Button disabled={Boolean(props.busy())} onClick={props.onCreateScene} size="icon-sm">
          <Plus class="size-4" />
          <span class="sr-only">Create scene</span>
        </Button>
      </div>

      <div class="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        <For
          each={props.sceneRows()}
          fallback={<p class="text-muted-foreground px-1 py-2 text-sm">No scenes yet.</p>}
        >
          {(scene) => (
            <div
              class="flex items-center gap-2 rounded-md border px-2"
              classList={{
                "border-primary bg-primary/5": scene.id === props.currentSceneId(),
              }}
            >
              <button
                class={`min-w-0 flex-1 text-left ${props.densityClass()}`}
                onClick={() => props.onOpenScene(scene.id)}
                type="button"
              >
                <p class="truncate font-medium">{scene.title}</p>
                <p class="text-muted-foreground text-xs">
                  Updated {formatRelativeTime(scene.updatedAt)}
                </p>
              </button>

              <Button
                aria-label="Rename scene"
                disabled={Boolean(props.busy())}
                onClick={() => props.onRenameScene(scene)}
                size="icon-sm"
                variant="ghost"
              >
                <PenLine class="size-4" />
                <span class="sr-only">Rename scene</span>
              </Button>

              <Button
                aria-label="Delete scene"
                disabled={Boolean(props.busy())}
                onClick={() => props.onDeleteScene(scene)}
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
  );
}
