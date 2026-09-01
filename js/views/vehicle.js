import { DB } from '../db.js';
import { openModal, closeModal, toast, escapeHTML, todayISO, validateDateField, validateNumberField } from '../utils.js';
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
        <input type="text" name="nickname" value="${escapeHTML(v.nickname || '')}" placeholder="ex: Buddy" />
      </label>
      <label>Marque
        <input type="text" name="make" value="${escapeHTML(v.make || '')}" />
      </label>
      <label>Modèle
        <input type="text" name="model" value="${escapeHTML(v.model || '')}" />
      </label>
      <label>Année
        <input type="number" name="year" min="1886" max="${new Date().getFullYear() + 1}" value="${escapeHTML(v.year || '')}" />
      </label>
      <label>Date d'achat
        <input type="date" name="purchaseDate" max="${todayISO()}" value="${escapeHTML(v.purchaseDate || '')}" />
      </label>
      <label>Kilométrage à l'achat
        <input type="text" inputmode="decimal" name="purchaseOdometer" value="${escapeHTML(v.purchaseOdometer ?? '')}" />
      </label>
      <label>Prix d'achat
        <input type="text" inputmode="decimal" name="purchasePrice" value="${escapeHTML(v.purchasePrice ?? '')}" />
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
    const form = e.target;
    const year = validateNumberField(form, 'year', { label: "L'année", min: 1886, max: new Date().getFullYear() + 1, integer: true });
    const purchaseDateIsValid = validateDateField(form, 'purchaseDate', { label: "La date d'achat", max: todayISO() });
    const purchaseOdometer = validateNumberField(form, 'purchaseOdometer', { label: "Le kilométrage à l'achat", min: 0 });
    const purchasePrice = validateNumberField(form, 'purchasePrice', { label: "Le prix d'achat", min: 0 });
    if (!year.valid || !purchaseDateIsValid || !purchaseOdometer.valid || !purchasePrice.valid) {
      form.reportValidity();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    try {
      const fd = new FormData(form);
      const homeLocationInput = fd.get('homeLocationText')?.trim() || '';
      const resolvedHome = await resolveLocation(homeLocationInput);
      const data = {
        nickname: fd.get('nickname')?.trim() || '',
        make: fd.get('make')?.trim() || '',
        model: fd.get('model')?.trim() || '',
        year: year.value,
        purchaseDate: fd.get('purchaseDate') || '',
        purchaseOdometer: purchaseOdometer.value,
        purchasePrice: purchasePrice.value,
        homeLocationText: resolvedHome.locationText,
        homeLat: resolvedHome.lat,
        homeLng: resolvedHome.lng,
      };
      await DB.saveVehicle(data);
      closeModal();
      toast(homeLocationInput && resolvedHome.lat == null ? 'Profil enregistré (localisation de la maison introuvable)' : 'Profil enregistré');
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Enregistrement du profil échoué :', err);
      toast("Impossible d'enregistrer le profil. Réessaie.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  });
}
