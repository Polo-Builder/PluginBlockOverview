import type { ExtensionMessage, ExtensionResponse, ExtensionState, MessageType } from "../shared/types.js";

const toggle = document.querySelector<HTMLInputElement>("#enabled")!;
const cookiesToggle = document.querySelector<HTMLInputElement>("#auto-deny-cookies")!;
const aiToggle = document.querySelector<HTMLInputElement>("#block-ai")!;
const tabsToggle = document.querySelector<HTMLInputElement>("#eco-tab")!;
const eco = document.querySelector<HTMLButtonElement>("#eco")!;
const restoreButton = document.querySelector<HTMLButtonElement>("#restore")!;
const status = document.querySelector<HTMLElement>("#status")!;
let state: ExtensionState | undefined;

function render() {
  if (!state) return;
  toggle.checked = state.enabled;
  cookiesToggle.checked = state.autoDenyCookies;
  aiToggle.checked = state.blockAI;
  tabsToggle.checked = state.ecoTab;
  document.querySelector<HTMLElement>("#eco-done")!.hidden = !state.ecoApplied;
  document.querySelector("#mode")!.textContent = state.enabled ? "ON" : "OFF";
  restoreButton.disabled = Object.keys(state.backup).length === 0;
  status.replaceChildren();
}

async function send(type: MessageType, extra: Partial<ExtensionMessage> = {}) {
  for (const control of [toggle, cookiesToggle, aiToggle, tabsToggle, eco, restoreButton]) control.disabled = true;
  status.textContent = "Vérification en cours…";
  try {
    const result: ExtensionResponse = await chrome.runtime.sendMessage({ type, ...extra });
    if (!result?.ok) throw new Error(result?.error || "Extension indisponible.");
    state = result.state;
    render();
    if (type === "applyEco" && !state.ecoApplied) status.textContent = "Réglages incomplets. Réessayez.";
    if (type === "restore" && state.report?.skipped.length) status.textContent = "Restauration incomplète. Réessayez.";
  } catch (error) {
    // Ne pas afficher ON/OFF depuis un ancien état après un échec.
    document.querySelector("#mode")!.textContent = "à vérifier";
    status.textContent = error instanceof Error ? error.message : "Extension indisponible.";
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
send("getState");
