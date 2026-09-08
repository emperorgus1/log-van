import { DB } from '../db.js';
import { money, km, fmtDate, TYPE_ICONS, toast } from '../utils.js';
import { auth, signOut } from '../firebase.js';
import { hasLegacyData, migrateLegacyData } from '../migrate.js';
import { icon } from '../icons.js';
import { fuelConsumptionIntervals, totalAverageConsumption } from '../fuel-consumption.js';

function computeCurrentOdometer(records, vehicle) {
  const readings = records.map((r) => r.odometer).filter((v) => typeof v === 'number');
  const max = readings.length ? Math.max(...readings) : null;
  const purchase = vehicle && typeof vehicle.purchaseOdometer === 'number' ? vehicle.purchaseOdometer : null;
  if (max === null) return purchase;
  if (purchase === null) return max;
  return Math.max(max, purchase);
}

export async function renderDashboard(container) {
  const [vehicle, records] = await Promise.all([DB.getVehicle(), DB.getAllRecords()]);

  let legacy = null;
  if (records.length === 0 && !localStorage.getItem('vanlog_migrated')) {
    legacy = await hasLegacyData();
    if (!legacy) localStorage.setItem('vanlog_migrated', '1');
  }
  const migrationBanner = legacy ? `
    <div class="banner">
      <p>Des données ont été trouvées sur cet appareil, enregistrées avant la synchronisation entre appareils.</p>
      <button id="btn-migrate" class="btn-primary">Importer mes données locales</button>
    </div>
  ` : '';

  const currentOdometer = computeCurrentOdometer(records, vehicle);
  const distanceTraveled = vehicle && typeof vehicle.purchaseOdometer === 'number' && currentOdometer !== null
    ? currentOdometer - vehicle.purchaseOdometer
    : null;

  const totalInvested = records.reduce((sum, r) => sum + (r.cost || 0), 0);
  const fuelRecords = records.filter((r) => r.type === 'fuel');
  const totalFuelCost = fuelRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const consumption = totalAverageConsumption(fuelRecords);
  const monthlyExpenses = expensesByMonth(records);
  const consumptionTrend = consumptionHistory(fuelRecords);

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
      <div class="header-actions">
        <button class="icon-btn" id="btn-settings" title="Profil du véhicule" aria-label="Ouvrir le profil du véhicule">${icon('settings')}</button>
        <button class="icon-btn" id="btn-signout" title="Déconnexion" aria-label="Se déconnecter">${icon('logout')}</button>
      </div>
    </div>

    ${migrationBanner}

    <div class="dashboard-primary">
      <div class="stat-card stat-card-hero">
        <div class="stat-label">Kilométrage actuel</div>
        <div class="stat-value">${km(currentOdometer)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Coût total en essence</div>
        <div class="stat-value">${money(totalFuelCost)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Consommation moyenne totale</div>
        <div class="stat-value">${consumption !== null ? consumption.toFixed(1) + ' L/100km' : '—'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dernier entretien</div>
        <div class="stat-value stat-value-sm">${lastMaintenance ? fmtDate(lastMaintenance.date) : '—'}</div>
      </div>
    </div>

    <div class="dashboard-secondary">
      <div class="stat-card">
        <div class="stat-label">Total investi</div>
        <div class="stat-value">${money(totalInvested)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Distance depuis l'achat</div>
        <div class="stat-value">${distanceTraveled !== null ? km(distanceTraveled) : '—'}</div>
      </div>
    </div>

    <section class="dashboard-insights" aria-labelledby="insights-title">
      <h2 class="section-title" id="insights-title">Aperçu</h2>
      <div class="chart-grid">
        ${barChart('Dépenses par mois', monthlyExpenses, money, 'Aucune dépense enregistrée au cours des six derniers mois.')}
        ${barChart('Consommation récente', consumptionTrend, (value) => `${value.toFixed(1)} L/100km`, 'Ajoute deux pleins complets pour afficher la consommation.')}
      </div>
    </section>

    <h2 class="section-title">Activité récente</h2>
    <div class="record-list">
      ${recent.length ? recent.map(recordRow).join('') : '<p class="empty-state">Aucune entrée pour le moment. Ajoute ton premier relevé !</p>'}
    </div>
  `;

  document.getElementById('btn-settings').addEventListener('click', async () => {
    const { openVehicleModal } = await import('./vehicle.js');
    openVehicleModal(() => renderDashboard(container));
  });

  document.getElementById('btn-signout').addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Déconnexion échouée :', err);
      toast('Impossible de se déconnecter. Réessaie.');
    }
  });

  if (legacy) {
    document.getElementById('btn-migrate').addEventListener('click', async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Importation…';
      try {
        const count = await migrateLegacyData(DB);
        localStorage.setItem('vanlog_migrated', '1');
        toast(`${count} entrée(s) importée(s)`);
        renderDashboard(container);
      } catch (err) {
        console.error('Importation des données locales échouée :', err);
        toast("Impossible d'importer les données. Réessaie.");
        e.target.disabled = false;
        e.target.textContent = 'Importer mes données locales';
      }
    });
  }
}

function escapeName(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function recordRow(r) {
  const icon = TYPE_ICONS[r.type] || '•';
  const title = r.description || r.name || labelFor(r.type);
  const distanceLabel = typeof r.distanceFromHomeKm === 'number' ? `${Math.round(r.distanceFromHomeKm)} km de la maison` : null;
  const sub = [fmtDate(r.date), typeof r.odometer === 'number' ? km(r.odometer) : null, distanceLabel].filter(Boolean).join(' · ');
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
  const map = { odometer: 'Relevé de kilométrage', fuel: 'Plein d\'essence', maintenance: 'Entretien', part: 'Pièce achetée', renovation: 'Aménagement', place: 'Endroit visité' };
  return map[type] || type;
}

function expensesByMonth(records) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: date.toLocaleDateString('fr-CA', { month: 'short' }).replace('.', ''),
      value: 0,
    };
  });
  const byMonth = new Map(months.map((month) => [month.key, month]));
  records.forEach((record) => {
    const month = byMonth.get(record.date?.slice(0, 7));
    if (month && typeof record.cost === 'number' && record.cost > 0) month.value += record.cost;
  });
  return months;
}

function consumptionHistory(fuelRecords) {
  return fuelConsumptionIntervals(fuelRecords).slice(-6).map((interval) => ({
    label: fmtDate(interval.record.date),
    value: interval.consumption,
  }));
}

function barChart(title, items, formatValue, emptyText) {
  const max = Math.max(...items.map((item) => item.value), 0);
  if (max === 0) {
    return `
      <section class="dashboard-chart" aria-label="${title}">
        <h3>${title}</h3>
        <p class="chart-empty">${emptyText}</p>
      </section>
    `;
  }
  const bars = items.map((item) => {
    const height = Math.max(6, Math.round((item.value / max) * 100));
    return `
      <div class="chart-column" title="${item.label} : ${formatValue(item.value)}">
        <span class="chart-value">${formatValue(item.value)}</span>
        <div class="chart-bar-track" aria-hidden="true"><div class="chart-bar" style="--bar-height: ${height}%"></div></div>
        <span class="chart-label">${item.label}</span>
      </div>
    `;
  }).join('');
  return `
    <section class="dashboard-chart" aria-label="${title}">
      <h3>${title}</h3>
      <div class="chart-columns">${bars}</div>
    </section>
  `;
}
