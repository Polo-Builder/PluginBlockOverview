const toggle = document.querySelector("#enabled");
const cookiesToggle = document.querySelector("#auto-deny-cookies");
const eco = document.querySelector("#eco");
const restoreButton = document.querySelector("#restore");
const status = document.querySelector("#status");
let state;

function render() {
  toggle.checked = state.enabled;
  cookiesToggle.checked = state.autoDenyCookies;
  document.querySelector("#mode").textContent = state.enabled ? "ON" : "OFF";
  restoreButton.disabled = Object.keys(state.backup).length === 0;
  status.replaceChildren();
  if (!state.report) return;
  const details = document.createElement("details");
  const title = document.createElement("summary");
  title.textContent = state.report.title;
  if (state.report.skipped.length) title.textContent += " · points à vérifier";
  details.append(title);
  status.append(details);
  for (const [key, label] of [["applied", "Appliqué / déjà en place"], ["skipped", "Non appliqué automatiquement"]]) {
    if (!state.report[key].length) continue;
    const heading = document.createElement("strong");
    heading.textContent = label;
    const list = document.createElement("ul");
    for (const text of state.report[key]) {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    }
    details.append(heading, list);
  }
}

async function send(type, extra = {}) {
  for (const control of [toggle, cookiesToggle, eco, restoreButton]) control.disabled = true;
  status.textContent = "Vérification en cours…";
  try {
    const result = await chrome.runtime.sendMessage({ type, ...extra });
    if (!result?.ok) throw new Error(result?.error || "Extension indisponible.");
    state = result.state;
    render();
  } catch (error) {
    // Ne pas afficher ON/OFF depuis un ancien état après un échec.
    document.querySelector("#mode").textContent = "à vérifier";
    status.textContent = error.message;
  } finally {
    toggle.disabled = !state;
    cookiesToggle.disabled = !state || !state.enabled;
    eco.disabled = !state || !state.enabled;
    restoreButton.disabled = !state || !Object.keys(state.backup).length;
  }
}
toggle.addEventListener("change", () => send("setWeb", { enabled: toggle.checked }));
cookiesToggle.addEventListener("change", () => send("setAutoDenyCookies", { enabled: cookiesToggle.checked }));
eco.addEventListener("click", () => send("applyEco"));
restoreButton.addEventListener("click", () => send("restore"));
send("getState");
