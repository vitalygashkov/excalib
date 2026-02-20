import { render } from "solid-js/web";

import styleText from "@/src/styles.css?inline";
import { App } from "@/src/app";
import { setupKeyboardShortcutFirewall } from "@/src/lib/keyboard-firewall";

export default defineContentScript({
  matches: ["https://excalidraw.com/*", "https://app.excalidraw.com/*"],
  main() {
    if (document.getElementById("excalidraw-shelf-shadow-host")) {
      return;
    }

    const host = document.createElement("div");
    host.id = "excalidraw-shelf-shadow-host";

    const shadowRoot = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = styleText;
    shadowRoot.append(style);

    const mount = document.createElement("div");
    shadowRoot.append(mount);

    document.documentElement.append(host);
    setupKeyboardShortcutFirewall(host, shadowRoot);

    render(() => <App />, mount);
  },
});
