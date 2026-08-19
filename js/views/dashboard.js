import { DB } from '../db.js';
import { money, km, fmtDate, TYPE_ICONS } from '../utils.js';

function computeCurrentOdometer(records, vehicle) {
  const readings = records.map((r) => r.odometer).filter((v) => typeof v === 'number');
  const max = readings.length ? Math.max(...readings) : null;
  const purchase = vehicle && typeof vehicle.purchaseOdometer === 'number' ? vehicle.purchaseOdometer : null;
  if (max === null) return purchase;
  if (purchase === null) return max;
  return Math.max(max, purchase);
}

function lastFuelConsumption(fuelRecords) {
  const full = fuelRecords.filter((r) => typeof r.odometer === 'number').sort((a, b) => a.odometer - b.odometer);
  const fullTankIdx = [];
  full.forEach((r, i) => { if (r.fullTank) fullTankIdx.push(i); });
  if (fullTankIdx.length < 2) return null;
  const last = full[fullTankIdx[fullTankIdx.length - 1]];
  const prevFull = full[fullTankIdx[fullTankIdx.length - 2]];
  const distance = last.odometer - prevFull.odometer;
  if (distance <= 0) return null;
  // Somme des litres consommés entre les deux pleins (incluant les pleins partiels entre les deux)
  const between = full.filter((r) => r.odometer > prevFull.odometer && r.odometer <= last.odometer);
  const liters = between.reduce((sum, r) => sum + (r.liters || 0), 0);
  if (liters <= 0) return null;
  return (liters / distance) * 100;
}

export async function renderDashboard(container) {
  const [vehicle, records] = await Promise.all([DB.getVehicle(), DB.getAllRecords()]);

  const currentOdometer = computeCurrentOdometer(records, vehicle);
  const distanceTraveled = vehicle && typeof vehicle.purchaseOdometer === 'number' && currentOdometer !== null
    ? currentOdometer - vehicle.purchaseOdometer
    : null;

  const totalInvested = records.reduce((sum, r) => sum + (r.cost || 0), 0);
  const fuelRecords = records.filter((r) => r.type === 'fuel');
  const totalFuelCost = fuelRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const consumption = lastFuelConsumption(fuelRecords);

  const lastByType = (type) => {
    const items = records.filter((r) => r.type === type);
    return items.length ? items[items.length - 1] : null;
  };
  const lastMaintenance = lastByType('maintenance');
  const lastFuel = lastByType('fuel');

  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  container.innerHTML = `
    <div class="view-header">
      <h1>${vehicle && vehicle.nickname ? escapeName(vehicle.nickname) : 'Ma van'}</h1>
      <button class="icon-btn" id="btn-settings" title="Profil du véhicule">⚙️</button>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Kilométrage actuel</div>
        <div class="stat-value">${km(currentOdometer)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Distance parcourue</div>
        <div class="stat-value">${distanceTraveled !== null ? km(distanceTraveled) : '—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total investi</div>
        <div class="stat-value">${money(totalInvested)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Consommation moy.</div>
        <div class="stat-value">${consumption !== null ? consumption.toFixed(1) + ' L/100km' : '—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total essence</div>
        <div class="stat-value">${money(totalFuelCost)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dernier entretien</div>
        <div class="stat-value stat-value-sm">${lastMaintenance ? fmtDate(lastMaintenance.date) : '—'}</div>
      </div>
    </div>

    <h2 class="section-title">Activité récente</h2>
    <div class="record-list">
      ${recent.length ? recent.map(recordRow).join('') : '<p class="empty-state">Aucune entrée pour le moment. Ajoute ton premier relevé !</p>'}
    </div>
  `;

  document.getElementById('btn-settings').addEventListener('click', async () => {
    const { openVehicleModal } = await import('./vehicle.js');
    openVehicleModal(() => renderDashboard(container));
  });
}

function escapeName(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function recordRow(r) {
  const icon = TYPE_ICONS[r.type] || '•';
  const title = r.description || labelFor(r.type);
  const sub = [fmtDate(r.date), typeof r.odometer === 'number' ? km(r.odometer) : null].filter(Boolean).join(' · ');
  return `
    <div class="record-row">
      <div class="record-icon">${icon}</div>
      <div class="record-main">
        <div class="record-title">${escapeName(title)}</div>
        <div class="record-sub">${sub}</div>
      </div>
      <div class="record-cost">${r.cost ? money(r.cost) : ''}</div>
    </div>
  `;
}

function labelFor(type) {
  const map = { odometer: 'Relevé de kilométrage', fuel: 'Plein d\'essence', maintenance: 'Entretien', part: 'Pièce achetée', renovation: 'Aménagement' };
  return map[type] || type;
}
