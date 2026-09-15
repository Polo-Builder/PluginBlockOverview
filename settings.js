import { syncRedirect } from "./redirect.js";

export async function readState() {
  const { state } = await chrome.storage.local.get("state");
  return { enabled: true, backup: {}, report: null, ...state };
}
const save = (state) => chrome.storage.local.set({ state });
const prediction = () => chrome.privacy.network.networkPredictionEnabled;

export async function initialize() {
  const state = await readState();
  await syncRedirect(state.enabled);
  await save(state);
  return state;
}

async function changeWeb(state, enabled) {
  const previous = state.enabled;
  // Journaliser avant l'effet : le prochain réveil peut terminer une interruption.
  state.enabled = enabled;
  await save(state);
  try {
    await syncRedirect(enabled);
  } catch (error) {
    state.enabled = previous;
    await save(state);
    throw error;
  }
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
      await prediction().clear({ scope: "regular" });
      const after = await prediction().get({});
      if (after.levelOfControl === "controlled_by_this_extension") throw new Error("Consigne encore active");
      delete state.backup.prediction;
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
      // clear retire uniquement notre consigne ; set(previousValue) écraserait
      // les choix plus récents de l'utilisateur ou d'une autre extension.
      await prediction().clear({ scope: "regular" });
      const after = await prediction().get({});
      if (after.levelOfControl === "controlled_by_this_extension") {
        throw new Error("Consigne encore active");
      }
      delete state.backup.prediction;
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
