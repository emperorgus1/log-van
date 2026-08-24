import { renderDashboard } from './views/dashboard.js';
import { renderExpenses } from './views/expenses.js';
import { renderFuel } from './views/fuel.js';
import { renderPlaces } from './views/places.js';
import { renderReports } from './views/reports.js';
import { auth, provider, onAuthStateChanged, signInWithPopup } from './firebase.js';

const routes = {
  dashboard: { render: renderDashboard, label: 'Accueil', icon: '🏠' },
  fuel: { render: renderFuel, label: 'Essence', icon: '⛽' },
  places: { render: renderPlaces, label: 'Endroits', icon: '📍' },
  expenses: { render: renderExpenses, label: 'Entretien', icon: '🔧' },
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

function renderLogin() {
  nav.innerHTML = '';
  view.innerHTML = `
    <div class="login-screen">
      <div class="login-icon">🚐</div>
      <h1>Carnet de Van</h1>
      <p>Connecte-toi pour accéder à tes données, synchronisées entre tous tes appareils.</p>
      <button id="btn-login" class="btn-primary">Se connecter avec Google</button>
      <p id="login-error" class="login-error"></p>
    </div>
  `;
  document.getElementById('btn-login').addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      document.getElementById('login-error').textContent = "La connexion a échoué — réessaie.";
      console.error(err);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    const initial = location.hash.replace('#', '') || 'dashboard';
    navigate(initial);
  } else {
    renderLogin();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
