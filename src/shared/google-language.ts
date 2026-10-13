(() => {
  const current = () => EcoWebI18n.googleLanguage(location.href, document.documentElement?.lang);
  let previous: EcoWebI18n.Language | undefined;
  function update() {
    // Ne mémoriser que la langue réellement indiquée par Google.
    if (!document.documentElement?.lang &&
        !new URL(location.href).searchParams.get("hl")) return;
    const language = current();
    if (language === previous) return;
    previous = language;
    document.dispatchEvent(new Event("ecoweb-language-change"));
    // Stockage séparé des réglages : aucun conflit avec la file du service worker.
    void chrome.storage.local.get<{ googleLanguage?: EcoWebI18n.Language }>("googleLanguage").then(stored => {
      if (stored.googleLanguage !== language) return chrome.storage.local.set({ googleLanguage: language });
    }).catch(() => {});
  }
  const observer = new MutationObserver(() => {
    if (document.documentElement) observeLanguage();
    update();
  });
  function observeLanguage() {
    observer.disconnect();
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  if (document.documentElement) observeLanguage();
  else observer.observe(document, { childList: true });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "getGoogleLanguage") return false;
    reply({ language: current() });
    return false;
  });
  document.addEventListener("DOMContentLoaded", update, { once: true });
  addEventListener("popstate", update);
  update();
})();
