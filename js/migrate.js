// Migration ponctuelle : lit les données de l'ancienne IndexedDB locale
// (avant l'ajout de Firestore) et les transfère dans le compte de
// l'utilisateur connecté. Se déclenche depuis un bouton sur le tableau
// de bord — voir views/dashboard.js.
const LEGACY_DB_NAME = 'vanLogDB';

function openLegacyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB_NAME, 1);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('vehicle')) {
        db.createObjectStore('vehicle', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(db, name) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(name, 'readonly').objectStore(name).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function hasLegacyData() {
  const db = await openLegacyDB();
  const [vehicle, records] = await Promise.all([
    getAllFromStore(db, 'vehicle'),
    getAllFromStore(db, 'records'),
  ]);
  db.close();
  if (vehicle.length === 0 && records.length === 0) return null;
  return { vehicle: vehicle[0] || null, records };
}

export async function migrateLegacyData(DB) {
  const data = await hasLegacyData();
  if (!data) return 0;

  if (data.vehicle) {
    const { id, ...rest } = data.vehicle;
    await DB.saveVehicle(rest);
  }
  for (const r of data.records) {
    const { id, ...rest } = r;
    await DB.addRecord(rest);
  }
  return data.records.length;
}
