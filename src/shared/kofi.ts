export {};

const supportButton = document.querySelector<HTMLButtonElement>("#kofi-button")!;
const panel = document.querySelector<HTMLElement>("#kofi-panel")!;
const closeButton = document.querySelector<HTMLButtonElement>("#kofi-close")!;
const frame = document.querySelector<HTMLIFrameElement>("#kofiframe")!;

function setOpen(open: boolean) {
  // Comme le widget Ko-fi, ne charger le panneau qu’au premier clic.
  if (open && !frame.hasAttribute("src")) frame.src = frame.dataset.src!;
  panel.hidden = !open;
  supportButton.setAttribute("aria-expanded", String(open));
  if (open) closeButton.focus();
  else supportButton.focus();
}

supportButton.addEventListener("click", () => setOpen(panel.hidden !== false));
closeButton.addEventListener("click", () => setOpen(false));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !panel.hidden) {
    event.preventDefault();
    setOpen(false);
  }
});
