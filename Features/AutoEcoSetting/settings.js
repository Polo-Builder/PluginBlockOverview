import { readState, save } from "../Shared/state.js";
import { changeWeb } from "../BlockOverviewIA/mode.js";
import { prediction, releasePrediction } from "./prediction.js";

export async function applyEco() {
  const state = await readState();
  const report = { title: "Paramétrage terminé", applied: [], skipped: [] };
  try {
    if (!state.enabled && state.backup.web === undefined) {
      state.backup.web = state.enabled;
      await save(state);
    }
    await changeWeb(state, true);
    report.applied.push("Résultats Web activés.");
  } catch {
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
  report.skipped.push("Labs et lecture automatique Google : réglages manuels, selon leur disponibilité.");
  state.report = report;
  await save(state);
  return state;
}

export async function restore() {
  const state = await readState();
  const report = { title: "Restauration terminée", applied: [], skipped: [] };
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
