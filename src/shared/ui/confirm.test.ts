import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetConfirmHandlerForTests,
  confirmConflictOverwrite,
  confirmSceneDelete,
  registerConfirmHandler,
} from "./confirm";

describe("confirm", () => {
  beforeEach(() => {
    __resetConfirmHandlerForTests();
    vi.restoreAllMocks();
  });

  it("falls back to window.confirm when no handler is registered", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { confirm: confirmSpy });

    const accepted = await confirmSceneDelete("scene-1");

    expect(accepted).toBe(true);
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("uses registered handler when present", async () => {
    const unregister = registerConfirmHandler(
      async (request) => request.intent === "conflict-overwrite",
    );

    const accepted = await confirmConflictOverwrite("scene-2");

    expect(accepted).toBe(true);
    unregister();
  });
});
