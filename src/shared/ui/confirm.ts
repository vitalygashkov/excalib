export type ConfirmIntent = "scene-delete" | "conflict-overwrite";

export interface ConfirmRequest {
  intent: ConfirmIntent;
  sceneId: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
}

export type ConfirmHandler = (request: ConfirmRequest) => Promise<boolean>;

let currentHandler: ConfirmHandler | null = null;

export function registerConfirmHandler(handler: ConfirmHandler) {
  currentHandler = handler;

  return () => {
    if (currentHandler === handler) {
      currentHandler = null;
    }
  };
}

async function requestConfirmation(request: ConfirmRequest) {
  if (currentHandler) {
    return currentHandler(request);
  }

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(`${request.title}\n\n${request.description}`);
  }

  return false;
}

export function confirmSceneDelete(sceneId: string) {
  return requestConfirmation({
    intent: "scene-delete",
    sceneId,
    title: "Delete scene?",
    description: "This scene will move to Trash and can be restored within 30 days.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    destructive: true,
  });
}

export function confirmConflictOverwrite(sceneId: string) {
  return requestConfirmation({
    intent: "conflict-overwrite",
    sceneId,
    title: "Overwrite with latest synced version?",
    description: "A local backup will be kept before overwrite.",
    confirmLabel: "Overwrite",
    cancelLabel: "Keep local",
    destructive: false,
  });
}

export function __resetConfirmHandlerForTests() {
  currentHandler = null;
}
