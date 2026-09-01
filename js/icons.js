// Icônes SVG locales : aucun service externe et un rendu identique sur les appareils.
export function icon(name, className = '') {
  return `<svg class="ui-icon ${className}" aria-hidden="true" focusable="false"><use href="./icons/ui.svg#${name}"></use></svg>`;
}
