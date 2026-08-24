export function money(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}

export function km(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-CA') + ' km';
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const TYPE_LABELS = {
  odometer: 'Relevé de kilométrage',
  fuel: 'Essence',
  maintenance: 'Entretien',
  part: 'Pièce achetée',
  renovation: 'Aménagement',
  place: 'Endroit visité',
};

export const TYPE_ICONS = {
  odometer: '🧭',
  fuel: '⛽',
  maintenance: '🔧',
  part: '🧩',
  renovation: '🛠️',
  place: '📍',
};

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg) {
  const container = document.getElementById('toast-container');
  const t = el(`<div class="toast">${escapeHTML(msg)}</div>`);
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

export function openModal(innerHTML) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = innerHTML;
  overlay.classList.add('open');
  return content;
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('open');
  document.getElementById('modal-content').innerHTML = '';
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
