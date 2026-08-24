import { DB } from '../db.js';
import { money, km, fmtDate, todayISO, TYPE_LABELS, downloadFile } from '../utils.js';

const PERIODS = [
  { value: 'month', label: 'Ce mois-ci' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Personnalisé' },
];

let activePeriod = 'month';
let customStart = '';
let customEnd = '';

function periodRange(period) {
  const now = new Date();
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = todayISO();
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const end = todayISO();
    return { start, end };
  }
  if (period === 'custom') {
    return { start: customStart || '0000-01-01', end: customEnd || todayISO() };
  }
  return { start: '0000-01-01', end: '9999-12-31' };
}

export async function renderReports(container) {
  const [vehicle, all] = await Promise.all([DB.getVehicle(), DB.getAllRecords()]);
  const { start, end } = periodRange(activePeriod);
  const filtered = all.filter((r) => r.date >= start && r.date <= end);

  const byType = {};
  filtered.forEach((r) => {
    byType[r.type] = byType[r.type] || [];
    byType[r.type].push(r);
  });

  const totalCost = filtered.reduce((s, r) => s + (r.cost || 0), 0);
  const odoInPeriod = filtered.map((r) => r.odometer).filter((v) => typeof v === 'number');
  const distance = odoInPeriod.length >= 2 ? Math.max(...odoInPeriod) - Math.min(...odoInPeriod) : null;

  container.innerHTML = `
    <div class="view-header">
      <h1>Rapports</h1>
    </div>
    <div class="chip-row">
      ${PERIODS.map((p) => `<button class="chip${activePeriod === p.value ? ' active' : ''}" data-value="${p.value}">${p.label}</button>`).join('')}
    </div>
    ${activePeriod === 'custom' ? `
      <div class="form form-inline">
        <label>Du <input type="date" id="custom-start" value="${customStart}" /></label>
        <label>Au <input type="date" id="custom-end" value="${customEnd}" /></label>
      </div>
    ` : ''}

    <div class="summary-line">Période : ${fmtDate(start)} → ${fmtDate(end)}</div>

    <div class="stat-grid stat-grid-3">
      <div class="stat-card">
        <div class="stat-label">Total investi</div>
        <div class="stat-value stat-value-sm">${money(totalCost)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Distance</div>
        <div class="stat-value stat-value-sm">${distance !== null ? km(distance) : '—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Entrées</div>
        <div class="stat-value stat-value-sm">${filtered.length}</div>
      </div>
    </div>

    <div class="breakdown">
      ${Object.entries(TYPE_LABELS).map(([type, label]) => {
        const items = byType[type] || [];
        const sum = items.reduce((s, r) => s + (r.cost || 0), 0);
        return `<div class="breakdown-row"><span>${label}</span><span>${items.length} · ${money(sum)}</span></div>`;
      }).join('')}
    </div>

    <div class="report-actions">
      <button class="btn-primary" id="btn-print">📄 Générer le rapport imprimable</button>
      <button class="btn-secondary" id="btn-csv">⬇️ Exporter en CSV</button>
    </div>
  `;

  container.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => {
      activePeriod = c.dataset.value;
      renderReports(container);
    });
  });

  const startInput = document.getElementById('custom-start');
  const endInput = document.getElementById('custom-end');
  if (startInput) startInput.addEventListener('change', (e) => { customStart = e.target.value; renderReports(container); });
  if (endInput) endInput.addEventListener('change', (e) => { customEnd = e.target.value; renderReports(container); });

  document.getElementById('btn-print').addEventListener('click', () => printReport(vehicle, filtered, start, end, totalCost, distance));
  document.getElementById('btn-csv').addEventListener('click', () => exportCSV(filtered, start, end));
}

function printReport(vehicle, records, start, end, totalCost, distance) {
  const printRoot = document.getElementById('print-root');
  const vehicleName = vehicle?.nickname || [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || 'Ma van';
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  printRoot.innerHTML = `
    <h1>Rapport — ${vehicleName}</h1>
    <p>Période : ${fmtDate(start)} au ${fmtDate(end)}</p>
    <p><strong>Total investi :</strong> ${money(totalCost)} &nbsp; <strong>Distance parcourue :</strong> ${distance !== null ? km(distance) : '—'}</p>
    <table>
      <thead>
        <tr><th>Date</th><th>Type</th><th>Description</th><th>Km</th><th>Coût</th></tr>
      </thead>
      <tbody>
        ${sorted.map((r) => `
          <tr>
            <td>${fmtDate(r.date)}</td>
            <td>${TYPE_LABELS[r.type] || r.type}</td>
            <td>${r.description || r.name || r.notes || (r.type === 'fuel' ? (r.liters ? r.liters.toFixed(1) + ' L' : '') : '')}</td>
            <td>${typeof r.odometer === 'number' ? r.odometer.toLocaleString('fr-CA') : ''}</td>
            <td>${r.cost ? money(r.cost) : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="print-footer">Généré le ${fmtDate(todayISO())} — Carnet de Van</p>
  `;

  document.body.classList.add('printing');
  window.print();
  setTimeout(() => document.body.classList.remove('printing'), 500);
}

function exportCSV(records, start, end) {
  const headers = ['Date', 'Type', 'Description', 'Kilométrage', 'Coût', 'Litres', 'Catégorie', 'Fournisseur', 'Notes'];
  const rows = [...records].sort((a, b) => a.date.localeCompare(b.date)).map((r) => [
    r.date,
    TYPE_LABELS[r.type] || r.type,
    r.description || r.name || r.notes || '',
    typeof r.odometer === 'number' ? r.odometer : '',
    r.cost ?? '',
    r.liters ?? '',
    r.category || '',
    r.vendor || '',
    (r.notes || '').replace(/\n/g, ' '),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const filename = `carnet-van_${start}_${end}.csv`;
  downloadFile(filename, '﻿' + csv, 'text/csv;charset=utf-8');
}
