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
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
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

export function parseDecimal(str) {
  if (str === null || str === undefined) return NaN;
  return Number(String(str).trim().replace(',', '.'));
}

// Valide les champs numériques saisis en texte pour permettre aussi la virgule.
// Le résultat conserve la valeur numérique, prête à être enregistrée dans Firebase.
export function validateNumberField(form, name, options = {}) {
  const {
    label = 'Cette valeur',
    required = false,
    min = null,
    max = null,
    integer = false,
  } = options;
  const input = form.elements[name];
  const raw = input.value.trim();
  input.setCustomValidity('');

  if (!raw) {
    if (required) {
      input.setCustomValidity(`${label} est obligatoire.`);
      return { valid: false, value: null };
    }
    return { valid: true, value: null };
  }

  const value = parseDecimal(raw);
  if (!Number.isFinite(value)) {
    input.setCustomValidity(`${label} doit être un nombre valide.`);
    return { valid: false, value: null };
  }
  if (integer && !Number.isInteger(value)) {
    input.setCustomValidity(`${label} doit être un nombre entier.`);
    return { valid: false, value: null };
  }
  if (min !== null && value < min) {
    input.setCustomValidity(`${label} doit être supérieur ou égal à ${min}.`);
    return { valid: false, value: null };
  }
  if (max !== null && value > max) {
    input.setCustomValidity(`${label} doit être inférieur ou égal à ${max}.`);
    return { valid: false, value: null };
  }
  return { valid: true, value };
}

export function validateDateField(form, name, options = {}) {
  const { label = 'La date', required = false, max = null } = options;
  const input = form.elements[name];
  const value = input.value;
  input.setCustomValidity('');

  if (!value) {
    if (required) {
      input.setCustomValidity(`${label} est obligatoire.`);
      return false;
    }
    return true;
  }
  if (max && value > max) {
    input.setCustomValidity(`${label} ne peut pas être dans le futur.`);
    return false;
  }
  return true;
}

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
  const t = el(`<div class="toast" role="status" aria-live="polite">${escapeHTML(msg)}</div>`);
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
