import { configureAutoSyncAlarm, setupAutoSyncAlarmListener } from "@/src/background/alarms";
import { handleShelfMessage } from "@/src/background/messages";
import type { ShelfRequest } from "@/src/shared/protocol";

const EXCALIDRAW_URL = "https://excalidraw.com/";
const EXCALIDRAW_MATCHES = ["https://excalidraw.com/*", "https://app.excalidraw.com/*"];

function isShelfRequest(message: unknown): message is ShelfRequest {
  if (!message || typeof message !== "object") {
    return false;
  }

  return typeof (message as { type?: unknown }).type === "string";
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function openOrFocusExcalidraw() {
  const tabs = await browser.tabs.query({ url: EXCALIDRAW_MATCHES });
  const existing = tabs[0];

  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true });

    if (existing.windowId !== undefined) {
      await browser.windows.update(existing.windowId, { focused: true });
    }

    return;
  }

  await browser.tabs.create({ url: EXCALIDRAW_URL });
}

export default defineBackground(() => {
  setupAutoSyncAlarmListener();

  void configureAutoSyncAlarm();

  browser.runtime.onInstalled.addListener(() => {
    void configureAutoSyncAlarm();
  });

  browser.runtime.onStartup.addListener(() => {
    void configureAutoSyncAlarm();
  });

  if (browser.action?.onClicked) {
    browser.action.onClicked.addListener(() => {
      void openOrFocusExcalidraw();
    });
  }

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isShelfRequest(message)) {
      return false;
    }

    handleShelfMessage(message)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        sendResponse({
          error: { message: toErrorMessage(error) },
        });
      });

    return true;
  });
});
