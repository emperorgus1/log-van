import { DB } from '../db.js';
import { money, km, fmtDate, todayISO, TYPE_ICONS, openModal, closeModal, toast } from '../utils.js';

const TYPES = [
  { value: 'maintenance', label: 'Entretien' },
  { value: 'part', label: 'Pièce achetée' },
  { value: 'renovation', label: 'Aménagement' },
];

let activeFilter = 'all';

export async function renderExpenses(container) {
  const all = await DB.getAllRecords();
  const expenses = all.filter((r) => ['maintenance', 'part', 'renovation'].includes(r.type));
  const filtered = activeFilter === 'all' ? expenses : expenses.filter((r) => r.type === activeFilter);
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  const total = filtered.reduce((sum, r) => sum + (r.cost || 0), 0);

  container.innerHTML = `
    <div class="view-header">
      <h1>Entretien & pièces</h1>
      <button class="icon-btn" id="btn-add">➕</button>
    </div>
    <div class="chip-row">
      ${chip('all', 'Tout')}
      ${TYPES.map((t) => chip(t.value, t.label)).join('')}
    </div>
    <div class="summary-line">${filtered.length} entrée(s) · Total ${money(total)}</div>
    <div class="record-list">
      ${sorted.length ? sorted.map(row).join('') : '<p class="empty-state">Aucune dépense enregistrée pour ce filtre.</p>'}
    </div>
  `;

  document.getElementById('btn-add').addEventListener('click', () => openForm(null, () => renderExpenses(container)));
  container.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => {
      activeFilter = c.dataset.value;
      renderExpenses(container);
    });
  });
  sorted.forEach((r) => {
    const node = container.querySelector(`[data-id="${r.id}"]`);
    if (node) node.addEventListener('click', () => openForm(r, () => renderExpenses(container)));
  });
}

function chip(value, label) {
  const active = activeFilter === value ? ' active' : '';
  return `<button class="chip${active}" data-value="${value}">${label}</button>`;
}

function row(r) {
  const label = TYPES.find((t) => t.value === r.type)?.label || r.type;
  const sub = [fmtDate(r.date), typeof r.odometer === 'number' ? km(r.odometer) : null, r.category || null]
    .filter(Boolean).join(' · ');
  return `
    <div class="record-row" data-id="${r.id}">
      <div class="record-icon">${TYPE_ICONS[r.type] || '•'}</div>
      <div class="record-main">
        <div class="record-title">${escapeHTML(r.description || label)}</div>
        <div class="record-sub">${sub}</div>
      </div>
      <div class="record-cost">${r.cost ? money(r.cost) : ''}</div>
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
      <h2>${existing ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
      <button class="icon-btn" id="modal-close">✕</button>
    </div>
    <form id="exp-form" class="form">
      <label>Type
        <select name="type" required>
          ${TYPES.map((t) => `<option value="${t.value}" ${existing?.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </label>
      <label>Description
        <input type="text" name="description" value="${existing?.description || ''}" placeholder="ex: Changement d'huile" required />
      </label>
      <label>Date
        <input type="date" name="date" value="${existing?.date || todayISO()}" required />
      </label>
      <label>Coût ($)
        <input type="number" step="0.01" name="cost" value="${existing?.cost ?? ''}" />
      </label>
      <label>Kilométrage
        <input type="number" name="odometer" value="${existing?.odometer ?? ''}" placeholder="optionnel" />
      </label>
      <label>Catégorie
        <input type="text" name="category" value="${existing?.category || ''}" placeholder="ex: électricité, plomberie, moteur" />
      </label>
      <label>Fournisseur
        <input type="text" name="vendor" value="${existing?.vendor || ''}" placeholder="optionnel" />
      </label>
      <label>Notes
        <textarea name="notes" placeholder="optionnel">${existing?.notes || ''}</textarea>
      </label>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Enregistrer</button>
        ${existing ? '<button type="button" id="btn-delete" class="btn-danger">Supprimer</button>' : ''}
      </div>
    </form>
  `);

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('exp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const record = {
      type: fd.get('type'),
      description: fd.get('description')?.trim() || '',
      date: fd.get('date'),
      cost: fd.get('cost') ? Number(fd.get('cost')) : null,
      odometer: fd.get('odometer') ? Number(fd.get('odometer')) : null,
      category: fd.get('category')?.trim() || '',
      vendor: fd.get('vendor')?.trim() || '',
      notes: fd.get('notes')?.trim() || '',
    };
    if (existing) {
      record.id = existing.id;
      await DB.updateRecord(record);
    } else {
      await DB.addRecord(record);
    }
    closeModal();
    toast('Dépense enregistrée');
    onDone();
  });

  if (existing) {
    document.getElementById('btn-delete').addEventListener('click', async () => {
      await DB.deleteRecord(existing.id);
      closeModal();
      toast('Dépense supprimée');
      onDone();
    });
  }
}
