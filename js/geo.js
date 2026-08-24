// Résolution d'un texte de localisation (adresse, lien Google Maps, ou
// coordonnées GPS) en coordonnées lat/lng. Le géocodage d'adresse passe par
// Nominatim (OpenStreetMap) — gratuit, sans clé API.

function coordsIfValid(latStr, lngStr) {
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function extractCoordsFromText(text) {
  const direct = text.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (direct) return coordsIfValid(direct[1], direct[2]);

  // Lien Google Maps du style .../@45.501,-73.567,15z
  const at = text.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (at) return coordsIfValid(at[1], at[2]);

  // Lien Google Maps "détail d'un lieu" : !3d<lat>!4d<lng>
  const bang = text.match(/!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (bang) return coordsIfValid(bang[1], bang[2]);

  // Lien du style .../maps?q=45.501,-73.567
  const q = text.match(/[?&]q=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (q) return coordsIfValid(q[1], q[2]);

  return null;
}

export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const results = await res.json();
  if (!results.length) return null;
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

// Résout le texte saisi par l'utilisateur en { lat, lng, locationText, source }.
// lat/lng restent null si la localisation n'a pas pu être déterminée — l'entrée
// est quand même conservée (locationText) pour affichage.
export async function resolveLocation(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { lat: null, lng: null, locationText: '', source: null };

  const coords = extractCoordsFromText(trimmed);
  if (coords) {
    const source = /^https?:\/\//.test(trimmed) ? 'maps-link' : 'gps';
    return { ...coords, locationText: trimmed, source };
  }

  if (/^https?:\/\//.test(trimmed)) {
    // Lien qu'on n'a pas pu décoder (souvent un lien court maps.app.goo.gl,
    // impossible à résoudre côté client à cause du CORS).
    return { lat: null, lng: null, locationText: trimmed, source: 'maps-link' };
  }

  try {
    const geocoded = await geocodeAddress(trimmed);
    if (geocoded) return { ...geocoded, locationText: trimmed, source: 'address' };
  } catch (err) {
    console.warn('Géocodage échoué :', err);
  }
  return { lat: null, lng: null, locationText: trimmed, source: 'address' };
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée sur cet appareil.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
