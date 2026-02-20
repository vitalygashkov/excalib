import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupThemeSync } from "./theme-sync";

async function flushMutations() {
  await Promise.resolve();
  await Promise.resolve();
}

function createHostAndMount() {
  const host = document.createElement("div");
  const mount = document.createElement("div");
  document.body.append(host, mount);
  return { host, mount };
}

function createExcalidrawContainer(className = "excalidraw-container") {
  const container = document.createElement("div");
  container.className = className;
  document.body.append(container);
  return container;
}

describe("theme-sync", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.className = "";
  });

  it("initializes light when no Excalidraw container is present", () => {
    const { host, mount } = createHostAndMount();
    const onThemeChange = vi.fn();

    const cleanup = setupThemeSync({ host, mount, onThemeChange });

    expect(host.classList.contains("dark")).toBe(false);
    expect(mount.classList.contains("dark")).toBe(false);
    expect(onThemeChange).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith("light");
    cleanup();
  });

  it("initializes dark when Excalidraw container has theme--dark", () => {
    createExcalidrawContainer("excalidraw-container theme--dark");
    const { host, mount } = createHostAndMount();
    const onThemeChange = vi.fn();

    const cleanup = setupThemeSync({ host, mount, onThemeChange });

    expect(host.classList.contains("dark")).toBe(true);
    expect(mount.classList.contains("dark")).toBe(true);
    expect(onThemeChange).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith("dark");
    cleanup();
  });

  it("switches from light to dark when theme--dark is added", async () => {
    const container = createExcalidrawContainer();
    const { host, mount } = createHostAndMount();
    const onThemeChange = vi.fn();

    const cleanup = setupThemeSync({ host, mount, onThemeChange });

    container.classList.add("theme--dark");
    await flushMutations();

    expect(host.classList.contains("dark")).toBe(true);
    expect(mount.classList.contains("dark")).toBe(true);
    expect(onThemeChange).toHaveBeenCalledTimes(2);
    expect(onThemeChange).toHaveBeenNthCalledWith(1, "light");
    expect(onThemeChange).toHaveBeenNthCalledWith(2, "dark");
    cleanup();
  });

  it("switches from dark to light when theme--dark is removed", async () => {
    const container = createExcalidrawContainer("excalidraw-container theme--dark");
    const { host, mount } = createHostAndMount();
    const onThemeChange = vi.fn();

    const cleanup = setupThemeSync({ host, mount, onThemeChange });

    container.classList.remove("theme--dark");
    await flushMutations();

    expect(host.classList.contains("dark")).toBe(false);
    expect(mount.classList.contains("dark")).toBe(false);
    expect(onThemeChange).toHaveBeenCalledTimes(2);
    expect(onThemeChange).toHaveBeenNthCalledWith(1, "dark");
    expect(onThemeChange).toHaveBeenNthCalledWith(2, "light");
    cleanup();
  });

  it("rebinds observer when Excalidraw container is replaced", async () => {
    const firstContainer = createExcalidrawContainer("excalidraw-container theme--dark");
    const { host, mount } = createHostAndMount();
    const onThemeChange = vi.fn();

    const cleanup = setupThemeSync({ host, mount, onThemeChange });

    firstContainer.remove();
    const secondContainer = createExcalidrawContainer("excalidraw-container");
    await flushMutations();
    secondContainer.classList.add("theme--dark");
    await flushMutations();

    expect(host.classList.contains("dark")).toBe(true);
    expect(mount.classList.contains("dark")).toBe(true);
    expect(onThemeChange).toHaveBeenNthCalledWith(1, "dark");
    expect(onThemeChange).toHaveBeenNthCalledWith(2, "light");
    expect(onThemeChange).toHaveBeenNthCalledWith(3, "dark");
    cleanup();
  });

  it("stops syncing after cleanup", async () => {
    const container = createExcalidrawContainer();
    const { host, mount } = createHostAndMount();
    const onThemeChange = vi.fn();

    const cleanup = setupThemeSync({ host, mount, onThemeChange });
    cleanup();

    container.classList.add("theme--dark");
    await flushMutations();

    expect(host.classList.contains("dark")).toBe(false);
    expect(mount.classList.contains("dark")).toBe(false);
    expect(onThemeChange).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith("light");
  });
});
