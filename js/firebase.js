// Initialisation Firebase — authentification + Firestore avec persistance
// hors-ligne (les écritures faites sans réseau sont mises en file et
// synchronisées automatiquement au retour de la connexion).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCDwcZd8VOUkAgjvyDRTxO3i09IYVbopy0",
  authDomain: "log-van.firebaseapp.com",
  projectId: "log-van",
  storageBucket: "log-van.firebasestorage.app",
  messagingSenderId: "485720422953",
  appId: "1:485720422953:web:d8d18621a2a5778747fa38",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const firestore = getFirestore(app);
export const storage = getStorage(app);

enableIndexedDbPersistence(firestore).catch((err) => {
  // 'failed-precondition' : l'app est ouverte dans un autre onglet en même temps.
  // 'unimplemented' : navigateur qui ne supporte pas la persistance IndexedDB.
  console.warn('Persistance hors-ligne non activée :', err.code);
});

export { onAuthStateChanged, signInWithPopup, signOut };
