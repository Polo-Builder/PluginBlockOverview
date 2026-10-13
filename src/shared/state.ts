import type { ExtensionState } from "./types.js";

export async function readState(): Promise<ExtensionState> {
  const { state } = await chrome.storage.local.get<{ state?: Partial<ExtensionState> }>("state");
  return { enabled: true, blockAI: true, ecoTab: true, autoDenyCookies: true, ecoApplied: false, backup: {}, report: null, ...state };
}
export const save = (state: ExtensionState) => chrome.storage.local.set({ state });
