const DB_NAME = "tradecore-offline";
const STORE = "pending-trades";

async function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "offlineId" });
      }
    };
    req.onsuccess = (e) => res((e.target as IDBOpenDBRequest).result);
    req.onerror = () => rej(req.error);
  });
}

export async function offlineSave(data: unknown): Promise<string> {
  const db = await open();
  const offlineId = crypto.randomUUID();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ offlineId, data, savedAt: new Date().toISOString() });
    tx.oncomplete = () => res(offlineId);
    tx.onerror = () => rej(tx.error);
  });
}

export async function offlineGetAll(): Promise<Array<{ offlineId: string; data: unknown }>> {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result as Array<{ offlineId: string; data: unknown }>);
    req.onerror = () => rej(req.error);
  });
}

export async function offlineRemove(offlineId: string): Promise<void> {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(offlineId);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
