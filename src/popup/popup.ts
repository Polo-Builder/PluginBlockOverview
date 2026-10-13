import type { ExtensionMessage, ExtensionResponse, ExtensionState, MessageType } from "../shared/types.js";

const toggle = document.querySelector<HTMLInputElement>("#enabled")!;
const cookiesToggle = document.querySelector<HTMLInputElement>("#auto-deny-cookies")!;
const aiToggle = document.querySelector<HTMLInputElement>("#block-ai")!;
const tabsToggle = document.querySelector<HTMLInputElement>("#eco-tab")!;
const eco = document.querySelector<HTMLButtonElement>("#eco")!;
const restoreButton = document.querySelector<HTMLButtonElement>("#restore")!;
const status = document.querySelector<HTMLElement>("#status")!;
let state: ExtensionState | undefined;
let locale: EcoWebI18n.Language = EcoWebI18n.browserLanguage();
let statusKey: EcoWebI18n.Key | null = null;
let modeNeedsCheck = false;
const t = (key: EcoWebI18n.Key) => EcoWebI18n.text(key, locale);

function setStatus(key: EcoWebI18n.Key | null) {
  statusKey = key;
  status.textContent = key ? t(key) : "";
}

async function detectLanguage(): Promise<EcoWebI18n.Language> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) {
      const result: { language?: string } = await chrome.tabs.sendMessage(tab.id, { type: "getGoogleLanguage" }, { frameId: 0 });
      if (result?.language) return EcoWebI18n.language(result.language);
    }
  } catch { /* Hors de Google, réutiliser la dernière langue détectée. */ }
  try {
    const stored = await chrome.storage.local.get<{ googleLanguage?: string }>("googleLanguage");
    if (stored.googleLanguage) return EcoWebI18n.language(stored.googleLanguage);
  } catch { /* La langue du navigateur reste disponible sans stockage. */ }
  return EcoWebI18n.browserLanguage();
}

async function translate() {
  locale = await detectLanguage();
  EcoWebI18n.translate(document.documentElement, locale);
  setStatus(statusKey);
  if (modeNeedsCheck) document.querySelector("#mode")!.textContent = t("checkRequired");
}

function render() {
  if (!state) return;
  modeNeedsCheck = false;
  toggle.checked = state.enabled;
  cookiesToggle.checked = state.autoDenyCookies;
  aiToggle.checked = state.blockAI;
  tabsToggle.checked = state.ecoTab;
  document.querySelector<HTMLElement>("#eco-done")!.hidden = !state.ecoApplied;
  document.querySelector("#mode")!.textContent = state.enabled ? "ON" : "OFF";
  restoreButton.disabled = Object.keys(state.backup).length === 0;
  setStatus(null);
}

async function send(type: MessageType, extra: Partial<ExtensionMessage> = {}) {
  for (const control of [toggle, cookiesToggle, aiToggle, tabsToggle, eco, restoreButton]) control.disabled = true;
  setStatus("checking");
  try {
    const result: ExtensionResponse = await chrome.runtime.sendMessage({ type, ...extra });
    if (!result?.ok) throw new Error(result?.error || "unavailable");
    state = result.state;
    render();
    if (type === "applyEco" && !state.ecoApplied) setStatus("settingsIncomplete");
    if (type === "restore" && state.report?.skipped.length) setStatus("restoreIncomplete");
  } catch (error) {
    // Ne pas afficher ON/OFF depuis un ancien état après un échec.
    modeNeedsCheck = true;
    document.querySelector("#mode")!.textContent = t("checkRequired");
    setStatus(error instanceof Error && error.message === "settingsUnconfirmed" ? "settingsUnconfirmed" : "unavailable");
  } finally {
    toggle.disabled = !state;
    cookiesToggle.disabled = !state || !state.enabled;
    aiToggle.disabled = !state || !state.enabled;
    tabsToggle.disabled = !state || !state.enabled;
    eco.disabled = !state || !state.enabled;
    restoreButton.disabled = !state || !Object.keys(state.backup).length;
  }
}
toggle.addEventListener("change", () => send("setWeb", { enabled: toggle.checked }));
cookiesToggle.addEventListener("change", () => send("setAutoDenyCookies", { enabled: cookiesToggle.checked }));
aiToggle.addEventListener("change", () => send("setFeature", { feature: "blockAI", enabled: aiToggle.checked }));
tabsToggle.addEventListener("change", () => send("setFeature", { feature: "ecoTab", enabled: tabsToggle.checked }));
eco.addEventListener("click", () => send("applyEco"));
restoreButton.addEventListener("click", () => send("restore"));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.googleLanguage) void translate();
});
void translate().then(() => send("getState"));
