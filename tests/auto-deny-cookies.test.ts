import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/features/AutoDenyCookies/content.js', import.meta.url), 'utf8');
type State = Partial<import("../src/shared/types.js").ExtensionState>;
interface ButtonOptions { known?: boolean; hidden?: boolean; disabled?: boolean; }
interface MockButton extends ButtonOptions {
  textContent: string;
  clicks: number;
  click(): void;
}
function setup(state: State = {}, context = 'Nous utilisons des cookies') {
  let changed!: (changes: { state: { newValue: State } }, area: string) => void;
  let mutated!: (records: { type: string; addedNodes: object[] }[]) => void;
  let task: (() => void) | null = null, observing = false;
  const buttons: MockButton[] = [];
  const body = {};
  const panel = { textContent: context, parentElement: body };
  const root = { isConnected: true, querySelectorAll: () => buttons, contains: (node: MockButton) => buttons.includes(node) };
  vm.runInNewContext(source, {
    document: { body, documentElement: root },
    chrome: { storage: {
      local: { get: (_: string, cb: (data: { state: State }) => void) => cb({ state }) },
      onChanged: { addListener: (fn: typeof changed) => { changed = fn; } }
    } },
    setTimeout: (fn: () => void) => { task = fn; return 1; }, clearTimeout: () => { task = null; },
    getComputedStyle: () => ({ visibility: 'visible', opacity: '1' }),
    MutationObserver: class {
      constructor(fn: typeof mutated) { mutated = fn; }
      observe() { observing = true; }
      disconnect() { observing = false; }
    }
  });
  return {
    add(text: string, options: ButtonOptions = {}) {
      const button = {
        textContent: text, parentElement: panel, isConnected: true, clicks: 0,
        matches: (selector: string) => selector.startsWith('button,') || (options.known && selector.includes('#onetrust')),
        querySelectorAll: () => [], contains: () => false,
        getAttribute: () => null, getClientRects: () => options.hidden ? [] : [{}],
        closest: () => null, click() { this.clicks++; }, ...options
      };
      buttons.push(button);
      return button;
    },
    flush() { const run = task; task = null; run?.(); },
    change(next: State) { changed({ state: { newValue: next } }, 'local'); },
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
