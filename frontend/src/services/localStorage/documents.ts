import { openDB, type IDBPDatabase } from "idb";

/**
 * Raw medical documents (PDF/images) NEVER leave the device: they are stored in
 * IndexedDB only. Firestore holds metadata + user-verified structured results.
 */
const DB_NAME = "healthguardian-local";
const STORE = "documents";
const CACHE = "cache";
const STORE_HANDLES = "folder_handles";
const STORE_METADATA = "folder_file_meta";

let dbPromise: Promise<IDBPDatabase> | null = null;
let idbUnavailable = false;

const memoryDocuments = new Map<string, LocalDocument>();
const memoryCache = new Map<string, { value: unknown; at: number }>();

async function db(): Promise<IDBPDatabase | null> {
  if (typeof window === "undefined" || idbUnavailable) return null;
  if (!dbPromise) {
    try {
      dbPromise = openDB(DB_NAME, 2, {
        upgrade(d) {
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
          if (!d.objectStoreNames.contains(CACHE)) d.createObjectStore(CACHE);
          if (!d.objectStoreNames.contains(STORE_HANDLES)) d.createObjectStore(STORE_HANDLES);
          if (!d.objectStoreNames.contains(STORE_METADATA)) d.createObjectStore(STORE_METADATA, { keyPath: "name" });
        },
      });
      // Test connectivity
      await dbPromise;
    } catch (err) {
      console.warn("IndexedDB unavailable, falling back to in-memory document storage:", err);
      idbUnavailable = true;
      dbPromise = null;
      return null;
    }
  }
  return dbPromise;
}

export interface LocalDocument {
  id: string;
  uid: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return "Only PDF, PNG, JPEG or WEBP files are supported.";
  if (file.size > MAX_FILE_BYTES) return "File is larger than the 15 MB limit.";
  if (file.size === 0) return "File appears to be empty.";
  return null;
}

export async function saveLocalDocument(uid: string, file: File): Promise<string> {
  const id = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item: LocalDocument = {
    id,
    uid,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  };

  const d = await db();
  if (d) {
    try {
      await d.put(STORE, item);
      return id;
    } catch (err) {
      console.warn("IndexedDB put failed, caching in memory:", err);
    }
  }

  memoryDocuments.set(id, item);
  return id;
}

export async function getLocalDocument(uid: string, id: string): Promise<LocalDocument | null> {
  const d = await db();
  if (d) {
    try {
      const doc = (await d.get(STORE, id)) as LocalDocument | undefined;
      if (doc && doc.uid === uid) return doc;
    } catch {
      // fallback to memory
    }
  }

  const memDoc = memoryDocuments.get(id);
  if (memDoc && memDoc.uid === uid) return memDoc;
  return null;
}

export async function listLocalDocuments(uid: string): Promise<LocalDocument[]> {
  const list: LocalDocument[] = [];
  const d = await db();
  if (d) {
    try {
      const all = (await d.getAll(STORE)) as LocalDocument[];
      list.push(...all.filter((x) => x.uid === uid));
    } catch {
      // fallback to memory
    }
  }

  // Include any in-memory documents not in IndexedDB
  for (const doc of memoryDocuments.values()) {
    if (doc.uid === uid && !list.some((existing) => existing.id === doc.id)) {
      list.push(doc);
    }
  }

  return list;
}

export async function deleteLocalDocument(uid: string, id: string) {
  memoryDocuments.delete(id);
  const d = await db();
  if (d) {
    try {
      await d.delete(STORE, id);
    } catch {
      // best-effort
    }
  }
}

export async function deleteAllLocalDocuments(uid: string) {
  for (const [id, doc] of Array.from(memoryDocuments.entries())) {
    if (doc.uid === uid) {
      memoryDocuments.delete(id);
    }
  }

  const d = await db();
  if (d) {
    try {
      const docs = await listLocalDocuments(uid);
      await Promise.all(docs.map((x) => d.delete(STORE, x.id)));
    } catch {
      // best-effort
    }
  }
}

/* ------------------------------- data cache -------------------------------- */

export async function cacheSet(key: string, value: unknown) {
  memoryCache.set(key, { value, at: Date.now() });
  try {
    const d = await db();
    if (d) {
      await d.put(CACHE, { value, at: Date.now() }, key);
    }
  } catch {
    /* cache is best-effort */
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const d = await db();
    if (d) {
      const hit = (await d.get(CACHE, key)) as { value: T } | undefined;
      if (hit) return hit.value;
    }
  } catch {
    // fallback to memory
  }

  const mem = memoryCache.get(key);
  return mem ? (mem.value as T) : null;
}

export async function cacheClear(uid: string) {
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(uid)) {
      memoryCache.delete(key);
    }
  }

  try {
    const d = await db();
    if (d) {
      const keys = await d.getAllKeys(CACHE);
      await Promise.all(keys.filter((k) => String(k).startsWith(uid)).map((k) => d.delete(CACHE, k)));
    }
  } catch {
    // best-effort
  }
}
