import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'appHistoryDB';
const DB_VERSION = 1;

export const STORE_NAMES = {
  BULK_DOWNLOADS: 'bulk_downloads',
  CONVERSIONS: 'conversions',
  SCRAPINGS: 'scrapings',
  ATTRIBUTES_EXTRACTIONS: 'attributes_extractions',
  NAME_STANDARDIZATIONS: 'name_standardizations',
  DESCRIPTIONS: 'descriptions',
};

interface AppDB extends DBSchema {
  bulk_downloads: { key: string; value: any; indexes: { 'by-createdAt': number } };
  conversions: { key: string; value: any; indexes: { 'by-createdAt': number } };
  scrapings: { key: string; value: any; indexes: { 'by-createdAt': number } };
  attributes_extractions: { key: string; value: any; indexes: { 'by-createdAt': number } };
  name_standardizations: { key: string; value: any; indexes: { 'by-createdAt': number } };
  descriptions: { key: string; value: any; indexes: { 'by-createdAt': number } };
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        Object.values(STORE_NAMES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName as any)) {
            const store = db.createObjectStore(storeName as any, { keyPath: 'id', autoIncrement: true });
            store.createIndex('by-createdAt', 'createdAt');
          }
        });
      },
    });
  }
  return dbPromise;
};

// EventTarget for local subscriptions
const dbEvents = new EventTarget();

export const addHistory = async (storeName: string, data: any) => {
  const db = await getDB();
  const payload = { ...data, createdAt: Date.now() };
  await db.add(storeName as any, payload);
  dbEvents.dispatchEvent(new Event(`${storeName}_changed`));
  return payload;
};

export const listHistory = async (storeName: string, limitValue: number = 50) => {
  const db = await getDB();
  const tx = db.transaction(storeName as any, 'readonly');
  const store = tx.objectStore(storeName as any);
  const index = store.index('by-createdAt');
  
  let cursor = await index.openCursor(null, 'prev');
  const results = [];
  while (cursor && results.length < limitValue) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  return results;
};

export const subscribeToStore = (storeName: string, callback: () => void) => {
  const handler = () => callback();
  dbEvents.addEventListener(`${storeName}_changed`, handler);
  return () => {
    dbEvents.removeEventListener(`${storeName}_changed`, handler);
  };
};

export const deleteHistory = async (storeName: string, id: any) => {
  const db = await getDB();
  await db.delete(storeName as any, id);
  dbEvents.dispatchEvent(new Event(`${storeName}_changed`));
};

export const clearHistory = async (storeName: string) => {
  const db = await getDB();
  await db.clear(storeName as any);
  dbEvents.dispatchEvent(new Event(`${storeName}_changed`));
};
