import { syncRedirect } from "../features/BlockOverviewIA/redirect.js";
import { changeWeb } from "../features/BlockOverviewIA/mode.js";
import { prediction, releasePrediction } from "../features/AutoEcoSetting/prediction.js";
import { readState, save } from "./state.js";
import type { Feature } from "./types.js";

export async function initialize() {
  const state = await readState();
  await syncRedirect(state.enabled && state.blockAI);
  if (state.ecoApplied) {
    try {
      state.ecoApplied = state.enabled && state.blockAI && (await prediction().get({})).value === false;
    } catch { state.ecoApplied = false; }
  }
  await save(state);
  return state;
}

export async function setAutoDenyCookies(enabled: boolean) {
  if (typeof enabled !== "boolean") throw new Error("Préférence invalide.");
  const state = await readState();
  state.autoDenyCookies = enabled;
  await save(state);
  return state;
}

export async function setFeature(feature: Feature, enabled: boolean) {
  if (!["blockAI", "ecoTab"].includes(feature) || typeof enabled !== "boolean") {
    throw new Error("Préférence invalide.");
  }
  const state = await readState();
  const previous = state[feature];
  state[feature] = enabled;
  await save(state);
  if (feature === "blockAI") {
    try { await syncRedirect(state.enabled && enabled); }
    catch (error) {
      state[feature] = previous;
      await save(state);
      throw error;
    }
    delete state.backup.blockAI;
    if (!enabled) state.ecoApplied = false;
  }
  await save(state);
  return state;
}

export async function setWeb(enabled: boolean) {
  if (typeof enabled !== "boolean") throw new Error("Préférence invalide.");
  const state = await readState();
  await changeWeb(state, enabled);
  // L'interrupteur pilote toute l'extension. OFF libère aussi le réglage Chrome.
  delete state.backup.web;
  state.report = null;
  if (!enabled) state.ecoApplied = false;
  if (!enabled && state.backup.prediction) {
    try {
      await releasePrediction(state);
    } catch {
      state.report = {
        title: "Plugin désactivé avec une restauration incomplète",
        applied: ["Redirection des recherches Google désactivée."],
        skipped: ["Préchargement Chrome : restauration impossible. Réessayez avec le bouton de restauration."]
      };
    }
  }
  await save(state);
  return state;
}

