// Protection indépendante de la mise en page, y compris les navigations sans rechargement.
(() => {
  let enabled = false;
  function webURL(href) {
    const url = new URL(href, location.href);
    if (!/^https?:$/.test(url.protocol) || !/^(www\.)?google\.(com|fr)$/.test(url.hostname) ||
        url.pathname !== "/search" || !url.searchParams.getAll("udm").includes("50")) return null;
    for (const key of ["tbm", "gsaio_view", "aep", "aim", "atvm"]) url.searchParams.delete(key);
    url.searchParams.set("udm", "web");
    return url.href;
  }
  function check() {
    const target = enabled && webURL(location.href);
    if (target) location.replace(target);
  }
  chrome.storage.local.get("state", ({ state }) => { enabled = state?.enabled ?? true; check(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.state) { enabled = changes.state.newValue?.enabled ?? true; check(); }
  });
  document.addEventListener("click", (event) => {
    if (!enabled) return;
    const link = event.target.closest?.("a[href]");
    const target = link && webURL(link.href);
    if (!target) return;
    // Conserver le comportement natif du lien (nouvel onglet, Ctrl+clic, etc.).
    link.href = target;
    event.stopImmediatePropagation();
  }, true);
  addEventListener("popstate", check);
  new MutationObserver(check).observe(document, { childList: true, subtree: true });
})();
