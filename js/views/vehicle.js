import { DB } from '../db.js';
import { openModal, closeModal, toast, escapeHTML } from '../utils.js';
import { resolveLocation, getCurrentPosition } from '../geo.js';

export async function openVehicleModal(onSaved) {
  const v = (await DB.getVehicle()) || {};
  const content = openModal(`
    <div class="modal-header">
      <h2>Profil du véhicule</h2>
      <button class="icon-btn" id="modal-close">✕</button>
    </div>
    <form id="vehicle-form" class="form">
      <label>Surnom de la van
        <input type="text" name="nickname" value="${v.nickname || ''}" placeholder="ex: Buddy" />
      </label>
      <label>Marque
        <input type="text" name="make" value="${v.make || ''}" />
      </label>
      <label>Modèle
        <input type="text" name="model" value="${v.model || ''}" />
      </label>
      <label>Année
        <input type="number" name="year" value="${v.year || ''}" />
      </label>
      <label>Date d'achat
        <input type="date" name="purchaseDate" value="${v.purchaseDate || ''}" />
      </label>
      <label>Kilométrage à l'achat
        <input type="number" name="purchaseOdometer" value="${v.purchaseOdometer ?? ''}" />
      </label>
      <label>Prix d'achat
        <input type="number" step="0.01" name="purchasePrice" value="${v.purchasePrice ?? ''}" />
      </label>
      <label>Localisation de la maison
        <div class="location-row">
          <input type="text" name="homeLocationText" value="${escapeHTML(v.homeLocationText || '')}" placeholder="Adresse, lien Google Maps ou coordonnées GPS" />
          <button type="button" id="btn-locate-home" class="icon-btn" title="Utiliser ma position actuelle">📍</button>
        </div>
        <span class="field-hint">Utilisée pour calculer la distance de conduite jusqu'aux endroits visités.</span>
      </label>
      <button type="submit" class="btn-primary">Enregistrer</button>
    </form>
  `);

  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('btn-locate-home').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '⏳';
    try {
      const { lat, lng } = await getCurrentPosition();
      content.querySelector('[name="homeLocationText"]').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (err) {
      toast("Impossible d'obtenir ta position.");
    } finally {
      btn.disabled = false;
      btn.textContent = '📍';
    }
  });

  document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const fd = new FormData(e.target);
    const homeLocationInput = fd.get('homeLocationText')?.trim() || '';
    const resolvedHome = await resolveLocation(homeLocationInput);
    const data = {
      nickname: fd.get('nickname')?.trim() || '',
      make: fd.get('make')?.trim() || '',
      model: fd.get('model')?.trim() || '',
      year: fd.get('year') ? Number(fd.get('year')) : null,
      purchaseDate: fd.get('purchaseDate') || '',
      purchaseOdometer: fd.get('purchaseOdometer') ? Number(fd.get('purchaseOdometer')) : null,
      purchasePrice: fd.get('purchasePrice') ? Number(fd.get('purchasePrice')) : null,
      homeLocationText: resolvedHome.locationText,
      homeLat: resolvedHome.lat,
      homeLng: resolvedHome.lng,
    };
    await DB.saveVehicle(data);
    closeModal();
    toast(homeLocationInput && resolvedHome.lat == null ? 'Profil enregistré (localisation de la maison introuvable)' : 'Profil enregistré');
    if (onSaved) onSaved();
  });
}
