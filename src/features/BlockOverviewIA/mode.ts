import { syncRedirect } from "./redirect.js";
import { save } from "../../shared/state.js";
import type { ExtensionState } from "../../shared/types.js";

export async function changeWeb(state: ExtensionState, enabled: boolean) {
  const previous = state.enabled;
  // Journaliser avant l'effet : le prochain réveil peut terminer une interruption.
  state.enabled = enabled;
  await save(state);
  try {
    await syncRedirect(enabled && state.blockAI);
  } catch (error) {
    state.enabled = previous;
    await save(state);
    throw error;
  }
}

