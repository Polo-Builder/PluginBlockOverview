import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Features/AutoDenyCookies/content.js', import.meta.url), 'utf8');
function setup(state = {}, context = 'Nous utilisons des cookies') {
  let changed, mutated, task, observing = false;
  const buttons = [];
  const body = {};
  const panel = { textContent: context, parentElement: body };
  const root = { isConnected: true, querySelectorAll: () => buttons, contains: node => buttons.includes(node) };
  vm.runInNewContext(source, {
    document: { body, documentElement: root },
    chrome: { storage: {
      local: { get: (_, cb) => cb({ state }) },
      onChanged: { addListener: fn => { changed = fn; } }
    } },
    setTimeout: fn => { task = fn; return 1; }, clearTimeout: () => { task = null; },
    getComputedStyle: () => ({ visibility: 'visible', opacity: '1' }),
    MutationObserver: class {
      constructor(fn) { mutated = fn; }
      observe() { observing = true; }
      disconnect() { observing = false; }
    }
  });
  return {
    add(text, options = {}) {
      const button = {
        textContent: text, parentElement: panel, isConnected: true, clicks: 0,
        matches: selector => selector.startsWith('button,') || (options.known && selector.includes('#onetrust')),
        querySelectorAll: () => [], contains: () => false,
        getAttribute: () => null, getClientRects: () => options.hidden ? [] : [{}],
        closest: () => null, click() { this.clicks++; }, ...options
      };
      buttons.push(button);
      return button;
    },
    flush() { const run = task; task = null; run?.(); },
    change(next) { changed({ state: { newValue: next } }, 'local'); },
    mutate() { if (observing) mutated([{ type: 'childList', addedNodes: [{ ...root, nodeType: 1 }] }]); },
    get observing() { return observing; }
  };
}

test('refuse les choix explicites, jamais accepter, régler ou fermer', () => {
  const page = setup();
  const rejected = ['Tout refuser', 'Continuer sans accepter', 'Reject all', 'Only necessary cookies'].map(x => page.add(x));
  const untouched = ['Tout accepter', 'Accepter et refuser', 'Paramétrer', 'Fermer'].map(x => page.add(x));
  page.flush();
  rejected.forEach(button => assert.equal(button.clicks, 1));
  untouched.forEach(button => assert.equal(button.clicks, 0));
  page.mutate(); page.flush();
  rejected.forEach(button => assert.equal(button.clicks, 1));
});

test('ignore les refus hors contexte cookies et les contrôles invisibles ou désactivés', () => {
  const page = setup({}, 'Refuser une invitation');
  const unrelated = page.add('Refuser');
  const known = page.add('', { known: true });
  const hidden = page.add('', { known: true, hidden: true });
  const disabled = page.add('', { known: true, disabled: true });
  page.flush();
  assert.equal(known.clicks, 1);
  for (const button of [unrelated, hidden, disabled]) assert.equal(button.clicks, 0);
});

test('réglages à chaud, arrêt de l’observation et annulation des clics en attente', () => {
  const page = setup({ autoDenyCookies: false });
  const button = page.add('Tout refuser');
  assert.equal(page.observing, false);
  page.change({ autoDenyCookies: true });
  page.change({ enabled: false });
  page.flush();
  assert.equal(button.clicks, 0);
  assert.equal(page.observing, false);
  page.change({ enabled: true }); page.flush();
  assert.equal(button.clicks, 1);
  const delayed = page.add('Reject all');
  page.mutate(); page.flush();
  assert.equal(delayed.clicks, 1);
});
