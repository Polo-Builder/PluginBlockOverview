// Vérifié le 15/09/2026 : le lien natif « Web » utilise udm=web sur .com et .fr.
// La redirection ne dépend pas du script d’affichage des onglets.
export const WEB_VALUE = "web";
const prefix = "^https?://(www\\.)?google\\.(com|fr)/search\\?";
const param = "([^&#]*&)*";
const condition = (suffix) => ({
  regexFilter: prefix + param + suffix,
  isUrlFilterCaseSensitive: true,
  resourceTypes: ["main_frame"],
  requestMethods: ["get"]
});

export const RULES = [
  {
    id: 1, priority: 1,
    action: { type: "redirect", redirect: { transform: {
      queryTransform: { addOrReplaceParams: [{ key: "udm", value: WEB_VALUE }] }
    } } },
    condition: condition("q=[^&#]+(&|$)")
  },
  // Respecter un filtre explicitement choisi (Images, Vidéos, Mode IA…).
  // Inclut le Web actuel et les anciens liens udm=14 : pas de boucle.
  // udm vide ou 0 correspond à une recherche générale et reste redirigé.
  {
    id: 2, priority: 2, action: { type: "allow" },
    condition: condition("udm=([^0&#][^&#]*|0[^&#]+)(&|$)")
  },
  {
    id: 3, priority: 2, action: { type: "allow" },
    condition: condition("tbm=[^&#]+(&|$)")
  }
];

export async function syncRedirect(enabled) {
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const desired = enabled ? RULES : [];
  if (JSON.stringify(current) === JSON.stringify(desired)) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: current.map((rule) => rule.id), addRules: desired
  });
}
