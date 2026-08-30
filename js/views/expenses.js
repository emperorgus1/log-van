import { DB } from '../db.js';
import { money, km, fmtDate, todayISO, TYPE_ICONS, openModal, closeModal, toast, parseDecimal } from '../utils.js';
import { validateFile, uploadAttachment, deleteAttachment } from '../attachments.js';

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
  const attachBadge = r.attachments?.length ? `<div class="record-badge">📎 ${r.attachments.length}</div>` : '';
  return `
    <div class="record-row" data-id="${r.id}">
      <div class="record-icon">${TYPE_ICONS[r.type] || '•'}</div>
      <div class="record-main">
        <div class="record-title">${escapeHTML(r.description || label)} ${attachBadge}</div>
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

function fileSize(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function openForm(existing, onDone) {
  const existingAttachments = existing?.attachments ? [...existing.attachments] : [];
  const removedPaths = [];
  const pendingFiles = []; // { localId, file, previewUrl }
  let nextLocalId = 1;

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
        <input type="text" inputmode="decimal" name="cost" value="${existing?.cost ?? ''}" />
      </label>
      <label>Kilométrage
        <input type="text" inputmode="decimal" name="odometer" value="${existing?.odometer ?? ''}" placeholder="optionnel" />
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
      <label>Documents (photos, PDF)
        <div id="attach-list" class="attach-list"></div>
        <input type="file" id="attach-input" accept="image/*,application/pdf" multiple />
      </label>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Enregistrer</button>
        ${existing ? '<button type="button" id="btn-delete" class="btn-danger">Supprimer</button>' : ''}
      </div>
    </form>
  `);

  function renderAttachList() {
    const list = content.querySelector('#attach-list');
    const existingItems = existingAttachments.map((a) => `
      <div class="attach-item" data-kind="existing" data-path="${escapeHTML(a.path)}">
        ${a.type?.startsWith('image/') ? `<img class="attach-thumb" src="${a.url}" alt="" />` : '<div class="attach-thumb attach-thumb-file">📄</div>'}
        <a class="attach-name" href="${a.url}" target="_blank" rel="noopener">${escapeHTML(a.name)}</a>
        <span class="attach-size">${fileSize(a.size || 0)}</span>
        <button type="button" class="attach-remove" data-path="${escapeHTML(a.path)}">✕</button>
      </div>
    `);
    const pendingItems = pendingFiles.map((p) => `
      <div class="attach-item" data-kind="pending" data-local-id="${p.localId}">
        ${p.file.type.startsWith('image/') ? `<img class="attach-thumb" src="${p.previewUrl}" alt="" />` : '<div class="attach-thumb attach-thumb-file">📄</div>'}
        <span class="attach-name">${escapeHTML(p.file.name)}</span>
        <span class="attach-size">${fileSize(p.file.size)} · à envoyer</span>
        <button type="button" class="attach-remove" data-local-id="${p.localId}">✕</button>
      </div>
    `);
    list.innerHTML = existingItems.join('') + pendingItems.join('');

    list.querySelectorAll('.attach-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.path) {
          const idx = existingAttachments.findIndex((a) => a.path === btn.dataset.path);
          if (idx !== -1) {
            removedPaths.push(existingAttachments[idx].path);
            existingAttachments.splice(idx, 1);
          }
        } else if (btn.dataset.localId) {
          const idx = pendingFiles.findIndex((p) => String(p.localId) === btn.dataset.localId);
          if (idx !== -1) {
            URL.revokeObjectURL(pendingFiles[idx].previewUrl);
            pendingFiles.splice(idx, 1);
          }
        }
        renderAttachList();
      });
    });
  }

  renderAttachList();

  content.querySelector('#attach-input').addEventListener('change', (e) => {
    for (const file of e.target.files) {
      const error = validateFile(file);
      if (error) {
        toast(error);
        continue;
      }
      pendingFiles.push({
        localId: nextLocalId++,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      });
    }
    e.target.value = '';
    renderAttachList();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('exp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const id = existing?.id || DB.newId();

    if (pendingFiles.length) {
      submitBtn.textContent = 'Envoi des documents…';
      try {
        for (const p of pendingFiles) {
          const uploaded = await uploadAttachment(id, p.file);
          existingAttachments.push(uploaded);
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        }
      } catch (err) {
        console.error(err);
        toast("Échec de l'envoi d'un document — réessaie.");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
      }
    }

    await Promise.all(removedPaths.map((path) => deleteAttachment(path)));

    const fd = new FormData(e.target);
    const record = {
      id,
      type: fd.get('type'),
      description: fd.get('description')?.trim() || '',
      date: fd.get('date'),
      cost: fd.get('cost') ? parseDecimal(fd.get('cost')) : null,
      odometer: fd.get('odometer') ? parseDecimal(fd.get('odometer')) : null,
      category: fd.get('category')?.trim() || '',
      vendor: fd.get('vendor')?.trim() || '',
      notes: fd.get('notes')?.trim() || '',
      attachments: existingAttachments,
    };
    if (existing) {
      await DB.updateRecord(record);
    } else {
      await DB.setRecord(record);
    }
    closeModal();
    toast('Dépense enregistrée');
    onDone();
  });

  if (existing) {
    document.getElementById('btn-delete').addEventListener('click', async () => {
      await Promise.all(existingAttachments.map((a) => deleteAttachment(a.path)));
      await DB.deleteRecord(existing.id);
      closeModal();
      toast('Dépense supprimée');
      onDone();
    });
  }
}
