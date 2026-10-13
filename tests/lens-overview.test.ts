import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/features/BlockOverviewIA/lens-overview.js", import.meta.url), "utf8");
type State = Partial<import("../src/shared/types.js").ExtensionState>;

// DOM minimal pour exercer les mutations et les frontières entre modules Lens.
class Element {
  nodeType = 1;
  parentElement: Element | null = null;
  children: Element[] = [];
  attributes = new Map<string, string>();
  constructor(readonly tag: string, private text = "", attributes: Record<string, string> = {}) {
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
  }
  get textContent(): string { return this.text + this.children.map(child => child.textContent).join(""); }
  set textContent(value: string) { this.text = value; }
  get isConnected(): boolean { return this.tag === "html" || !!this.parentElement?.isConnected; }
  append(...nodes: Element[]) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  toggleAttribute(name: string, value: boolean) { if (value) this.setAttribute(name, ""); else this.removeAttribute(name); }
  matches(selectors: string): boolean {
    return selectors.split(",").some(selector => {
      const part = selector.trim();
      const tag = part.match(/^[a-z0-9]+/i)?.[0];
      if (tag && tag !== this.tag) return false;
      const className = part.match(/\.([\w-]+)/)?.[1];
      if (className && !(this.getAttribute("class") ?? "").split(" ").includes(className)) return false;
      for (const [, name, value] of part.matchAll(/\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\]/g)) {
        if (!this.attributes.has(name) || value !== undefined && this.getAttribute(name) !== value) return false;
      }
      return true;
    });
  }
  closest(selectors: string): Element | null {
    return this.matches(selectors) ? this : this.parentElement?.closest(selectors) ?? null;
  }
  querySelectorAll(selectors: string): Element[] {
    return this.children.flatMap(child => [...(child.matches(selectors) ? [child] : []), ...child.querySelectorAll(selectors)]);
  }
}
const element = (tag: string, text = "", attrs: Record<string, string> = {}) => new Element(tag, text, attrs);

function setup(href = "https://www.google.com/search?udm=26&vsrid=fixture&lns_surface=26", state: State = {}, deferred = false) {
  const html = element("html"), body = element("body"), main = element("main");
  html.append(body); body.append(main);
  let changed: ((changes: { state: { newValue: State } }, area: string) => void) | undefined;
  let read: ((data: { state: State }) => void) | undefined;
  let mutated: ((records: object[]) => void) | undefined;
  let observing = false;
  const events: Record<string, () => void> = {};
  const location = { href };
  vm.runInNewContext(source, {
    URL, location,
    document: { documentElement: html, body, addEventListener: (name: string, fn: () => void) => { events[name] = fn; } },
    addEventListener: (name: string, fn: () => void) => { events[name] = fn; },
    MutationObserver: class {
      constructor(fn: typeof mutated) { mutated = fn; }
      observe() { observing = true; } disconnect() { observing = false; }
    },
    chrome: { storage: {
      local: { get: (_: string, cb: NonNullable<typeof read>) => { read = cb; if (!deferred) cb({ state }); } },
      onChanged: { addListener: (fn: NonNullable<typeof changed>) => { changed = fn; } }
    } }
  });
  const hidden = (node: Element) => !!html.attributes.has("data-ecoweb-lens-block-ai") &&
    !!node.closest('[data-aim="1"][data-fsid], [data-async-type="folsrch"], [data-ecoweb-lens-overview]');
  return {
    main, location, hidden, get observing() { return observing; },
    add(node: Element) { main.append(node); if (observing) mutated?.([{ type: "childList", target: main, addedNodes: [node] }]); },
    change(next: State) { changed?.({ state: { newValue: next } }, "local"); },
    mutate(node: Element) { if (observing) mutated?.([{ type: "characterData", target: { nodeType: 3, parentElement: node } }]); },
    finishRead() { read?.({ state }); },
    navigate(href: string) { location.href = href; events.popstate?.(); }
  };
}

test("Lens : tout le module IA et sa génération sont masqués, les résultats restent intacts", () => {
  const page = setup();
  // Structure observée dans le résultat Lens fourni : wrapper IA et conteneur folsrch.
  const ai = element("div", "", { "data-aim": "1", "data-fsid": "B2Jtyd" });
  const response = element("div", "", { "data-async-type": "folsrch" });
  const heading = element("div", "Aperçu IA", { role: "heading" });
  const content = element("div", "Réponse générée et ses sources");
  response.append(heading, content); ai.append(response); page.add(ai);
  const visual = element("section"); visual.append(element("h2", "Correspondances visuelles"), element("a", "Image", { href: "https://example.com/image" }));
  const organic = element("section"); organic.append(element("a", "Résultat Web", { href: "https://example.com" }));
  page.add(visual); page.add(organic);
  assert.equal(page.hidden(ai), true);
  assert.equal(page.hidden(content), true);
  assert.equal(page.hidden(visual), false);
  assert.equal(page.hidden(organic), false);
  const loading = element("div", "Génération", { "data-async-type": "folsrch" });
  page.add(loading);
  assert.equal(page.hidden(loading), true);
});

test("Lens : titre anglais dynamique, bascule IA et interrupteur global sans rechargement", () => {
  const page = setup();
  const card = element("section"), title = element("h2", "Loading…"), text = element("p", "AI response");
  card.append(title, text); page.add(card);
  assert.equal(page.hidden(card), false);
  title.textContent = "AI Overview"; page.mutate(title);
  assert.equal(page.hidden(card), true);
  assert.equal(page.hidden(text), true);
  page.change({ blockAI: false });
  assert.equal(page.hidden(card), false);
  assert.equal(page.observing, false);
  page.change({ blockAI: true });
  assert.equal(page.hidden(card), true);
  page.change({ enabled: false });
  assert.equal(page.hidden(card), false);
  page.change({ enabled: true });
  assert.equal(page.hidden(card), true);
});

test("Lens : ne masque ni un lien intitulé AI Overview, ni un conteneur partagé avec les correspondances", () => {
  const page = setup();
  const shared = element("section"); shared.append(element("h2", "Aperçu IA"), element("h2", "Correspondances visuelles")); page.add(shared);
  const result = element("section"), link = element("a", "", { href: "https://example.com" });
  link.append(element("h2", "AI Overview")); result.append(link); page.add(result);
  assert.equal(page.hidden(shared), false);
  assert.equal(page.hidden(result), false);
});

test("recherche classique : aucune observation ni modification", () => {
  const page = setup("https://www.google.com/search?q=chat");
  const card = element("section"); card.append(element("h2", "Aperçu IA")); page.add(card);
  assert.equal(page.observing, false);
  assert.equal(page.hidden(card), false);
  page.change({ enabled: true, blockAI: true });
  assert.equal(page.hidden(card), false);
});

test("Lens : arrêt à la sortie de Lens et lecture initiale tardive sans écraser OFF", () => {
  const page = setup(undefined, {}, true);
  page.change({ blockAI: false }); page.finishRead();
  assert.equal(page.observing, false);
  page.change({ blockAI: true });
  const card = element("section"); card.append(element("h2", "Aperçu IA")); page.add(card);
  assert.equal(page.hidden(card), true);
  page.navigate("https://www.google.com/search?q=chat");
  assert.equal(page.hidden(card), false);
  assert.equal(page.observing, false);
});

test("Lens dédié et filtres de correspondances : protection active sans changer l’URL", () => {
  for (const href of ["https://lens.google.com/v3/results?test=1", "https://www.google.fr/search?udm=44", "https://www.google.com/search?udm=48"]) {
    const page = setup(href);
    assert.equal(page.observing, true);
    assert.equal(page.location.href, href);
  }
});
