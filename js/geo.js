// Résolution d'un texte de localisation (adresse, lien Google Maps, ou
// coordonnées GPS) en coordonnées lat/lng. Le géocodage d'adresse passe par
// Nominatim (OpenStreetMap) — gratuit, sans clé API.

const GEOCODE_CACHE_KEY = 'vanlog_geocode_cache_v1';
const LOCATION_NOTICE_KEY = 'vanlog_location_notice_seen';

function geocodeCache() {
  try {
    return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function geocodeCacheKey(address) {
  return address.trim().toLocaleLowerCase('fr-CA').replace(/\s+/g, ' ');
}

function saveGeocodedAddress(address, result) {
  try {
    const cache = geocodeCache();
    cache[geocodeCacheKey(address)] = result;
    // On conserve les 50 dernières adresses, uniquement sur cet appareil.
    const recentEntries = Object.entries(cache).slice(-50);
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(Object.fromEntries(recentEntries)));
  } catch (err) {
    console.warn('Mise en cache de la localisation échouée :', err);
  }
}

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
  const cached = geocodeCache()[geocodeCacheKey(address)];
  if (cached && typeof cached.lat === 'number' && typeof cached.lng === 'number') return cached;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const results = await res.json();
  if (!results.length) return null;
  const result = { lat: Number(results[0].lat), lng: Number(results[0].lon) };
  saveGeocodedAddress(address, result);
  return result;
}

export function locationNeedsGeocoding(text) {
  const trimmed = (text || '').trim();
  return Boolean(trimmed) && !extractCoordsFromText(trimmed) && !/^https?:\/\//.test(trimmed);
}

// Affiché une seule fois, juste avant le premier envoi à un service de
// localisation. Les coordonnées GPS saisies directement restent locales.
export function confirmLocationPrivacy({ geocoding = false, routing = false } = {}) {
  if ((!geocoding && !routing) || localStorage.getItem(LOCATION_NOTICE_KEY) === '1') return true;
  const details = [];
  if (geocoding) details.push('• L’adresse sera envoyée à Nominatim (OpenStreetMap) pour obtenir ses coordonnées.');
  if (routing) details.push('• Les coordonnées seront envoyées à OpenRouteService pour calculer la distance routière.');
  const accepted = window.confirm(
    `Confidentialité de la localisation\n\n${details.join('\n')}\n\nAucune localisation n’est partagée si tu annules. Continuer ?`
  );
  if (accepted) localStorage.setItem(LOCATION_NOTICE_KEY, '1');
  return accepted;
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

// Clé gratuite OpenRouteService (openrouteservice.org) — voir README/instructions
// pour la générer. Cette clé est nécessairement visible publiquement puisque
// l'appli est un site statique sans serveur; le pire risque en cas de vol est
// l'épuisement du quota gratuit quotidien, sans conséquence financière.
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjZlNWYwMzQxNmI5ODRkNGI5YzRjYWE2Y2Q0YTY2Y2Y3IiwiaCI6Im11cm11cjY0In0=';

// Distance de conduite réelle (en km) entre deux points, via OpenRouteService.
// Retourne null si la clé n'est pas configurée ou si l'appel échoue — appelant
// doit alors se contenter de ne pas afficher de distance plutôt que planter.
export async function drivingDistanceKm(origin, destination) {
  if (!ORS_API_KEY || ORS_API_KEY.startsWith('REMPLACE_PAR')) return null;
  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`;
    const res = await fetch(url, { headers: { Authorization: ORS_API_KEY } });
    if (!res.ok) return null;
    const data = await res.json();
    const meters = data?.routes?.[0]?.summary?.distance
      ?? data?.features?.[0]?.properties?.summary?.distance
      ?? null;
    return typeof meters === 'number' ? meters / 1000 : null;
  } catch (err) {
    console.warn('Calcul de distance échoué :', err);
    return null;
  }
}
