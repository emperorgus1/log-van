import { renderDashboard } from './views/dashboard.js';
import { renderExpenses } from './views/expenses.js';
import { renderFuel } from './views/fuel.js';
import { renderPlaces } from './views/places.js';
import { renderReports } from './views/reports.js';
import { auth, provider, onAuthStateChanged, signInWithPopup } from './firebase.js';
import { DB } from './db.js';

const routes = {
  dashboard: { render: renderDashboard, label: 'Accueil', icon: '🏠' },
  fuel: { render: renderFuel, label: 'Essence', icon: '⛽' },
  places: { render: renderPlaces, label: 'Endroits', icon: '📍' },
  expenses: { render: renderExpenses, label: 'Entretien', icon: '🔧' },
  reports: { render: renderReports, label: 'Rapports', icon: '📄' },
};

const view = document.getElementById('view');
const nav = document.getElementById('bottom-nav');
const connectionStatus = document.getElementById('connection-status');
let stopSyncListener = null;
let syncRefreshTimer = null;

function updateConnectionStatus() {
  const offline = !navigator.onLine;
  connectionStatus.hidden = !offline;
  connectionStatus.textContent = offline
    ? 'Hors ligne — les données déjà chargées restent disponibles. Les nouvelles modifications seront synchronisées au retour de la connexion.'
    : '';
}

window.addEventListener('online', () => {
  updateConnectionStatus();
  toast('Connexion rétablie.');
});
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

function buildNav(active) {
  nav.innerHTML = Object.entries(routes).map(([key, r]) => `
    <a class="nav-item${key === active ? ' active' : ''}" href="#${key}" aria-label="${r.label}"${key === active ? ' aria-current="page"' : ''}>
      <span class="nav-icon">${r.icon}</span>
      <span class="nav-label">${r.label}</span>
    </a>
  `).join('');
}

function showLoading() {
  view.innerHTML = '<p class="status-message" role="status">Chargement…</p>';
}

function showLoadError(key) {
  view.innerHTML = `
    <div class="status-message status-error" role="alert">
      <p>Impossible de charger cette page. Vérifie ta connexion puis réessaie.</p>
      <button class="btn-secondary" id="btn-retry">Réessayer</button>
    </div>
  `;
  document.getElementById('btn-retry').addEventListener('click', () => navigate(key, false));
}

function startSyncListener() {
  if (stopSyncListener) stopSyncListener();
  stopSyncListener = DB.subscribeToChanges(() => {
    // Regroupe les changements reçus presque simultanément de Firestore.
    clearTimeout(syncRefreshTimer);
    syncRefreshTimer = setTimeout(() => {
      const key = location.hash.replace('#', '') || 'dashboard';
      navigate(key, false);
      toast('Données mises à jour depuis un autre appareil.');
    }, 250);
  });
}

async function navigate(key, updateHash = true) {
  if (!routes[key]) key = 'dashboard';
  if (updateHash && location.hash !== `#${key}`) {
    location.hash = key;
    return;
  }
  buildNav(key);
  view.scrollTop = 0;
  showLoading();
  try {
    await routes[key].render(view);
  } catch (err) {
    console.error('Chargement de la page échoué :', err);
    showLoadError(key);
  }
}

window.addEventListener('hashchange', () => {
  const key = location.hash.replace('#', '') || 'dashboard';
  navigate(key, false);
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
    startSyncListener();
  } else {
    if (stopSyncListener) stopSyncListener();
    stopSyncListener = null;
    renderLogin();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
