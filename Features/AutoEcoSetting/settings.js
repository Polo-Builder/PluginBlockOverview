import { readState, save } from "../../Shared/state.js";
import { changeWeb } from "../BlockOverviewIA/mode.js";
import { prediction, releasePrediction } from "./prediction.js";

export async function applyEco() {
  const state = await readState();
  const report = { title: "Paramétrage terminé", applied: [], skipped: [] };
  state.ecoApplied = false;
  const previousBlockAI = state.blockAI;
  try {
    if (!state.enabled && state.backup.web === undefined) {
      state.backup.web = state.enabled;
      await save(state);
    }
    if (!state.blockAI && state.backup.blockAI === undefined) state.backup.blockAI = false;
    state.blockAI = true;
    await changeWeb(state, true);
    report.applied.push("Résultats Web activés.");
  } catch {
    state.blockAI = previousBlockAI;
    report.skipped.push("Mode Web : échec de l’enregistrement. Réessayez.");
  }

  try {
    const before = await prediction().get({});
    if (before.value === false) {
      report.applied.push("Préchargement Chrome déjà désactivé.");
    } else if (before.levelOfControl !== "controllable_by_this_extension" &&
               before.levelOfControl !== "controlled_by_this_extension") {
      report.skipped.push("Préchargement : géré par une autre extension ou votre organisation.");
    } else {
      if (!state.backup.prediction) {
        state.backup.prediction = { previousValue: before.value };
        await save(state);
      }
      await prediction().set({ value: false, scope: "regular" });
      const after = await prediction().get({});
      if (after.value !== false || after.levelOfControl !== "controlled_by_this_extension") {
        // Retirer notre éventuelle consigne latente si une politique gagne entre-temps.
        await prediction().clear({ scope: "regular" });
        delete state.backup.prediction;
        report.skipped.push("Préchargement : Chrome n’a pas confirmé la modification.");
      } else {
        report.applied.push("Préchargement désactivé dans tout Chrome.");
      }
    }
  } catch {
    report.skipped.push("Préchargement : modification non confirmée. Réessayez ou restaurez.");
  }
  state.ecoApplied = report.skipped.length === 0;
  state.report = report;
  await save(state);
  return state;
}

export async function restore() {
  const state = await readState();
  const report = { title: "Restauration terminée", applied: [], skipped: [] };
  state.ecoApplied = false;
  if (state.backup.blockAI !== undefined) {
    const previous = state.blockAI;
    try {
      state.blockAI = state.backup.blockAI;
      await changeWeb(state, state.enabled);
      delete state.backup.blockAI;
      report.applied.push("Votre choix précédent pour le blocage IA est rétabli.");
    } catch {
      state.blockAI = previous;
      report.skipped.push("Blocage IA : restauration impossible. Réessayez.");
    }
  }
  if (state.backup.web !== undefined) {
    try {
      await changeWeb(state, state.backup.web);
      delete state.backup.web;
      report.applied.push("Votre choix précédent pour le mode Web est rétabli.");
    } catch {
      report.skipped.push("Mode Web : restauration impossible. Réessayez.");
    }
  }
  if (state.backup.prediction) {
    try {
      await releasePrediction(state);
      report.applied.push("Préchargement : contrôle rendu à vos réglages Chrome.");
    } catch {
      report.skipped.push("Préchargement : restauration impossible. Réessayez.");
    }
  }
  if (!report.applied.length && !report.skipped.length) {
    report.applied.push("Aucun réglage automatique à restaurer.");
  }
  if (report.skipped.length) report.title = "Restauration incomplète";
  state.report = report;
  await save(state);
  return state;
}
