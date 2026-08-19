import { DB } from '../db.js';
import { openModal, closeModal, toast } from '../utils.js';

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
      <button type="submit" class="btn-primary">Enregistrer</button>
    </form>
  `);

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      nickname: fd.get('nickname')?.trim() || '',
      make: fd.get('make')?.trim() || '',
      model: fd.get('model')?.trim() || '',
      year: fd.get('year') ? Number(fd.get('year')) : null,
      purchaseDate: fd.get('purchaseDate') || '',
      purchaseOdometer: fd.get('purchaseOdometer') ? Number(fd.get('purchaseOdometer')) : null,
      purchasePrice: fd.get('purchasePrice') ? Number(fd.get('purchasePrice')) : null,
    };
    await DB.saveVehicle(data);
    closeModal();
    toast('Profil enregistré');
    if (onSaved) onSaved();
  });
}
