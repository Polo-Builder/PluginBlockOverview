// Lens conserve ses résultats visuels : aucune redirection vers le filtre Web.
(() => {
  type State = Partial<import("../../shared/types.js").ExtensionState>;
  function isLensPage() {
    const url = new URL(location.href);
    if (url.hostname === "lens.google.com") return true;
    return /^(www\.)?google\.(com|fr)$/.test(url.hostname) && url.pathname === "/search" &&
      (["26", "44", "48"].includes(url.searchParams.get("udm") ?? "") ||
       url.searchParams.has("vsrid") || url.searchParams.has("lns_surface") ||
       url.searchParams.has("lns_mode") || url.searchParams.get("source")?.startsWith("lns."));
  }
  // Ne pas observer ni modifier les recherches classiques.
  if (!isLensPage()) return;

  const enabledAttribute = "data-ecoweb-lens-block-ai";
  const blockAttribute = "data-ecoweb-lens-overview";
  const headings = 'h1, h2, [role="heading"], [aria-label="AI Overview"], [aria-label="Aperçu IA"]';
  const overviewTitle = /^(?:aperçus? ia|ai overviews?)$/i;
  const boundary = '[data-aim="1"][data-fsid], [data-async-type="folsrch"], .M8OgIe, section, [role="region"], [data-hveid]';
  const marked = new Set<Element>();
  let state: State | undefined;
  let active = false;

  function scan(root: Element) {
    if (root.closest(`[${blockAttribute}]`)) return;
    const candidates = [...(root.matches(headings) ? [root] : []), ...root.querySelectorAll(headings)];
    for (const heading of candidates) {
      const title = (heading.getAttribute("aria-label") || heading.textContent || "").trim().replace(/\s+/g, " ");
      if (!overviewTitle.test(title) || heading.closest("a, nav, [role='navigation']")) continue;
      const block = heading.closest(boundary);
      if (!block || block === document.body || block === document.documentElement || block.matches("main, [role='main']")) continue;
      // Refuser un conteneur partagé avec les résultats Lens ou des résultats Web.
      if ([...block.querySelectorAll('h1, h2, h3, [role="heading"]')].some(node =>
        /^(?:correspondances (?:visuelles|exactes)|visual matches|exact matches|résultats de recherche|search results)$/i.test(node.textContent?.trim() ?? "") ||
        node.matches("h3") && !!node.closest("a[href]"))) continue;
      block.setAttribute(blockAttribute, "");
      marked.add(block);
    }
  }

  const observer = new MutationObserver(records => {
    if (!isLensPage()) { configure(); return; }
    document.documentElement?.toggleAttribute(enabledAttribute, true);
    for (const record of records) {
      if (record.type === "childList") {
        if (record.target.nodeType === 1 && (record.target as Element).matches(headings)) scan(record.target as Element);
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) scan(node as Element);
          else if (node.parentElement) scan(node.parentElement);
        }
      } else {
        const root = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
        if (root) scan(root);
      }
    }
    for (const node of marked) if (!node.isConnected) marked.delete(node);
  });

  function configure() {
    const next = (state?.enabled ?? true) && (state?.blockAI ?? true) && !!isLensPage();
    document.documentElement?.toggleAttribute(enabledAttribute, next);
    if (next === active) return;
    active = next;
    observer.disconnect();
    if (!next) {
      for (const node of marked) node.removeAttribute(blockAttribute);
      marked.clear();
      return;
    }
    if (document.documentElement) scan(document.documentElement);
    observer.observe(document, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["role", "aria-label", "class", "data-hveid"]
    });
  }
  let changed = false;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.state) return;
    changed = true;
    state = changes.state.newValue as State | undefined;
    configure();
  });
  chrome.storage.local.get<{ state?: State }>("state", stored => {
    if (!changed) { state = stored.state; configure(); }
  });
  document.addEventListener("DOMContentLoaded", () => {
    // documentElement peut être absent lors du premier accès au stockage.
    document.documentElement?.toggleAttribute(enabledAttribute, active);
    if (active && document.documentElement) scan(document.documentElement);
  }, { once: true });
  addEventListener("popstate", configure);
})();
