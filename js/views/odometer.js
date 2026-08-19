import { DB } from '../db.js';
import { km, fmtDate, todayISO, openModal, closeModal, toast } from '../utils.js';

export async function renderOdometer(container) {
  const records = await DB.getRecordsByType('odometer');
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="view-header">
      <h1>Kilométrage</h1>
      <button class="icon-btn" id="btn-add">➕</button>
    </div>
    <div class="record-list">
      ${sorted.length ? sorted.map(row).join('') : '<p class="empty-state">Aucun relevé. Ajoute le kilométrage actuel de ta van.</p>'}
    </div>
  `;

  document.getElementById('btn-add').addEventListener('click', () => openForm(null, () => renderOdometer(container)));
  sorted.forEach((r) => {
    const node = container.querySelector(`[data-id="${r.id}"]`);
    if (node) node.addEventListener('click', () => openForm(r, () => renderOdometer(container)));
  });
}

function row(r) {
  return `
    <div class="record-row" data-id="${r.id}">
      <div class="record-icon">🧭</div>
      <div class="record-main">
        <div class="record-title">${km(r.odometer)}</div>
        <div class="record-sub">${fmtDate(r.date)}${r.notes ? ' · ' + escapeHTML(r.notes) : ''}</div>
      </div>
    </div>
  `;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function openForm(existing, onDone) {
  const content = openModal(`
    <div class="modal-header">
      <h2>${existing ? 'Modifier le relevé' : 'Nouveau relevé'}</h2>
      <button class="icon-btn" id="modal-close">✕</button>
    </div>
    <form id="odo-form" class="form">
      <label>Date
        <input type="date" name="date" value="${existing?.date || todayISO()}" required />
      </label>
      <label>Kilométrage
        <input type="number" name="odometer" value="${existing?.odometer ?? ''}" required />
      </label>
      <label>Notes
        <input type="text" name="notes" value="${existing?.notes || ''}" placeholder="optionnel" />
      </label>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Enregistrer</button>
        ${existing ? '<button type="button" id="btn-delete" class="btn-danger">Supprimer</button>' : ''}
      </div>
    </form>
  `);

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('odo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const record = {
      type: 'odometer',
      date: fd.get('date'),
      odometer: Number(fd.get('odometer')),
      notes: fd.get('notes')?.trim() || '',
    };
    if (existing) {
      record.id = existing.id;
      await DB.updateRecord(record);
    } else {
      await DB.addRecord(record);
    }
    closeModal();
    toast('Relevé enregistré');
    onDone();
  });

  if (existing) {
    document.getElementById('btn-delete').addEventListener('click', async () => {
      await DB.deleteRecord(existing.id);
      closeModal();
      toast('Relevé supprimé');
      onDone();
    });
  }
}
