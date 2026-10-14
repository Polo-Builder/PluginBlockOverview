// Script commun au popup et aux pages Google : aucun module ni bibliothèque à charger.
namespace EcoWebTranslations {
  export type Language = "fr" | "en";
  const french = {
    enableExtension: "Activer l’extension",
    blockTitle: "Blocage IA",
    blockDescription: "Masque les aperçus IA des résultats de recherche.",
    tabsTitle: "Onglet Eco",
    tabsDescription: "L’onglet principal devient Eco : juste l’essentiel.",
    cookiesTitle: "Refus des cookies",
    cookiesDescription: "Refuse automatiquement les cookies non essentiels.",
    settingsTitle: "Réglages automatiques",
    settingsDescription: "Réduit l’activité de Chrome en arrière-plan.",
    settingsDone: "✓ OK",
    apply: "Appliquer",
    restore: "Restaurer",
    support: "Me soutenir",
    supportDescription: "EcoWeb est gratuit. Soutenez son développeur.",
    closeSupport: "Fermer le panneau Ko-fi",
    checking: "Vérification en cours…",
    checkRequired: "à vérifier",
    unavailable: "Extension indisponible.",
    settingsIncomplete: "Réglages incomplets. Réessayez.",
    restoreIncomplete: "Restauration incomplète. Réessayez.",
    settingsUnconfirmed: "Le réglage n’a pas pu être confirmé. Rouvrez la popup pour réessayer.",
    eco: "Eco",
    news: "Actualités",
    images: "Images",
    videos: "Vidéos",
    maps: "Maps"
  };
  export type Key = keyof typeof french;
  const english: Record<Key, string> = {
    enableExtension: "Enable the extension",
    blockTitle: "AI blocking",
    blockDescription: "Hides AI overviews from search results.",
    tabsTitle: "Eco tab",
    tabsDescription: "Your main tab becomes Eco: just the essentials.",
    cookiesTitle: "Cookie rejection",
    cookiesDescription: "Automatically rejects non-essential cookies.",
    settingsTitle: "Automatic settings",
    settingsDescription: "Reduces Chrome’s background activity.",
    settingsDone: "✓ OK",
    apply: "Apply",
    restore: "Restore",
    support: "Support me",
    supportDescription: "EcoWeb is free. Support its developer.",
    closeSupport: "Close the Ko-fi panel",
    checking: "Checking…",
    checkRequired: "check required",
    unavailable: "Extension unavailable.",
    settingsIncomplete: "Settings incomplete. Try again.",
    restoreIncomplete: "Restore incomplete. Try again.",
    settingsUnconfirmed: "The setting could not be confirmed. Reopen the popup to try again.",
    eco: "Eco",
    news: "News",
    images: "Images",
    videos: "Videos",
    maps: "Maps"
  };

  export function language(value: string | null | undefined): Language {
    return /^fr(?:[-_]|$)/i.test(value?.trim() ?? "") ? "fr" : "en";
  }

  export function browserLanguage(): Language {
    return language(chrome.i18n.getUILanguage());
  }

  export function googleLanguage(href: string, htmlLanguage?: string | null): Language {
    const detected = new URL(href).searchParams.get("hl") || htmlLanguage;
    return detected ? language(detected) : browserLanguage();
  }

  export function text(key: Key, locale: Language): string {
    return (locale === "fr" ? french : english)[key];
  }

  export function translate(root: HTMLElement, locale: Language): void {
    root.lang = locale;
    for (const node of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
      node.textContent = text(node.dataset.i18n as Key, locale);
    }
    for (const node of root.querySelectorAll<HTMLElement>("[data-i18n-label]")) {
      node.setAttribute("aria-label", text(node.dataset.i18nLabel as Key, locale));
    }
  }
}
