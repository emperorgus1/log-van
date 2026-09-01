// Fonction Netlify : reçoit deux coordonnées et appelle HeiGIT/OpenRouteService
// côté serveur. ORS_API_KEY doit être définie dans les variables d'environnement
// du site Netlify; elle n'est jamais incluse dans les fichiers publics.
function coordinate(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Méthode non autorisée.' };
  }

  const start = (event.queryStringParameters?.start || '').split(',');
  const end = (event.queryStringParameters?.end || '').split(',');
  const startLng = coordinate(start[0], -180, 180);
  const startLat = coordinate(start[1], -90, 90);
  const endLng = coordinate(end[0], -180, 180);
  const endLat = coordinate(end[1], -90, 90);
  if ([startLng, startLat, endLng, endLat].some((value) => value === null)) {
    return { statusCode: 400, body: 'Coordonnées non valides.' };
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    console.error('ORS_API_KEY est absente des variables Netlify.');
    return { statusCode: 503, body: 'Calcul de distance indisponible.' };
  }

  try {
    const url = new URL('https://api.heigit.org/v2/directions/driving-car');
    url.searchParams.set('start', `${startLng},${startLat}`);
    url.searchParams.set('end', `${endLng},${endLat}`);
    const response = await fetch(url, { headers: { Authorization: apiKey } });
    if (!response.ok) {
      console.warn('HeiGIT a refusé le calcul de distance :', response.status);
      return { statusCode: 502, body: 'Calcul de distance indisponible.' };
    }
    const data = await response.json();
    const distance = data?.routes?.[0]?.summary?.distance;
    if (typeof distance !== 'number') {
      return { statusCode: 502, body: 'Réponse de distance invalide.' };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ distance }),
    };
  } catch (err) {
    console.error('Appel HeiGIT échoué :', err);
    return { statusCode: 502, body: 'Calcul de distance indisponible.' };
  }
}
