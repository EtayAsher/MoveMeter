window.KTUI = (() => {
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function toast(message, type = 'info') {
    const host = ensureToastHost();
    const node = document.createElement('div');
    node.className = `toast toast-${type}`;
    node.textContent = message;
    host.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    window.setTimeout(() => {
      node.classList.remove('show');
      window.setTimeout(() => node.remove(), 260);
    }, 2400);
  }

  function ensureToastHost() {
    let host = qs('#toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function formatDistance(distanceKm) {
    if (distanceKm == null || Number.isNaN(distanceKm)) return '';
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
    return `${distanceKm.toFixed(1)} km`;
  }

  function normalizeWebsite(url) {
    if (!url) return '';
    const raw = String(url).trim();
    if (!raw) return '';
    const prefixed = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
      const parsed = new URL(prefixed);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      const host = parsed.hostname.toLowerCase();
      if (!host || host === 'localhost' || host.endsWith('.localhost')) return '';
      const blocked = ['example.com', 'example.org', 'example.net'];
      if (blocked.includes(host) || blocked.some((domain) => host.endsWith(`.${domain}`))) return '';
      return parsed.href;
    } catch (_error) {
      return '';
    }
  }

  function categoryLabel(category) {
    return {
      restaurant: 'Kosher Restaurants',
      grocery: 'Kosher Groceries',
      chabad: 'Chabad Houses'
    }[category] || category;
  }

  function debounce(fn, delay = 180) {
    let timeout;
    return (...args) => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => fn(...args), delay);
    };
  }

  return { qs, qsa, toast, formatDistance, normalizeWebsite, categoryLabel, debounce };
})();
