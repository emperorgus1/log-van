// Couche de données — Firestore, avec les données de chaque utilisateur
// isolées sous users/{uid}/. Les vues ne connaissent que cette interface
// (getVehicle, saveVehicle, addRecord, updateRecord, deleteRecord,
// getAllRecords, getRecordsByType) — inchangée depuis la version IndexedDB.
import { auth, firestore } from './firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function uid() {
  const user = auth.currentUser;
  if (!user) throw new Error('Non authentifié.');
  return user.uid;
}

function recordsCol() {
  return collection(firestore, 'users', uid(), 'records');
}

function vehicleDoc() {
  return doc(firestore, 'users', uid(), 'meta', 'vehicle');
}

export const DB = {
  async getVehicle() {
    const snap = await getDoc(vehicleDoc());
    return snap.exists() ? snap.data() : null;
  },

  async saveVehicle(data) {
    // Une modification du profil conserve les champs qui n'étaient pas
    // présents dans le formulaire ouvert sur cet appareil.
    await setDoc(vehicleDoc(), data, { merge: true });
  },

  async addRecord(record) {
    const ref = await addDoc(recordsCol(), record);
    return ref.id;
  },

  // Génère un id de document côté client (sans écriture réseau), pour
  // pouvoir uploader des pièces jointes vers le bon dossier de stockage
  // avant même que l'entrée soit enregistrée.
  newId() {
    return doc(recordsCol()).id;
  },

  async setRecord(record) {
    const { id, ...rest } = record;
    await setDoc(doc(recordsCol(), id), rest);
  },

  async updateRecord(record) {
    const { id, ...rest } = record;
    await updateDoc(doc(recordsCol(), id), rest);
  },

  async deleteRecord(id) {
    await deleteDoc(doc(recordsCol(), id));
  },

  async getAllRecords() {
    const snap = await getDocs(recordsCol());
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return records.sort((a, b) => a.date.localeCompare(b.date));
  },

  async getRecordsByType(type) {
    const all = await this.getAllRecords();
    return all.filter((r) => r.type === type);
  },

  // Les écrans sont avertis lorsqu'une autre session modifie les données.
  // Les premiers résultats sont ignorés : le rendu initial les a déjà chargés.
  subscribeToChanges(onChange) {
    let recordsReady = false;
    let vehicleReady = false;
    const notify = (snapshot, source) => {
      if (!snapshot.metadata.hasPendingWrites) onChange(source);
    };
    const stopRecords = onSnapshot(recordsCol(), (snapshot) => {
      if (recordsReady) notify(snapshot, 'records');
      recordsReady = true;
    });
    const stopVehicle = onSnapshot(vehicleDoc(), (snapshot) => {
      if (vehicleReady) notify(snapshot, 'vehicle');
      vehicleReady = true;
    });
    return () => {
      stopRecords();
      stopVehicle();
    };
  },
};
