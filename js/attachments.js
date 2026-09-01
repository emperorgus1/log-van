// Pièces jointes (photos, PDF) pour les entrées d'entretien — stockées sur
// Firebase Storage, sous users/{uid}/records/{recordId}/, en miroir de
// l'isolation par utilisateur déjà en place sur Firestore.
import { auth, storage } from './firebase.js';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

function uid() {
  const user = auth.currentUser;
  if (!user) throw new Error('Non authentifié.');
  return user.uid;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) return `${file.name} dépasse 10 Mo.`;
  if (ACCEPTED_TYPES.length && !ACCEPTED_TYPES.includes(file.type)) return `${file.name} : type de fichier non supporté.`;
  return null;
}

export async function uploadAttachment(recordId, file) {
  const path = `users/${uid()}/records/${recordId}/${Date.now()}_${sanitizeFilename(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { name: file.name, path, url, type: file.type, size: file.size };
}

export async function deleteAttachment(path) {
  try {
    await deleteObject(ref(storage, path));
    return true;
  } catch (err) {
    console.warn('Suppression du fichier échouée :', err);
    return false;
  }
}
