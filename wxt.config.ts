import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

const oauthClientId = process.env.WXT_GOOGLE_OAUTH_CLIENT_ID;

export default defineConfig({
  modules: ["@wxt-dev/module-solid"],
  manifest: {
    name: "Excalidraw Shelf",
    description: "Manage multiple Excalidraw scenes and sync with Google Drive.",
    action: {
      default_title: "Excalidraw Shelf",
    },
    permissions: ["storage", "identity", "alarms"],
    host_permissions: [
      "https://excalidraw.com/*",
      "https://app.excalidraw.com/*",
      "https://www.googleapis.com/*",
      "https://oauth2.googleapis.com/*",
    ],
    oauth2: oauthClientId
      ? {
          client_id: oauthClientId,
          scopes: ["https://www.googleapis.com/auth/drive.file"],
        }
      : undefined,
  },
  vite: () => ({
    plugins: [tailwindcss()],
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts"],
    },
  }),
});
