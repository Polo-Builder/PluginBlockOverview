// Aucun cookie réécrit : laisser le gestionnaire du site enregistrer le refus natif.
(() => {
  const controls = 'button, a, input[type="button"], input[type="submit"], [role="button"]';
  const knownReject = '#onetrust-reject-all-handler, #CybotCookiebotDialogBodyButtonDecline, .cmplz-deny, #didomi-notice-disagree-button, .qc-cmp2-summary-buttons button[mode="secondary"]';
  const normalize = (text) => (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  // Libellés entiers uniquement : ne jamais confondre refus, acceptation et réglages.
  const rejectLabel = /^(?:(?:tout refuser|refuser tout|refuser|je refuse|continuer sans accepter|reject all|reject all cookies|reject|decline all|decline|deny all|alle ablehnen|ablehnen|rechazar todo|rechazar todas|rechazar|rifiuta tutti|rifiuta)(?: les cookies| cookies)?|(?:accepter uniquement|autoriser uniquement|only allow|accept only) (?:les cookies necessaires|les cookies essentiels|necessary cookies|essential cookies)|only necessary(?: cookies)?|necessary cookies only)[.!]?$/;
  const cookieContext = /\b(cookie|cookies|consentement|consent|confidentialite|privacy|datenschutz)\b/;
  const clicked = new WeakSet();
  let enabled = false;
  let timer = null;
  const pending = new Set();

  function isReject(button) {
    if (button.matches(knownReject)) {
      // Quantcast utilise aussi ce style pour d'autres actions selon sa configuration.
      if (!button.matches('.qc-cmp2-summary-buttons button[mode="secondary"]')) return true;
    }
    const label = normalize(button.getAttribute('aria-label') || button.textContent || button.value);
    if (!rejectLabel.test(label)) return false;
    // Limiter le contexte au panneau local, pas à tout le texte de la page.
    for (let parent = button.parentElement, depth = 0; parent && parent !== document.body && depth < 5; parent = parent.parentElement, depth++) {
      const text = parent.textContent || '';
      if (text.length <= 12000 && cookieContext.test(normalize(text))) return true;
    }
    return false;
  }

  function scan(root) {
    const buttons = [...(root.matches?.(controls) ? [root] : []), ...root.querySelectorAll(controls)];
    for (const button of buttons) {
      if (!enabled || !button.isConnected || clicked.has(button) || button.disabled || button.getAttribute('aria-disabled') === 'true' || !isReject(button)) continue;
      if (!button.getClientRects().length || button.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
      const style = getComputedStyle(button);
      if (style.visibility !== 'visible' || style.opacity === '0') continue;
      clicked.add(button);
      button.click();
    }
  }

  function schedule(root) {
    if (!enabled || !root?.querySelectorAll) return;
    pending.add(root);
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      const roots = [...pending];
      pending.clear();
      for (const node of roots) {
        if (node.isConnected && !roots.some((other) => other !== node && other.contains(node))) scan(node);
      }
    }, 100);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) schedule(node.nodeType === 1 ? node : node.parentElement);
      } else schedule(record.target.nodeType === 1 ? record.target : record.target.parentElement);
    }
  });
  function configure(state) {
    const next = (state?.enabled ?? true) && (state?.autoDenyCookies ?? true);
    if (next === enabled) return;
    enabled = next;
    observer.disconnect();
    clearTimeout(timer);
    timer = null;
    pending.clear();
    if (enabled) {
      observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'aria-hidden', 'disabled', 'aria-disabled'] });
      schedule(document.documentElement);
    }
  }
  let changed = false;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.state) { changed = true; configure(changes.state.newValue); }
  });
  chrome.storage.local.get('state', ({ state }) => { if (!changed) configure(state); });
})();
