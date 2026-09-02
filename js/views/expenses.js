import { DB } from '../db.js';
import { money, km, fmtDate, todayISO, TYPE_ICONS, openModal, closeModal, toast, escapeHTML, validateDateField, validateNumberField } from '../utils.js';
import { icon } from '../icons.js';
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
      <button class="icon-btn" id="btn-add" aria-label="Ajouter une dépense">${icon('plus')}</button>
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
    <div class="record-row" data-id="${escapeHTML(r.id)}">
      <div class="record-icon">${TYPE_ICONS[r.type] || '•'}</div>
      <div class="record-main">
        <div class="record-title">${escapeHTML(r.description || label)} ${attachBadge}</div>
        <div class="record-sub">${escapeHTML(sub)}</div>
      </div>
      <div class="record-cost">${r.cost ? money(r.cost) : ''}</div>
    </div>
  `;
}

function fileSize(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function openForm(existing, onDone) {
  const existingAttachments = existing?.attachments ? [...existing.attachments] : [];
  const removedAttachments = [];
  const pendingFiles = []; // { localId, file, previewUrl }
  let nextLocalId = 1;

  const content = openModal(`
    <div class="modal-header">
      <h2>${existing ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
      <button class="icon-btn" id="modal-close" aria-label="Fermer la fenêtre">${icon('close')}</button>
    </div>
    <form id="exp-form" class="form">
      <label>Type
        <select name="type" required>
          ${TYPES.map((t) => `<option value="${t.value}" ${existing?.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </label>
      <label>Description
        <input type="text" name="description" value="${escapeHTML(existing?.description || '')}" placeholder="ex: Changement d'huile" required />
      </label>
      <label>Date
        <input type="date" name="date" value="${escapeHTML(existing?.date || todayISO())}" required />
      </label>
      <label>Coût ($)
        <input type="text" inputmode="decimal" name="cost" value="${escapeHTML(existing?.cost ?? '')}" />
      </label>
      <label>Kilométrage
        <input type="text" inputmode="decimal" name="odometer" value="${escapeHTML(existing?.odometer ?? '')}" placeholder="optionnel" />
      </label>
      <label>Catégorie
        <input type="text" name="category" value="${escapeHTML(existing?.category || '')}" placeholder="ex: électricité, plomberie, moteur" />
      </label>
      <label>Fournisseur
        <input type="text" name="vendor" value="${escapeHTML(existing?.vendor || '')}" placeholder="optionnel" />
      </label>
      <label>Notes
        <textarea name="notes" placeholder="optionnel">${escapeHTML(existing?.notes || '')}</textarea>
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
        ${a.type?.startsWith('image/') ? `<img class="attach-thumb" src="${escapeHTML(safeAttachmentUrl(a.url))}" alt="" />` : `<div class="attach-thumb attach-thumb-file">${icon('document')}</div>`}
        <a class="attach-name" href="${escapeHTML(safeAttachmentUrl(a.url))}" target="_blank" rel="noopener">${escapeHTML(a.name)}</a>
        <span class="attach-size">${fileSize(a.size || 0)}</span>
        <button type="button" class="attach-remove" data-path="${escapeHTML(a.path)}" aria-label="Retirer ${escapeHTML(a.name)}">${icon('close')}</button>
      </div>
    `);
    const pendingItems = pendingFiles.map((p) => `
      <div class="attach-item" data-kind="pending" data-local-id="${p.localId}">
        ${p.file.type.startsWith('image/') ? `<img class="attach-thumb" src="${p.previewUrl}" alt="" />` : `<div class="attach-thumb attach-thumb-file">${icon('document')}</div>`}
        <span class="attach-name">${escapeHTML(p.file.name)}</span>
        <span class="attach-size">${fileSize(p.file.size)} · à envoyer</span>
        <button type="button" class="attach-remove" data-local-id="${p.localId}" aria-label="Retirer ${escapeHTML(p.file.name)}">${icon('close')}</button>
      </div>
    `);
    list.innerHTML = existingItems.join('') + pendingItems.join('');

    list.querySelectorAll('.attach-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.path) {
          const idx = existingAttachments.findIndex((a) => a.path === btn.dataset.path);
          if (idx !== -1) {
            removedAttachments.push(existingAttachments[idx]);
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
    const form = e.target;
    const dateIsValid = validateDateField(form, 'date', { label: 'La date', required: true, max: todayISO() });
    const cost = validateNumberField(form, 'cost', { label: 'Le coût', min: 0 });
    const odometer = validateNumberField(form, 'odometer', { label: 'Le kilométrage', min: 0 });
    if (!dateIsValid || !cost.valid || !odometer.valid) {
      form.reportValidity();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const uploadedAttachments = [];
    const failedUploads = [];
    try {
      const id = existing?.id || DB.newId();

      if (pendingFiles.length) {
        submitBtn.textContent = 'Envoi des documents…';
        for (const p of pendingFiles) {
          try {
            const uploaded = await uploadAttachment(id, p.file);
            uploadedAttachments.push(uploaded);
          } catch (uploadError) {
            console.warn(`Envoi de ${p.file.name} échoué :`, uploadError);
            failedUploads.push(p.file.name);
          }
        }
      }

      const fd = new FormData(form);
      const attachments = [...existingAttachments, ...uploadedAttachments];
      const record = {
        id,
        type: fd.get('type'),
        description: fd.get('description')?.trim() || '',
        date: fd.get('date'),
        cost: cost.value,
        odometer: odometer.value,
        category: fd.get('category')?.trim() || '',
        vendor: fd.get('vendor')?.trim() || '',
        notes: fd.get('notes')?.trim() || '',
      };
      // Une liste vide n'apporte aucune information et peut être refusée si
      // les règles Firestore publiées datent d'avant l'ajout des documents.
      // On n'envoie donc ce champ optionnel que lorsqu'il contient un fichier.
      // En modification, on conserve toutefois la liste vide pour permettre
      // de retirer le dernier document d'une fiche existante.
      if (attachments.length || existing?.attachments?.length) record.attachments = attachments;
      if (existing) {
        await DB.updateRecord(record);
      } else {
        await DB.setRecord(record);
      }

      // La fiche est enregistrée avant de supprimer les anciens fichiers :
      // une panne ne peut donc pas laisser un lien vers un fichier déjà effacé.
      const deletionResults = await Promise.all(removedAttachments.map((a) => deleteAttachment(a.path)));
      const remainingAttachments = removedAttachments.filter((_, index) => !deletionResults[index]);
      if (remainingAttachments.length) {
        try {
          await DB.updateRecord({
            ...record,
            attachments: [...(record.attachments || []), ...remainingAttachments],
          });
          toast("Dépense enregistrée, mais certains documents sont restés joints.");
        } catch (err) {
          console.error('Restauration des pièces jointes échouée :', err);
          toast("Dépense enregistrée, mais vérifie les anciens documents joints.");
        }
      } else {
        toast(failedUploads.length
          ? `Dépense enregistrée, mais ${failedUploads.length} document(s) n'ont pas pu être envoyé(s).`
          : 'Dépense enregistrée');
      }
      pendingFiles.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      closeModal();
      onDone();
    } catch (err) {
      console.error("Enregistrement de la dépense échoué :", err);
      await Promise.all(uploadedAttachments.map((a) => deleteAttachment(a.path)));
      const message = err?.code === 'permission-denied'
        ? "Firebase a refusé les données de la dépense. Vérifie que les règles Firestore sont à jour."
        : "Impossible d'enregistrer la dépense. Réessaie.";
      toast(message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  });

  if (existing) {
    document.getElementById('btn-delete').addEventListener('click', async () => {
      const attachmentMessage = existingAttachments.length
        ? ` et ses ${existingAttachments.length} document(s) joint(s)`
        : '';
      if (!window.confirm(`Supprimer cette dépense${attachmentMessage} ? Cette action est irréversible.`)) return;
      try {
        const deletionResults = await Promise.all(existingAttachments.map((a) => deleteAttachment(a.path)));
        const remainingAttachments = existingAttachments.filter((_, index) => !deletionResults[index]);
        if (remainingAttachments.length) {
          await DB.updateRecord({ ...existing, attachments: remainingAttachments });
          closeModal();
          toast("Certains documents n'ont pas été supprimés. Réessaie plus tard.");
          onDone();
          return;
        }
        await DB.deleteRecord(existing.id);
        closeModal();
        toast('Dépense supprimée');
        onDone();
      } catch (err) {
        console.error('Suppression de la dépense échouée :', err);
        toast("Impossible de supprimer la dépense. Réessaie.");
      }
    });
  }
}

function safeAttachmentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}
