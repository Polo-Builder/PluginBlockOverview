import { initialize, setWeb, setAutoDenyCookies, setFeature } from "./shared/settings.js";
import { readState } from "./shared/state.js";
import { applyEco, restore } from "./features/AutoEcoSetting/settings.js";
import type { ExtensionMessage, ExtensionState, MessageType } from "./shared/types.js";

// Une file unique évite les conflits entre popup, installation et redémarrage.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
}
const start = () => enqueue(initialize).catch(() => {
  console.error("Initialisation impossible. Ouvrez la popup pour réessayer.");
});
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  const operations: Record<MessageType, () => Promise<ExtensionState>> = {
    getState: readState,
    setWeb: () => setWeb(message.enabled!),
    setAutoDenyCookies: () => setAutoDenyCookies(message.enabled!),
    setFeature: () => setFeature(message.feature!, message.enabled!),
    applyEco,
    restore
  };
  if (!Object.hasOwn(operations, message?.type)) return false;
  enqueue(async () => {
    await initialize();
    return operations[message.type]();
  }).then(
    (state) => reply({ ok: true, state }),
    () => reply({ ok: false, error: "Le réglage n’a pas pu être confirmé. Rouvrez la popup pour réessayer." })
  );
  return true;
});
