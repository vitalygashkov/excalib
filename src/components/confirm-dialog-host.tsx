import { createSignal, onCleanup } from "solid-js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui";
import { registerConfirmHandler, type ConfirmRequest } from "@/src/shared/ui/confirm";

type PendingConfirm = {
  request: ConfirmRequest;
  resolve: (accepted: boolean) => void;
};

export function ConfirmDialogHost() {
  const [pending, setPending] = createSignal<PendingConfirm | null>(null);

  const unregister = registerConfirmHandler(
    (request) =>
      new Promise<boolean>((resolve) => {
        setPending({ request, resolve });
      }),
  );

  onCleanup(() => {
    const active = pending();
    if (active) {
      active.resolve(false);
      setPending(null);
    }
    unregister();
  });

  const close = (accepted: boolean) => {
    const active = pending();
    if (!active) {
      return;
    }

    active.resolve(accepted);
    setPending(null);
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          close(false);
        }
      }}
      open={Boolean(pending())}
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{pending()?.request.title}</DialogTitle>
          <DialogDescription>{pending()?.request.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={() => close(false)} variant="outline">
            {pending()?.request.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            onClick={() => close(true)}
            variant={pending()?.request.destructive ? "destructive" : "default"}
          >
            {pending()?.request.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
