import { getSettings } from "@/src/background/settings";
import { runSync } from "@/src/background/sync";

const AUTO_SYNC_ALARM = "excalib:auto-sync";

export async function configureAutoSyncAlarm() {
  const settings = await getSettings();

  await browser.alarms.clear(AUTO_SYNC_ALARM);

  if (!settings.autoSyncEnabled || settings.syncMode !== "auto") {
    return;
  }

  browser.alarms.create(AUTO_SYNC_ALARM, {
    delayInMinutes: settings.autoSyncIntervalMinutes,
    periodInMinutes: settings.autoSyncIntervalMinutes,
  });
}

export function setupAutoSyncAlarmListener() {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== AUTO_SYNC_ALARM) {
      return;
    }

    void runSync("auto");
  });
}
