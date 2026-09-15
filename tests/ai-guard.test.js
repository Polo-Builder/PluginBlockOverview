import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../ai-guard.js', import.meta.url), 'utf8');
function run(href, enabled = true) {
  const calls = [], events = {};
  const location = { href, replace: url => calls.push(url) };
  let changed, mutated;
  vm.runInNewContext(source, {
    URL, location,
    chrome: { storage: {
      local: { get: (_, cb) => cb({state:{enabled}}) },
      onChanged: { addListener: fn => { changed = fn; } }
    } },
    document: { addEventListener: (name, fn) => { events[name] = fn; } },
    addEventListener: (name, fn) => { events[name] = fn; },
    MutationObserver: class { constructor(fn) { mutated = fn; } observe() {} }
  });
  return { calls, events, location, change: value => changed({state:{newValue:{enabled:value}}}, 'local'), mutate: () => mutated() };
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
  ]) {
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
