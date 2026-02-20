export type ShelfTheme = "light" | "dark";

const EXCALIDRAW_CONTAINER_SELECTOR = ".excalidraw-container";
const EXCALIDRAW_DARK_CLASS = "theme--dark";

type SetupThemeSyncOptions = {
  host: HTMLElement;
  mount: HTMLElement;
  onThemeChange?: (theme: ShelfTheme) => void;
};

export function detectExcalidrawTheme(): ShelfTheme {
  return document.querySelector(`${EXCALIDRAW_CONTAINER_SELECTOR}.${EXCALIDRAW_DARK_CLASS}`)
    ? "dark"
    : "light";
}

export function applyShelfTheme(host: HTMLElement, mount: HTMLElement, theme: ShelfTheme) {
  const isDark = theme === "dark";
  host.classList.toggle("dark", isDark);
  mount.classList.toggle("dark", isDark);
}

export function setupThemeSync({ host, mount, onThemeChange }: SetupThemeSyncOptions) {
  let currentTheme: ShelfTheme | null = null;
  let observedContainer: HTMLElement | null = null;
  let containerObserver: MutationObserver | null = null;

  const applyCurrentTheme = () => {
    const nextTheme = detectExcalidrawTheme();
    applyShelfTheme(host, mount, nextTheme);

    if (nextTheme !== currentTheme) {
      currentTheme = nextTheme;
      onThemeChange?.(nextTheme);
    }
  };

  const observeContainerThemeClass = () => {
    const nextContainer = document.querySelector<HTMLElement>(EXCALIDRAW_CONTAINER_SELECTOR);
    if (nextContainer === observedContainer) {
      return;
    }

    containerObserver?.disconnect();
    containerObserver = null;
    observedContainer = nextContainer;

    if (!observedContainer) {
      return;
    }

    containerObserver = new MutationObserver(() => {
      applyCurrentTheme();
    });
    containerObserver.observe(observedContainer, {
      attributeFilter: ["class"],
      attributes: true,
    });
  };

  observeContainerThemeClass();
  applyCurrentTheme();

  const domObserver = new MutationObserver(() => {
    observeContainerThemeClass();
    applyCurrentTheme();
  });

  const domTarget = document.body ?? document.documentElement;
  domObserver.observe(domTarget, {
    childList: true,
    subtree: true,
  });

  return () => {
    containerObserver?.disconnect();
    domObserver.disconnect();
  };
}
