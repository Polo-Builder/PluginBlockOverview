import { initialize, readState, setWeb, applyEco, restore } from "./settings.js";

// Une file unique évite les conflits entre popup, installation et redémarrage.
let queue = Promise.resolve();
function enqueue(operation) {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
}
const start = () => enqueue(initialize).catch(() => {
  console.error("Initialisation impossible. Ouvrez la popup pour réessayer.");
});
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  const operations = {
    getState: readState,
    setWeb: () => setWeb(message.enabled),
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
