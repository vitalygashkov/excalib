import { EXCALIDRAW_KEYS, type ExcalidrawFileData, type ScenePayload } from "@/src/shared/types";

const FILES_DB_NAME = "files-db";
const FILES_STORE_CANDIDATES = ["files-store", "files", "binaryFiles"];

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function setJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function openDb(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const request = window.indexedDB.open(name);

    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      // Content scripts must never mutate Excalidraw schema during open.
      request.transaction?.abort();
      resolve(null);
    };
  });
}

function pickStore(db: IDBDatabase) {
  for (const candidate of FILES_STORE_CANDIDATES) {
    if (db.objectStoreNames.contains(candidate)) {
      return candidate;
    }
  }

  return db.objectStoreNames.length > 0 ? db.objectStoreNames[0] : null;
}

async function readAllFilesFromStore(store: IDBObjectStore) {
  return new Promise<Record<string, ExcalidrawFileData>>((resolve, reject) => {
    const files: Record<string, ExcalidrawFileData> = {};
    const request = store.openCursor();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(files);
        return;
      }

      const file = cursor.value as ExcalidrawFileData;
      const id = typeof file?.id === "string" ? file.id : String(cursor.key);
      if (id) {
        files[id] = file;
      }

      cursor.continue();
    };
  });
}

export async function readFilesDbSnapshot() {
  const db = await openDb(FILES_DB_NAME);
  if (!db) {
    return {};
  }

  const storeName = pickStore(db);
  if (!storeName) {
    db.close();
    return {};
  }

  try {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const snapshot = await readAllFilesFromStore(store);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    return snapshot;
  } catch {
    return {};
  } finally {
    db.close();
  }
}

export async function writeFilesDbSnapshot(files: Record<string, ExcalidrawFileData>) {
  const db = await openDb(FILES_DB_NAME);
  if (!db) {
    return;
  }

  const storeName = pickStore(db);
  if (!storeName) {
    db.close();
    return;
  }

  try {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    const keyPath = store.keyPath;

    Object.entries(files).forEach(([id, file]) => {
      if (typeof keyPath === "string" && keyPath in file) {
        store.put(file);
      } else {
        store.put(file, id);
      }
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // best-effort persistence
  } finally {
    db.close();
  }
}

export async function captureScenePayloadFromPage(): Promise<ScenePayload> {
  const elements = parseJson<unknown>(window.localStorage.getItem(EXCALIDRAW_KEYS.ELEMENTS), []);
  const appState = parseJson<Record<string, unknown> | null>(
    window.localStorage.getItem(EXCALIDRAW_KEYS.APP_STATE),
    {},
  );

  const files = await readFilesDbSnapshot();

  return {
    appState,
    capturedAt: Date.now(),
    elements: Array.isArray(elements) ? (elements as Record<string, unknown>[]) : [],
    files,
  };
}

export async function applyScenePayloadToPage(payload: ScenePayload) {
  setJson(EXCALIDRAW_KEYS.ELEMENTS, payload.elements);
  setJson(EXCALIDRAW_KEYS.APP_STATE, payload.appState ?? {});

  const version = String(Date.now());
  window.localStorage.setItem(EXCALIDRAW_KEYS.VERSION_DATA_STATE, version);
  window.localStorage.setItem(EXCALIDRAW_KEYS.VERSION_FILES, version);

  await writeFilesDbSnapshot(payload.files ?? {});
}

export function reloadAfterSceneApply() {
  window.location.reload();
}
