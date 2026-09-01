import { DB } from '../db.js';
import { money, km, fmtDate, todayISO, openModal, closeModal, toast, escapeHTML, validateDateField, validateNumberField } from '../utils.js';
import { icon } from '../icons.js';

let activeTab = 'fuel';

export async function renderFuel(container) {
  const all = await DB.getAllRecords();
  const records = all.filter((r) => r.type === 'fuel');
  const odoRecords = all.filter((r) => r.type === 'odometer');

  const byOdo = records.filter((r) => typeof r.odometer === 'number').sort((a, b) => a.odometer - b.odometer);
  const withConsumption = attachConsumption(byOdo);
  const sorted = [...withConsumption].sort((a, b) => b.date.localeCompare(a.date));
  const sortedOdo = [...odoRecords].sort((a, b) => b.date.localeCompare(a.date));

  const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0);
  const totalLiters = records.reduce((s, r) => s + (r.liters || 0), 0);
  const avgConsumption = averageConsumption(withConsumption);
  const consumptionHint = avgConsumption === null
    ? 'Ajoute deux pleins complets avec kilométrage pour calculer la consommation.'
    : '';

  const fuelSection = `
    <div class="stat-grid stat-grid-3">
      <div class="stat-card">
        <div class="stat-label">Total dépensé</div>
        <div class="stat-value stat-value-sm">${money(totalCost)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Litres totaux</div>
        <div class="stat-value stat-value-sm">${totalLiters.toFixed(1)} L</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Conso. moy.</div>
        <div class="stat-value stat-value-sm">${avgConsumption !== null ? avgConsumption.toFixed(1) + ' L/100km' : '—'}</div>
      </div>
    </div>
    ${consumptionHint ? `<p class="field-hint">${consumptionHint}</p>` : ''}
    <div class="record-list">
      ${sorted.length ? sorted.map(row).join('') : '<p class="empty-state">Aucun plein enregistré.</p>'}
    </div>
  `;

  const odoSection = `
    <div class="record-list">
      ${sortedOdo.length ? sortedOdo.map(odoRow).join('') : '<p class="empty-state">Aucun relevé de kilométrage.</p>'}
    </div>
  `;

  container.innerHTML = `
    <div class="view-header">
      <h1>Essence</h1>
      <div class="header-actions">
        <button class="icon-btn" id="btn-add-odo" title="Ajouter un relevé de kilométrage" aria-label="Ajouter un relevé de kilométrage">${icon('gauge')}</button>
        <button class="icon-btn" id="btn-add" aria-label="Ajouter un plein d'essence">${icon('plus')}</button>
      </div>
    </div>
    <div class="chip-row">
      <button class="chip${activeTab === 'fuel' ? ' active' : ''}" data-tab="fuel">Pleins</button>
      <button class="chip${activeTab === 'odometer' ? ' active' : ''}" data-tab="odometer">Relevés kilométriques</button>
    </div>
    ${activeTab === 'fuel' ? fuelSection : odoSection}
  `;

  document.getElementById('btn-add').addEventListener('click', () => openForm(null, () => renderFuel(container)));
  document.getElementById('btn-add-odo').addEventListener('click', () => openOdometerForm(null, () => renderFuel(container)));
  container.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => {
      activeTab = c.dataset.tab;
      renderFuel(container);
    });
  });

  if (activeTab === 'fuel') {
    sorted.forEach((r) => {
      const node = container.querySelector(`[data-id="${r.id}"]`);
      if (node) node.addEventListener('click', () => openForm(r, () => renderFuel(container)));
    });
  } else {
    sortedOdo.forEach((r) => {
      const node = container.querySelector(`[data-id="${r.id}"]`);
      if (node) node.addEventListener('click', () => openOdometerForm(r, () => renderFuel(container)));
    });
  }
}

function attachConsumption(sortedByOdo) {
  let lastFullIdx = -1;
  return sortedByOdo.map((r, i) => {
    let consumption = null;
    let consumptionDistance = null;
    let consumptionLiters = null;
    let consumptionIssue = '';
    if (r.fullTank && lastFullIdx !== -1) {
      const prev = sortedByOdo[lastFullIdx];
      const distance = r.odometer - prev.odometer;
      const between = sortedByOdo.slice(lastFullIdx + 1, i + 1);
      const liters = between.reduce((s, x) => s + (x.liters || 0), 0);
      if (distance > 0 && liters > 0) {
        consumption = (liters / distance) * 100;
        consumptionDistance = distance;
        consumptionLiters = liters;
      } else if (distance <= 0) {
        consumptionIssue = 'Consommation indisponible : le kilométrage est incohérent.';
      } else {
        consumptionIssue = 'Consommation indisponible : il manque la quantité d’essence.';
      }
    }
    if (r.fullTank) lastFullIdx = i;
    return { ...r, consumption, consumptionDistance, consumptionLiters, consumptionIssue };
  });
}

function averageConsumption(withConsumption) {
  const intervals = withConsumption.filter((r) => r.consumptionDistance !== null && r.consumptionLiters !== null);
  if (!intervals.length) return null;
  const distance = intervals.reduce((sum, r) => sum + r.consumptionDistance, 0);
  const liters = intervals.reduce((sum, r) => sum + r.consumptionLiters, 0);
  return distance > 0 && liters > 0 ? (liters / distance) * 100 : null;
}

async function confirmOlderOdometer(odometer, recordId) {
  const records = await DB.getAllRecords();
  const highest = records
    .filter((r) => r.id !== recordId && typeof r.odometer === 'number')
    .reduce((max, r) => Math.max(max, r.odometer), -Infinity);
  if (odometer >= highest) return true;
  return window.confirm(
    `Ce kilométrage (${km(odometer)}) est inférieur au plus grand relevé existant (${km(highest)}). `
    + 'Veux-tu enregistrer un relevé plus ancien quand même ?'
  );
}

function row(r) {
  const sub = [fmtDate(r.date), typeof r.odometer === 'number' ? km(r.odometer) : null, r.liters ? r.liters.toFixed(1) + ' L' : null]
    .filter(Boolean).join(' · ');
  const consumptionBadge = r.consumption ? `<div class="record-badge">${r.consumption.toFixed(1)} L/100km</div>` : '';
  const consumptionIssue = r.consumptionIssue ? `<div class="record-sub">${r.consumptionIssue}</div>` : '';
  return `
    <div class="record-row" data-id="${escapeHTML(r.id)}">
      <div class="record-icon">${icon('fuel')}</div>
      <div class="record-main">
        <div class="record-title">${r.fullTank ? 'Plein complet' : 'Plein partiel'} ${consumptionBadge}</div>
        <div class="record-sub">${sub}</div>
        ${consumptionIssue}
      </div>
      <div class="record-cost">${r.cost ? money(r.cost) : ''}</div>
    </div>
  `;
}

function odoRow(r) {
  return `
    <div class="record-row" data-id="${escapeHTML(r.id)}">
      <div class="record-icon">${icon('gauge')}</div>
      <div class="record-main">
        <div class="record-title">${km(r.odometer)}</div>
        <div class="record-sub">${fmtDate(r.date)}${r.notes ? ' · ' + escapeHTML(r.notes) : ''}</div>
      </div>
    </div>
  `;
}

function openForm(existing, onDone) {
  const content = openModal(`
    <div class="modal-header">
      <h2>${existing ? 'Modifier le plein' : 'Nouveau plein'}</h2>
      <button class="icon-btn" id="modal-close" aria-label="Fermer la fenêtre">${icon('close')}</button>
    </div>
    <form id="fuel-form" class="form">
      <label>Date
        <input type="date" name="date" value="${escapeHTML(existing?.date || todayISO())}" required />
      </label>
      <label>Kilométrage
        <input type="text" inputmode="decimal" name="odometer" value="${escapeHTML(existing?.odometer ?? '')}" required />
      </label>
      <label>Litres
        <input type="text" inputmode="decimal" name="liters" value="${escapeHTML(existing?.liters ?? '')}" required />
      </label>
      <label>Coût total ($)
        <input type="text" inputmode="decimal" name="cost" value="${escapeHTML(existing?.cost ?? '')}" required />
      </label>
      <label class="checkbox-label">
        <input type="checkbox" name="fullTank" ${existing?.fullTank !== false ? 'checked' : ''} />
        Plein complet (nécessaire pour calculer la consommation)
      </label>
      <label>Notes
        <input type="text" name="notes" value="${escapeHTML(existing?.notes || '')}" placeholder="optionnel" />
      </label>
      <div class="form-actions">
        <button type="submit" class="btn-primary">Enregistrer</button>
        ${existing ? '<button type="button" id="btn-delete" class="btn-danger">Supprimer</button>' : ''}
      </div>
    </form>
  `);

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('fuel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const dateIsValid = validateDateField(form, 'date', { label: 'La date', required: true, max: todayISO() });
    const odometer = validateNumberField(form, 'odometer', { label: 'Le kilométrage', required: true, min: 0 });
    const liters = validateNumberField(form, 'liters', { label: 'Le nombre de litres', required: true, min: 0.01 });
    const cost = validateNumberField(form, 'cost', { label: 'Le coût total', required: true, min: 0.01 });
    if (!dateIsValid || !odometer.valid || !liters.valid || !cost.valid) {
      form.reportValidity();
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    try {
      if (!(await confirmOlderOdometer(odometer.value, existing?.id))) return;
      const fd = new FormData(form);
      const record = {
        type: 'fuel',
        date: fd.get('date'),
        odometer: odometer.value,
        liters: liters.value,
        cost: cost.value,
        fullTank: fd.get('fullTank') === 'on',
        notes: fd.get('notes')?.trim() || '',
      };
      if (existing) {
        record.id = existing.id;
        await DB.updateRecord(record);
      } else {
        await DB.addRecord(record);
      }
      closeModal();
      toast('Plein enregistré');
      onDone();
    } catch (err) {
      console.error('Enregistrement du plein échoué :', err);
      toast("Impossible d'enregistrer le plein. Réessaie.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  });

  if (existing) {
    document.getElementById('btn-delete').addEventListener('click', async () => {
      if (!window.confirm('Supprimer ce plein ? Cette action est irréversible.')) return;
      try {
        await DB.deleteRecord(existing.id);
        closeModal();
        toast('Plein supprimé');
        onDone();
      } catch (err) {
        console.error('Suppression du plein échouée :', err);
        toast("Impossible de supprimer le plein. Réessaie.");
      }
    });
  }
}

// Relevé de kilométrage autonome, non lié à un plein — même type d'entrée
// (`odometer`) que l'ancien onglet Kilométrage, pour continuer d'alimenter
// le kilométrage actuel du tableau de bord et la distance des rapports.
function openOdometerForm(existing, onDone) {
  const content = openModal(`
    <div class="modal-header">
      <h2>${existing ? 'Modifier le relevé' : 'Nouveau relevé de kilométrage'}</h2>
      <button class="icon-btn" id="modal-close" aria-label="Fermer la fenêtre">${icon('close')}</button>
    </div>
    <form id="odo-form" class="form">
      <label>Date
        <input type="date" name="date" value="${escapeHTML(existing?.date || todayISO())}" required />
      </label>
      <label>Kilométrage
        <input type="text" inputmode="decimal" name="odometer" value="${escapeHTML(existing?.odometer ?? '')}" required />
      </label>
      <label>Notes
        <input type="text" name="notes" value="${existing ? escapeHTML(existing.notes || '') : ''}" placeholder="optionnel" />
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
    const form = e.target;
    const dateIsValid = validateDateField(form, 'date', { label: 'La date', required: true, max: todayISO() });
    const odometer = validateNumberField(form, 'odometer', { label: 'Le kilométrage', required: true, min: 0 });
    if (!dateIsValid || !odometer.valid) {
      form.reportValidity();
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    try {
      if (!(await confirmOlderOdometer(odometer.value, existing?.id))) return;
      const fd = new FormData(form);
      const record = {
        type: 'odometer',
        date: fd.get('date'),
        odometer: odometer.value,
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
    } catch (err) {
      console.error('Enregistrement du relevé échoué :', err);
      toast("Impossible d'enregistrer le relevé. Réessaie.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  });

  if (existing) {
    document.getElementById('btn-delete').addEventListener('click', async () => {
      if (!window.confirm('Supprimer ce relevé de kilométrage ? Cette action est irréversible.')) return;
      try {
        await DB.deleteRecord(existing.id);
        closeModal();
        toast('Relevé supprimé');
        onDone();
      } catch (err) {
        console.error('Suppression du relevé échouée :', err);
        toast("Impossible de supprimer le relevé. Réessaie.");
      }
    });
  }
}
