import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/shared/kofi.js", import.meta.url), "utf8").replace(/^export \{\};?\s*$/gm, "");

test("Ko-fi : chargement au clic, fermeture et réouverture sans recharger le formulaire", () => {
  const events: Record<string, () => void> = {};
  let keydown!: (event: { key: string; preventDefault: () => void }) => void;
  const button = {
    expanded: "false", focused: false,
    setAttribute: (_: string, value: string) => { button.expanded = value; },
    addEventListener: (_: string, callback: () => void) => { events.open = callback; },
    focus: () => { button.focused = true; }
  };
  const panel = { hidden: true };
  const close = {
    focused: false,
    addEventListener: (_: string, callback: () => void) => { events.close = callback; },
    focus: () => { close.focused = true; }
  };
  let loads = 0, currentSource = "";
  const url = "https://ko-fi.com/polobuilder/?hidefeed=true&widget=true&embed=true&preview=true";
  const frame = {
    dataset: { src: url }, hasAttribute: () => !!currentSource,
    set src(value: string) { currentSource = value; loads++; }
  };
  const elements: Record<string, object> = { "#kofi-button": button, "#kofi-panel": panel, "#kofi-close": close, "#kofiframe": frame };
  vm.runInNewContext(source, { document: {
    querySelector: (selector: string) => elements[selector],
    addEventListener: (_: string, callback: typeof keydown) => { keydown = callback; }
  } });
  assert.equal(loads, 0);
  events.open();
  assert.equal(panel.hidden, false);
  assert.equal(button.expanded, "true");
  assert.equal(currentSource, url);
  assert.equal(close.focused, true);
  events.close();
  assert.equal(panel.hidden, true);
  assert.equal(button.focused, true);
  events.open();
  assert.equal(loads, 1);
  let prevented = false;
  keydown({ key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(panel.hidden, true);
  assert.equal(prevented, true);
});
