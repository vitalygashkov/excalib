import type {
  AuthState,
  DriveManifest,
  DriveManifestScene,
  ScenePayload,
  SceneRecord,
} from "@/src/shared/types";

const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_ROOT = "https://www.googleapis.com/upload/drive/v3";
const SCENE_FILE_MIME = "application/json";
const SHELF_FOLDER_NAME = "Excalidraw Shelf";
const SHELF_MANIFEST_NAME = "manifest.json";

function parseDriveTime(value: string | undefined) {
  if (!value) {
    return Date.now();
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return Date.now();
  }

  return parsed;
}

export async function getAuthToken(interactive: boolean) {
  try {
    console.log("getAuthToken", { interactive });
    // TODO: Figure out why this may hang out (maybe because mismatch between current extension ID and the one in the Google OAuth client settings)
    const result = await browser.identity.getAuthToken({ interactive });
    console.log(result);
    if (typeof result === "string") {
      return result;
    }

    if (result && typeof result === "object" && "token" in result) {
      const token = (result as { token?: unknown }).token;
      return typeof token === "string" ? token : null;
    }

    return null;
  } catch {
    return null;
  }
}

async function removeCachedToken(token: string) {
  await browser.identity.removeCachedAuthToken({ token });
}

export async function signOut() {
  const token = await getAuthToken(false);

  if (!token) {
    return;
  }

  await removeCachedToken(token);

  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch {
    // no-op
  }
}

export async function getAuthState(): Promise<AuthState> {
  console.log("getAuthState");
  const token = await getAuthToken(false);
  return {
    signedIn: Boolean(token),
    tokenAvailable: Boolean(token),
  };
}

async function driveRequest<T>(token: string, input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Drive API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function driveRequestText(token: string, input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Drive API ${response.status}: ${await response.text()}`);
  }

  return await response.text();
}

async function driveUploadMultipart<T>(
  token: string,
  url: string,
  metadata: Record<string, unknown>,
  body: unknown,
  method: "PATCH" | "POST",
) {
  const boundary = `shelf_${crypto.randomUUID()}`;

  const multipartBody = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${SCENE_FILE_MIME}`,
    "",
    JSON.stringify(body),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const response = await fetch(url, {
    body: multipartBody,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    method,
  });

  if (!response.ok) {
    throw new Error(`Drive upload ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

interface DriveFile {
  id: string;
  mimeType?: string;
  modifiedTime?: string;
  name?: string;
}

async function queryFiles(token: string, query: string) {
  const encodedQuery = encodeURIComponent(query);
  const url = `${DRIVE_API_ROOT}/files?q=${encodedQuery}&spaces=drive&fields=files(id,name,mimeType,modifiedTime)&pageSize=100`;
  const data = await driveRequest<{ files: DriveFile[] }>(token, url);
  return data.files;
}

async function ensureFile(token: string, fileId: string) {
  try {
    return await driveRequest<DriveFile>(
      token,
      `${DRIVE_API_ROOT}/files/${fileId}?fields=id,name,mimeType,modifiedTime`,
    );
  } catch {
    return null;
  }
}

export async function ensureShelfFolder(token: string, cachedFolderId: string | null) {
  if (cachedFolderId) {
    const existing = await ensureFile(token, cachedFolderId);
    if (existing?.id) {
      return existing.id;
    }
  }

  const matches = await queryFiles(
    token,
    `mimeType='application/vnd.google-apps.folder' and archived=false and name='${SHELF_FOLDER_NAME}'`,
  );

  if (matches[0]?.id) {
    return matches[0].id;
  }

  const created = await driveRequest<DriveFile>(token, `${DRIVE_API_ROOT}/files?fields=id`, {
    body: JSON.stringify({
      mimeType: "application/vnd.google-apps.folder",
      name: SHELF_FOLDER_NAME,
    }),
    method: "POST",
  });

  if (!created.id) {
    throw new Error("Failed to create Drive folder");
  }

  return created.id;
}

async function createManifest(token: string, folderId: string) {
  const manifest: DriveManifest = {
    scenes: [],
    updatedAt: Date.now(),
    version: 1,
  };

  const created = await driveUploadMultipart<DriveFile>(
    token,
    `${DRIVE_UPLOAD_ROOT}/files?uploadType=multipart&fields=id,modifiedTime`,
    {
      mimeType: SCENE_FILE_MIME,
      name: SHELF_MANIFEST_NAME,
      parents: [folderId],
    },
    manifest,
    "POST",
  );

  if (!created.id) {
    throw new Error("Failed to create Drive manifest");
  }

  return {
    fileId: created.id,
    manifest,
  };
}

export async function ensureManifest(
  token: string,
  folderId: string,
  cachedManifestFileId: string | null,
) {
  if (cachedManifestFileId) {
    try {
      const manifest = await loadManifest(token, cachedManifestFileId);
      return {
        fileId: cachedManifestFileId,
        manifest,
      };
    } catch {
      // fall through
    }
  }

  const matches = await queryFiles(
    token,
    `archived=false and name='${SHELF_MANIFEST_NAME}' and '${folderId}' in parents`,
  );

  if (matches[0]?.id) {
    const manifest = await loadManifest(token, matches[0].id);
    return {
      fileId: matches[0].id,
      manifest,
    };
  }

  return createManifest(token, folderId);
}

export async function loadManifest(token: string, manifestFileId: string) {
  const text = await driveRequestText(token, `${DRIVE_API_ROOT}/files/${manifestFileId}?alt=media`);

  const parsed = JSON.parse(text) as Partial<DriveManifest>;
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

  return {
    scenes: scenes as DriveManifestScene[],
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    version: 1,
  } satisfies DriveManifest;
}

export async function saveManifest(token: string, manifestFileId: string, manifest: DriveManifest) {
  const response = await fetch(
    `${DRIVE_UPLOAD_ROOT}/files/${manifestFileId}?uploadType=media&fields=id,modifiedTime`,
    {
      body: JSON.stringify(manifest),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": SCENE_FILE_MIME,
      },
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to save manifest: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as DriveFile;
  return {
    fileId: data.id ?? manifestFileId,
    modifiedTime: parseDriveTime(data.modifiedTime),
  };
}

export async function uploadSceneFile(
  token: string,
  folderId: string,
  scene: SceneRecord,
  payload: ScenePayload,
  existingFileId: string | null,
) {
  const metadata = {
    mimeType: SCENE_FILE_MIME,
    name: `${scene.id}.excalidraw`,
    parents: [folderId],
  };

  if (existingFileId) {
    const updated = await driveUploadMultipart<DriveFile>(
      token,
      `${DRIVE_UPLOAD_ROOT}/files/${existingFileId}?uploadType=multipart&fields=id,modifiedTime`,
      metadata,
      payload,
      "PATCH",
    );

    return {
      fileId: updated.id ?? existingFileId,
      modifiedTime: parseDriveTime(updated.modifiedTime),
    };
  }

  const created = await driveUploadMultipart<DriveFile>(
    token,
    `${DRIVE_UPLOAD_ROOT}/files?uploadType=multipart&fields=id,modifiedTime`,
    metadata,
    payload,
    "POST",
  );

  if (!created.id) {
    throw new Error("Failed to create scene file");
  }

  return {
    fileId: created.id,
    modifiedTime: parseDriveTime(created.modifiedTime),
  };
}

export async function downloadSceneFile(token: string, fileId: string) {
  const text = await driveRequestText(token, `${DRIVE_API_ROOT}/files/${fileId}?alt=media`);

  try {
    return JSON.parse(text) as ScenePayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse scene file ${fileId}: ${message}`);
  }
}
