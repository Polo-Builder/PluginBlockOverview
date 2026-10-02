import { syncRedirect } from "./redirect.js";
import { save } from "../Shared/state.js";

export async function changeWeb(state, enabled) {
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

