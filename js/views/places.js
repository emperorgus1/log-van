import { DB } from '../db.js';
import { fmtDate, todayISO, openModal, closeModal, toast, escapeHTML, validateDateField } from '../utils.js';
import { resolveLocation, getCurrentPosition, googleMapsUrl, drivingDistanceKm, confirmLocationPrivacy, locationNeedsGeocoding } from '../geo.js';

let activeTab = 'list';
let leafletPromise = null;

function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Impossible de charger la carte.'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export async function renderPlaces(container) {
  const places = await DB.getRecordsByType('place');
  const sorted = [...places].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="view-header">
      <h1>Endroits visités</h1>
      <button class="icon-btn" id="btn-add" aria-label="Ajouter un endroit">➕</button>
    </div>
    <div class="chip-row">
      <button class="chip${activeTab === 'list' ? ' active' : ''}" data-tab="list">Liste</button>
      <button class="chip${activeTab === 'map' ? ' active' : ''}" data-tab="map">Carte</button>
    </div>
    <div id="places-body"></div>
  `;

  document.getElementById('btn-add').addEventListener('click', () => openForm(null, () => renderPlaces(container)));
  container.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => {
      activeTab = c.dataset.tab;
      renderPlaces(container);
    });
  });

  const body = document.getElementById('places-body');
  if (activeTab === 'map') {
    await renderMap(body, sorted, () => renderPlaces(container));
  } else {
    renderList(body, sorted, () => renderPlaces(container));
  }
}

function renderList(body, sorted, onDone) {
  body.innerHTML = `
    <div class="record-list">
      ${sorted.length ? sorted.map(row).join('') : '<p class="empty-state">Aucun endroit enregistré. Ajoute ta première visite !</p>'}
    </div>
  `;
  sorted.forEach((r) => {
    const node = body.querySelector(`[data-id="${r.id}"]`);
    if (node) node.addEventListener('click', () => openForm(r, onDone));
  });
}

function row(r) {
  const locLabel = r.locationText ? truncate(r.locationText, 40) : (typeof r.lat === 'number' ? 'Position GPS' : null);
  const distanceLabel = typeof r.distanceFromHomeKm === 'number' ? `${Math.round(r.distanceFromHomeKm)} km de la maison` : null;
  const sub = [fmtDate(r.date), locLabel, distanceLabel].filter(Boolean).join(' · ');
  const badge = typeof r.lat !== 'number' ? '<div class="record-badge">non localisé</div>' : '';
  return `
    <div class="record-row" data-id="${escapeHTML(r.id)}">
      <div class="record-icon">📍</div>
      <div class="record-main">
        <div class="record-title">${escapeHTML(r.name)} ${badge}</div>
        <div class="record-sub">${escapeHTML(sub)}</div>
      </div>
    </div>
  `;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function renderMap(body, sorted, onDone) {
  const located = sorted.filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');
  if (!located.length) {
    body.innerHTML = '<p class="empty-state">Aucun endroit localisé pour l\'instant.</p>';
    return;
  }

  body.innerHTML = `<div id="map" class="map-container"></div>`;

  let L;
  try {
    L = await loadLeaflet();
  } catch (err) {
    body.innerHTML = '<p class="empty-state">Impossible de charger la carte (vérifie ta connexion).</p>';
    return;
  }

  const map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  map.on('popupopen', (e) => {
    const btn = e.popup._contentNode?.querySelector('.popup-edit');
    if (!btn) return;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const place = located.find((r) => r.id === btn.dataset.id);
      if (place) openForm(place, onDone);
    });
  });

  located.forEach((r) => {
    const marker = L.marker([r.lat, r.lng]).addTo(map);
    marker.bindPopup(`
      <strong>${escapeHTML(r.name)}</strong><br>
      ${escapeHTML(fmtDate(r.date))}
      ${r.notes ? `<br>${escapeHTML(truncate(r.notes, 80))}` : ''}
      <br><a href="#" class="popup-edit" data-id="${escapeHTML(r.id)}">Modifier</a>
    `);
  });

  const bounds = L.latLngBounds(located.map((r) => [r.lat, r.lng]));
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  if (located.length === 1) map.setZoom(13);
}

function openForm(existing, onDone) {
  const content = openModal(`
    <div class="modal-header">
      <h2>${existing ? "Modifier l'endroit" : 'Nouvel endroit'}</h2>
      <button class="icon-btn" id="modal-close" aria-label="Fermer la fenêtre">✕</button>
    </div>
    <form id="place-form" class="form">
      <label>Nom
        <input type="text" name="name" value="${existing ? escapeHTML(existing.name) : ''}" placeholder="ex: Camping du Lac Bleu" required />
      </label>
      <label>Date
        <input type="date" name="date" value="${escapeHTML(existing?.date || todayISO())}" required />
      </label>
      <label>Localisation
        <div class="location-row">
          <input type="text" name="locationText" value="${existing ? escapeHTML(existing.locationText || '') : ''}" placeholder="Adresse, lien Google Maps ou coordonnées GPS" />
          <button type="button" id="btn-locate" class="icon-btn" title="Utiliser ma position actuelle" aria-label="Utiliser ma position actuelle">📍</button>
        </div>
        <span class="field-hint">Astuce : colle le lien complet de Google Maps (pas un lien court maps.app.goo.gl).</span>
      </label>
      <label>Notes
        <textarea name="notes" placeholder="optionnel">${existing ? escapeHTML(existing.notes || '') : ''}</textarea>
      </label>
      ${existing && typeof existing.lat === 'number' ? `<a href="${googleMapsUrl(existing.lat, existing.lng)}" target="_blank" rel="noopener" class="btn-secondary" style="text-align:center;text-decoration:none;">Voir sur Google Maps</a>` : ''}
      <div class="form-actions">
        <button type="submit" class="btn-primary">Enregistrer</button>
        ${existing ? '<button type="button" id="btn-delete" class="btn-danger">Supprimer</button>' : ''}
      </div>
    </form>
  `);

  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('btn-locate').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '⏳';
    try {
      const { lat, lng } = await getCurrentPosition();
      content.querySelector('[name="locationText"]').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (err) {
      toast("Impossible d'obtenir ta position.");
    } finally {
      btn.disabled = false;
      btn.textContent = '📍';
    }
  });

  document.getElementById('place-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!validateDateField(form, 'date', { label: 'La date', required: true, max: todayISO() })) {
      form.reportValidity();
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Localisation…';
    try {
      const fd = new FormData(form);
      const locationInput = fd.get('locationText')?.trim() || '';
      const vehicle = await DB.getVehicle();
      const needsRouting = Boolean(locationInput && vehicle && typeof vehicle.homeLat === 'number');
      if (!confirmLocationPrivacy({ geocoding: locationNeedsGeocoding(locationInput), routing: needsRouting })) return;
      const resolved = await resolveLocation(locationInput);

      let distanceFromHomeKm = null;
      if (resolved.lat != null) {
        if (vehicle && typeof vehicle.homeLat === 'number') {
          distanceFromHomeKm = await drivingDistanceKm(
            { lat: vehicle.homeLat, lng: vehicle.homeLng },
            { lat: resolved.lat, lng: resolved.lng }
          );
        }
      }
      const record = {
        type: 'place',
        name: fd.get('name')?.trim() || '',
        date: fd.get('date'),
        notes: fd.get('notes')?.trim() || '',
        locationText: resolved.locationText,
        lat: resolved.lat,
        lng: resolved.lng,
        locationSource: resolved.source,
        distanceFromHomeKm,
      };
      if (existing) {
        record.id = existing.id;
        await DB.updateRecord(record);
      } else {
        await DB.addRecord(record);
      }
      closeModal();
      toast(locationInput && resolved.lat == null ? 'Endroit enregistré (localisation introuvable)' : 'Endroit enregistré');
      onDone();
    } catch (err) {
      console.error("Enregistrement de l'endroit échoué :", err);
      toast("Impossible d'enregistrer l'endroit. Réessaie.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  });

  if (existing) {
    document.getElementById('btn-delete').addEventListener('click', async () => {
      if (!window.confirm('Supprimer cet endroit ? Cette action est irréversible.')) return;
      try {
        await DB.deleteRecord(existing.id);
        closeModal();
        toast('Endroit supprimé');
        onDone();
      } catch (err) {
        console.error("Suppression de l'endroit échouée :", err);
        toast("Impossible de supprimer l'endroit. Réessaie.");
      }
    });
  }
}
