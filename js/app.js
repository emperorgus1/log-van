import { renderDashboard } from './views/dashboard.js';
import { renderOdometer } from './views/odometer.js';
import { renderExpenses } from './views/expenses.js';
import { renderFuel } from './views/fuel.js';
import { renderReports } from './views/reports.js';

const routes = {
  dashboard: { render: renderDashboard, label: 'Accueil', icon: '🏠' },
  odometer: { render: renderOdometer, label: 'Kilométrage', icon: '🧭' },
  expenses: { render: renderExpenses, label: 'Entretien', icon: '🔧' },
  fuel: { render: renderFuel, label: 'Essence', icon: '⛽' },
  reports: { render: renderReports, label: 'Rapports', icon: '📄' },
};

const view = document.getElementById('view');
const nav = document.getElementById('bottom-nav');

function buildNav(active) {
  nav.innerHTML = Object.entries(routes).map(([key, r]) => `
    <button class="nav-item${key === active ? ' active' : ''}" data-route="${key}">
      <span class="nav-icon">${r.icon}</span>
      <span class="nav-label">${r.label}</span>
    </button>
  `).join('');
  nav.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });
}

async function navigate(key) {
  if (!routes[key]) key = 'dashboard';
  location.hash = key;
  buildNav(key);
  view.scrollTop = 0;
  await routes[key].render(view);
}

window.addEventListener('hashchange', () => {
  const key = location.hash.replace('#', '') || 'dashboard';
  navigate(key);
});

const initial = location.hash.replace('#', '') || 'dashboard';
navigate(initial);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
