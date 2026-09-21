const DB_NAME = 'smartosa';
export const SMARTOSA_IDB_VERSION = 3;

export const DEVICES_STORE = 'devices';
export const WALLS_STORE = 'walls';
export const VISITS_STORE = 'visits';
export const SETTINGS_STORE = 'settings';
export const HOMES_STORE = 'homes';
export const ACTIVE_HOME_KEY = 'active-home';
const NETWORK_KEY = 'network';

export type PayloadRecord = {
  id: string;
  payload: string;
  updatedAt: number;
};

function ensureStore(db: IDBDatabase, name: string, indexName?: string): void {
  if (db.objectStoreNames.contains(name)) {
    return;
  }
  const store = db.createObjectStore(name, {keyPath: 'id'});
  if (indexName) {
    store.createIndex(indexName, indexName);
  }
}

function rekeyRows(store: IDBObjectStore, homeId: string, onlyId?: string): void {
  const request = store.getAll();
  request.onsuccess = () => {
    const rows = request.result as PayloadRecord[];
    for (const row of rows) {
      if (onlyId && row.id !== onlyId) {
        continue;
      }
      if (row.id.includes(':')) {
        continue;
      }
      store.delete(row.id);
      store.put({...row, id: `${homeId}:${row.id}`});
    }
  };
}

export function openHomeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SMARTOSA_IDB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      ensureStore(db, DEVICES_STORE, 'updatedAt');
      ensureStore(db, WALLS_STORE, 'updatedAt');
      ensureStore(db, VISITS_STORE, 'at');
      ensureStore(db, SETTINGS_STORE);
      ensureStore(db, HOMES_STORE);
      if (!tx || event.oldVersion === 0) {
        return;
      }
      const homesStore = tx.objectStore(HOMES_STORE);
      const existing = homesStore.getAll();
      existing.onsuccess = () => {
        const homes = existing.result as {id: string}[];
        if (homes.length > 0) {
          return;
        }
        const homeId = crypto.randomUUID();
        const now = Date.now();
        homesStore.add({id: homeId, name: 'Дом', createdAt: now, updatedAt: now});
        const settings = tx.objectStore(SETTINGS_STORE);
        settings.put({id: ACTIVE_HOME_KEY, payload: homeId, updatedAt: now});
        rekeyRows(tx.objectStore(DEVICES_STORE), homeId);
        rekeyRows(tx.objectStore(WALLS_STORE), homeId);
        rekeyRows(tx.objectStore(VISITS_STORE), homeId);
        rekeyRows(settings, homeId, NETWORK_KEY);
      };
    };
  });
}

export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    request.onsuccess = () => resolve(request.result);
  });
}
