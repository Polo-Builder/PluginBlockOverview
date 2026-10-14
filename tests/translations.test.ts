import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const readScript = (file: string) => readFileSync(new URL(`../src/${file}.js`, import.meta.url), "utf8");
const source = readScript("shared/translations");
function translator(browserLanguage = "en") {
  const context = vm.createContext({ URL, chrome: { i18n: { getUILanguage: () => browserLanguage } } });
  vm.runInContext(source, context);
  return context.EcoWebTranslations as typeof EcoWebTranslations;
}

test("langue Google : français et variantes, anglais pour toutes les autres langues", () => {
  const i18n = translator();
  for (const locale of ["fr", "fr-FR", "fr_CA", "FR"]) {
    assert.equal(i18n.googleLanguage(`https://www.google.com/search?q=eco&hl=${locale}`, "en"), "fr");
  }
  for (const locale of ["en", "en-US", "de", "es", "", "france"]) {
    assert.equal(i18n.language(locale), "en");
  }
  assert.equal(i18n.googleLanguage("https://www.google.com/search?q=eco", "fr-FR"), "fr");
  assert.equal(i18n.googleLanguage("https://www.google.fr/search?q=eco", "de"), "en");
  assert.equal(i18n.googleLanguage("https://www.google.fr/search?q=eco&hl=en", "fr"), "en");
  assert.equal(i18n.googleLanguage("https://www.google.com/search?q=eco"), "en");
});

test("détection à document_start : attend la langue et ne réécrit pas les réglages", async () => {
  let changed!: () => void;
  let loaded!: () => void;
  const writes: object[] = [];
  const root = { lang: "" };
  const document = {
    documentElement: root, readyState: "loading",
    dispatchEvent: () => {},
    addEventListener: (_: string, callback: () => void) => { loaded = callback; }
  };
  const context = vm.createContext({
    URL, Event, document, location: { href: "https://www.google.com/search?q=eco" },
    addEventListener: () => {},
    MutationObserver: class {
      constructor(callback: () => void) { changed = callback; }
      observe() {} disconnect() {}
    },
    chrome: {
      storage: { local: {
        get: async () => ({ googleLanguage: "en" }),
        set: async (value: object) => { writes.push(value); }
      } },
      runtime: { onMessage: { addListener: () => {} } }
    }
  });
  vm.runInContext(source, context);
  vm.runInContext(readScript("shared/google-language"), context);
  assert.equal(writes.length, 0);
  root.lang = "fr";
  changed();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(JSON.stringify(writes), '[{"googleLanguage":"fr"}]');
  loaded(); changed();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
});

async function popup(googleLanguage?: string, cached?: string, fail = false, browserLanguage = "en", failStorage = false) {
  const attributes: Record<string, string> = {};
  const nodes = new Map<string, { textContent: string; dataset: { i18n?: string; i18nLabel?: string }; hidden: boolean; disabled: boolean; checked: boolean; addEventListener: () => void; setAttribute: (name: string, value: string) => void }>();
  const node = (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: "", dataset: {}, hidden: false, disabled: true, checked: false,
      addEventListener: () => {},
      setAttribute: (name, value) => { attributes[name] = value; }
    });
    return nodes.get(selector)!;
  };
  node("#block-title").dataset.i18n = "blockTitle";
  node("#enabled").dataset.i18nLabel = "enableExtension";
  const root = {
    lang: "",
    querySelectorAll: (selector: string) => [...nodes.values()].filter(item => selector === "[data-i18n]" ? item.dataset.i18n : item.dataset.i18nLabel)
  };
  const context = vm.createContext({
    URL, Error, document: { documentElement: root, querySelector: node },
    chrome: {
      i18n: { getUILanguage: () => browserLanguage },
      tabs: {
        query: async () => [{ id: 1 }],
        sendMessage: async () => {
          if (!googleLanguage) throw new Error("No Google tab");
          return { language: googleLanguage };
        }
      },
      storage: { local: { get: async () => {
        if (failStorage) throw new Error("Storage unavailable");
        return { googleLanguage: cached };
      } }, onChanged: { addListener: () => {} } },
      runtime: { sendMessage: async () => fail ? { ok: false, error: "settingsUnconfirmed" } : {
        ok: true, state: { enabled: true, autoDenyCookies: true, blockAI: true, ecoTab: true, ecoApplied: false, backup: {}, report: null }
      } }
    }
  });
  vm.runInContext(source, context);
  vm.runInContext(readScript("popup/popup").replace(/^export \{\};?\s*$/gm, ""), context);
  await new Promise(resolve => setImmediate(resolve));
  return { root, node, attributes };
}

test("popup : Google actif prévaut sur la langue mémorisée, erreurs et accessibilité traduites", async () => {
  const french = await popup("fr", "en", true);
  assert.equal(french.root.lang, "fr");
  assert.equal(french.node("#block-title").textContent, "Blocage IA");
  assert.equal(french.attributes["aria-label"], "Activer l’extension");
  assert.equal(french.node("#status").textContent, translator().text("settingsUnconfirmed", "fr"));
  const english = await popup("de", "fr", true);
  assert.equal(english.root.lang, "en");
  assert.equal(english.node("#block-title").textContent, "AI blocking");
  assert.equal(english.node("#status").textContent, translator().text("settingsUnconfirmed", "en"));
});

test("popup hors de Google : dernière langue connue, langue du navigateur par défaut", async () => {
  assert.equal((await popup(undefined, "fr")).root.lang, "fr");
  assert.equal((await popup()).root.lang, "en");
  assert.equal((await popup(undefined, undefined, false, "fr-FR")).root.lang, "fr");
  assert.equal((await popup(undefined, undefined, false, "fr", true)).root.lang, "fr");
  assert.equal((await popup("en", undefined, false, "fr")).root.lang, "en");
});

test("Google sans indication de langue : suit le navigateur français", () => {
  const translations = translator("fr-FR");
  assert.equal(translations.googleLanguage("https://www.google.com/search?q=eco"), "fr");
  assert.equal(translations.googleLanguage("https://www.google.com/search?q=eco&hl=de", "fr"), "en");
});
