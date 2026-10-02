import { syncRedirect } from "../BlockOverviewIA/redirect.js";
import { changeWeb } from "../BlockOverviewIA/mode.js";
import { releasePrediction } from "../AutoEcoSetting/prediction.js";
import { readState, save } from "./state.js";

export async function initialize() {
  const state = await readState();
  await syncRedirect(state.enabled);
  await save(state);
  return state;
}

export async function setWeb(enabled) {
  if (typeof enabled !== "boolean") throw new Error("Préférence invalide.");
  const state = await readState();
  await changeWeb(state, enabled);
  // L'interrupteur pilote toute l'extension. OFF libère aussi le réglage Chrome.
  delete state.backup.web;
  state.report = null;
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

