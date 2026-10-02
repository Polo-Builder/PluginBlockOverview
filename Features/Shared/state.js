export async function readState() {
  const { state } = await chrome.storage.local.get("state");
  return { enabled: true, backup: {}, report: null, ...state };
}
export const save = (state) => chrome.storage.local.set({ state });
