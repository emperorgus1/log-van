// IndexedDB helper — stockage 100% local sur l'appareil.
const DB_NAME = 'vanLogDB';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('vehicle')) {
        db.createObjectStore('vehicle', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('records')) {
        const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_type', 'type');
        store.createIndex('by_date', 'date');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode) {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export const DB = {
  async getVehicle() {
    const store = await tx('vehicle', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(1);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async saveVehicle(data) {
    const store = await tx('vehicle', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ ...data, id: 1 });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async addRecord(record) {
    const store = await tx('records', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async updateRecord(record) {
    const store = await tx('records', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async deleteRecord(id) {
    const store = await tx('records', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getAllRecords() {
    const store = await tx('records', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => a.date.localeCompare(b.date)));
      req.onerror = () => reject(req.error);
    });
  },

  async getRecordsByType(type) {
    const all = await this.getAllRecords();
    return all.filter((r) => r.type === type);
  },
};
