(() => {
  if (location.pathname !== "/search") return;
  type State = Partial<import("../../shared/types.js").ExtensionState>;
  const definitions: [string, EcoWebI18n.Key, string | null, string | null][] = [
    ["web", "eco", "udm", "web"],
    ["news", "news", "tbm", "nws"],
    ["images", "images", "udm", "2"],
    ["videos", "videos", "udm", "7"],
    ["maps", "maps", null, null]
  ];
  const controls = 'a, button, [role="button"], [role="tab"], [role="link"]';
  const labels = /^(web|tous|all|images?|vidéos?|videos?|actualités|news|mode ia|ai mode|shopping|maps|livres|books|finance|vidéos courtes|short videos|plus|more|more filters|plus de filtres)$/i;
  const normalize = (text: string | null) => (text || "").trim().replace(/\s+/g, " ");
  const kind = (node: Element) => {
    const text = normalize(node.textContent);
    if (/^web$/i.test(text)) return "web";
    if (/^(vidéos?|videos?)$/i.test(text)) return "videos";
    if (/^images?$/i.test(text)) return "images";
    if (/^(actualités|news)$/i.test(text)) return "news";
    if (/^maps$/i.test(text)) return "maps";
    return null;
  };
  const branch = (row: Element, node: Element) => {
    while (node.parentElement && node.parentElement !== row) node = node.parentElement;
    return node.parentElement === row ? node : null;
  };
  const surfaces = '#hdtb, #top_nav, nav, [role="navigation"]';
  let enabled: boolean | null = null;
  let activeRow: Element | null = null;
  const renamed = new Map<Element, string | null>();
  // Les mutations sont traitées avant le prochain rendu, sans attendre une frame.
  // Ignorer les résultats et annonces : ils ne nécessitent pas de refaire les onglets.
  const observer = new MutationObserver((records) => {
    if (enabled === null) { pending(true); return; }
    if (!enabled) return;
    if (records.some(record => {
      const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      if (target?.closest(surfaces)) return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
        (node === activeRow || node.contains(activeRow) || (node as Element).matches(surfaces) || (node as Element).querySelector(surfaces)));
    })) update();
  });
  const observe = () => observer.observe(document, { childList: true, subtree: true, characterData: true });
  function pending(value: boolean) {
    document.documentElement?.toggleAttribute('data-gsaio-pending', value);
  }

  function reset() {
    activeRow = null;
    for (const [node, text] of renamed) node.textContent = text;
    renamed.clear();
    document.querySelectorAll('[data-gsaio-added]').forEach((node) => node.remove());
    for (const name of ["data-gsaio-order", "data-gsaio-hide", "data-gsaio-row"]) {
      document.querySelectorAll(`[${name}]`).forEach((node) => node.removeAttribute(name));
    }
  }

  function findRow() {
    for (const surface of document.querySelectorAll(surfaces)) {
      const tabs = [...surface.querySelectorAll(controls)].filter((node) =>
        !node.closest('[data-gsaio-added]') && labels.test(normalize(node.textContent)));
      if (tabs.length < 3) continue;
      for (let row = tabs[0].parentElement; row && surface.contains(row); row = row.parentElement) {
        const inside = tabs.filter((node) => row.contains(node));
        if (inside.length >= 3 && new Set(inside.map((node) => branch(row, node))).size >= 3) {
          return { row, tabs: inside };
        }
        if (row === surface) break;
      }
    }
    return null;
  }

  function update() {
    observer.disconnect();
    try {
      if (!enabled || location.pathname !== "/search") { reset(); pending(false); return; }
      const current = new URL(location.href);
      if (!current.searchParams.get("q")) { pending(false); return; }
      reset();
      const found = findRow();
      if (!found) {
        if (document.readyState !== 'loading') pending(false);
        return;
      }
      const { row, tabs } = found;
      activeRow = row;
      // Réinitialiser uniquement nos attributs et les liens manquants ajoutés.
      // Les onglets natifs gardent leurs enfants, href, événements et position DOM.
      row.setAttribute("data-gsaio-row", "");
      const kept = new Set<Element>();
      const language = EcoWebI18n.googleLanguage(current.href, document.documentElement?.lang);
      definitions.forEach(([type, labelKey, parameter, value], index) => {
        const label = EcoWebI18n.text(labelKey, language);
        // Ne pas réutiliser le conteneur entier du menu « Plus » pour un lien caché.
        const native = tabs.find((node) => kind(node) === type &&
          !kept.has(branch(row, node)!) &&
          !branch(row, node)?.querySelector('[aria-expanded], [role="menu"]'));
        let item = native && branch(row, native);
        if (native && type === "web") {
          const leaf = [...native.querySelectorAll('*')].find((node) =>
            !node.children.length && /^web$/i.test(normalize(node.textContent))) || native;
          renamed.set(leaf, leaf.textContent);
          leaf.textContent = label;
        }
        if (!item) {
          // Certains filtres sont uniquement dans « Plus ». Ajouter alors un lien
          // neuf, sans recycler un bouton Google appartenant à une autre catégorie.
          item = document.createElement(row.tagName === "UL" ? "li" : "div");
          item.setAttribute("data-gsaio-added", "");
          if (row.getAttribute("role") === "list") item.setAttribute("role", "listitem");
          const link = document.createElement("a");
          // Reprendre uniquement les classes de présentation natives, sans contrôleur Google.
          const sample = tabs.find((node) => ["images", "news", "videos"].includes(kind(node) ?? ""));
          const sampleLabel = sample && [...sample.querySelectorAll('*')].find((node) =>
            !node.children.length && labels.test(normalize(node.textContent)));
          let caption: Element = link;
          if (sample && sampleLabel) {
            link.className = sample.className;
            const ancestors: Element[] = [];
            for (let node: Element | null = sampleLabel; node && node !== sample; node = node.parentElement) ancestors.unshift(node);
            for (const node of ancestors) {
              const child = document.createElement(node.tagName);
              child.className = node.className;
              caption.append(child);
              caption = child;
            }
            item.setAttribute("data-gsaio-native-style", "");
          }
          caption.textContent = label;
          const url = new URL(current.href);
          for (const name of ["udm", "tbm", "gsaio_view", "start", "ved", "ei", "sa", "source", "uds", "uact"]) url.searchParams.delete(name);
          if (type === "maps") {
            url.protocol = "https:";
            url.hostname = "www.google.com";
            url.port = "";
            url.pathname = "/maps/search/";
            url.search = "";
            url.searchParams.set("api", "1");
            url.searchParams.set("query", current.searchParams.get("q")!);
          } else url.searchParams.set(parameter!, value!);
          url.hash = "";
          link.href = url.href;
          if (parameter && (current.searchParams.get(parameter) === value ||
              type === "web" && current.searchParams.get("udm") === "14")) {
            link.setAttribute("aria-current", "page");
            if (link.firstElementChild) link.firstElementChild.setAttribute("aria-current", "page");
          }
          item.append(link);
          row.append(item);
        }
        kept.add(item);
        item.setAttribute("data-gsaio-order", String(index));
      });
      // Une seule rangée identifiée : aucun masquage global de liens ou de résultats.
      for (const tab of tabs) {
        const item = branch(row, tab);
        if (item && !kept.has(item)) item.setAttribute("data-gsaio-hide", "");
      }
      pending(false);
    } finally { if (enabled !== false) observe(); }
  }
  pending(true);
  observe();
  chrome.storage.local.get<{ state?: State }>("state", ({ state }) => { enabled = (state?.enabled ?? true) && (state?.ecoTab ?? true); update(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.state) {
      const state = changes.state.newValue as State | undefined;
      enabled = (state?.enabled ?? true) && (state?.ecoTab ?? true); update();
    }
  });
  // Ne pas laisser une navigation inconnue invisible si Google change sa structure.
  document.addEventListener('DOMContentLoaded', () => {
    if (enabled !== null) { update(); pending(false); }
  }, { once: true });
  addEventListener("popstate", update);
  document.addEventListener("ecoweb-language-change", update);
})();
