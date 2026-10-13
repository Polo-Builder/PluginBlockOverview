import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/features/BlockOverviewIA/ai-guard.js', import.meta.url), 'utf8');
type StorageChange = { state: { newValue: { enabled: boolean } } };
type Click = { target: { closest: () => { href: string } }; stopImmediatePropagation: () => void };
type Handler = (event: Click) => void;
function run(href: string, enabled = true) {
  const calls: string[] = [], events: Record<string, Handler> = {};
  const location = { href, replace: (url: string) => calls.push(url) };
  let changed!: (changes: StorageChange, area: string) => void;
  let mutated!: () => void;
  vm.runInNewContext(source, {
    URL, location,
    chrome: { storage: {
      local: { get: (_: string, cb: (data: { state: { enabled: boolean } }) => void) => cb({state:{enabled}}) },
      onChanged: { addListener: (fn: typeof changed) => { changed = fn; } }
    } },
    document: { addEventListener: (name: string, fn: Handler) => { events[name] = fn; } },
    addEventListener: (name: string, fn: Handler) => { events[name] = fn; },
    MutationObserver: class { constructor(fn: () => void) { mutated = fn; } observe() {} }
  });
  return { calls, events, location, change: (value: boolean) => changed({state:{newValue:{enabled:value}}}, 'local'), mutate: () => mutated() };
}
test('une page IA déjà ouverte est renvoyée vers Web ; OFF la laisse intacte', () => {
  const href = 'https://www.google.fr/search?q=chat&udm=50&tbm=nws&aep=1';
  const on = run(href);
  const target = new URL(on.calls[0]);
  assert.equal(target.searchParams.get('udm'), 'web');
  assert.equal(target.searchParams.get('q'), 'chat');
  assert.equal(target.searchParams.has('tbm'), false);
  const off = run(href, false);
  assert.equal(off.calls.length, 0);
  off.change(true);
  assert.equal(off.calls.length, 1);
});
test('liens IA corrigés avant le gestionnaire Google, autres liens conservés', () => {
  const state = run('https://www.google.fr/search?q=chat&udm=web');
  for (const [href, blocked] of [
    ['https://www.google.fr/search?q=chat&udm=50', true],
    ['https://www.google.fr/search?q=chat&udm=2', false],
    ['https://example.com/search?q=chat&udm=50', false]
  ] as [string, boolean][]) {
    const link = { href };
    let stopped = false;
    state.events.click({target:{closest:()=>link},stopImmediatePropagation:()=>{stopped=true;}});
    assert.equal(stopped, blocked);
    assert.equal(link.href, blocked ? href.replace('udm=50', 'udm=web') : href);
  }
  state.location.href = 'https://www.google.fr/search?q=chat&udm=50';
  state.mutate();
  assert.equal(state.calls.length, 1);
});
