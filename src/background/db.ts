import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SceneBackup, ScenePayload, SceneRecord } from "@/src/shared/types";

interface ShelfDbSchema extends DBSchema {
  backups: {
    indexes: {
      "by-createdAt": number;
      "by-sceneId": string;
    };
    key: string;
    value: SceneBackup;
  };
  meta: {
    key: string;
    value: unknown;
  };
  payloads: {
    key: string;
    value: ScenePayload;
  };
  scenes: {
    indexes: {
      "by-deletedAt": number;
      "by-updatedAt": number;
    };
    key: string;
    value: SceneRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<ShelfDbSchema>> | null = null;

export function getShelfDb() {
  if (!dbPromise) {
    dbPromise = openDB<ShelfDbSchema>("excalidraw-shelf-db", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("scenes")) {
          const sceneStore = db.createObjectStore("scenes", { keyPath: "id" });
          sceneStore.createIndex("by-updatedAt", "updatedAt");
          sceneStore.createIndex("by-deletedAt", "deletedAt");
        }

        if (!db.objectStoreNames.contains("payloads")) {
          db.createObjectStore("payloads");
        }

        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }

        if (!db.objectStoreNames.contains("backups")) {
          const backupStore = db.createObjectStore("backups", { keyPath: "id" });
          backupStore.createIndex("by-sceneId", "sceneId");
          backupStore.createIndex("by-createdAt", "createdAt");
        }
      },
    });
  }

  return dbPromise;
}
