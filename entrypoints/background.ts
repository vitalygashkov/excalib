import { configureAutoSyncAlarm, setupAutoSyncAlarmListener } from "@/src/background/alarms";
import { handleShelfMessage } from "@/src/background/messages";
import type { ShelfRequest } from "@/src/shared/protocol";

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

export default defineBackground(() => {
  setupAutoSyncAlarmListener();

  void configureAutoSyncAlarm();

  browser.runtime.onInstalled.addListener(() => {
    void configureAutoSyncAlarm();
  });

  browser.runtime.onStartup.addListener(() => {
    void configureAutoSyncAlarm();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("onMessage", message);
    if (!isShelfRequest(message)) {
      return false;
    }

    handleShelfMessage(message)
      .then((response) => {
        console.log("sendResponse", response);
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
