export function setupKeyboardShortcutFirewall(host: HTMLElement, shadowRoot: ShadowRoot) {
  const intercept = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const isFromShelf = path.includes(host);
    const isFocusedInShelf = shadowRoot.activeElement !== null;

    if (!isFromShelf && !isFocusedInShelf) {
      return;
    }

    event.stopImmediatePropagation();
    event.stopPropagation();
  };

  window.addEventListener("keydown", intercept, true);
  window.addEventListener("keypress", intercept, true);
  window.addEventListener("keyup", intercept, true);

  return () => {
    window.removeEventListener("keydown", intercept, true);
    window.removeEventListener("keypress", intercept, true);
    window.removeEventListener("keyup", intercept, true);
  };
}
