import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastApi } = vi.hoisted(() => ({
  toastApi: {
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("solid-sonner", () => ({
  toast: toastApi,
}));

import {
  __resetNotificationsForTests,
  notifyError,
  notifySyncStatus,
  notifySuccess,
} from "./notifications";

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetNotificationsForTests();
  });

  it("sends success toasts", () => {
    notifySuccess("Done");
    expect(toastApi.success).toHaveBeenCalledWith("Done");
  });

  it("sends error toasts with retry action", () => {
    const retry = vi.fn();
    notifyError("Failed", "Retry", retry);

    expect(toastApi.error).toHaveBeenCalledWith(
      "Failed",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Retry",
          onClick: retry,
        }),
      }),
    );
  });

  it("dedupes repeated sync status notifications", () => {
    notifySyncStatus("pending");
    notifySyncStatus("pending");

    expect(toastApi.loading).toHaveBeenCalledTimes(1);
  });
});
