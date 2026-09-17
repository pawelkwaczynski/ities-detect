// A click on the application logo opens it large enough to look at.
//
// One dialog per page, built on first use: the icon at 512 px from the 1024 px file,
// the application name and one sentence underneath. Any click and Escape close it,
// and the focus goes back to whatever opened it. No buttons, no chrome, nothing to
// learn (addendum 4, point GG).
import { t } from "./i18n.js";

let dialog = null;
let opener = null;

function build() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "logo-lightbox";
  const figure = document.createElement("figure");
  const img = document.createElement("img");
  img.className = "logo-lightbox-image";
  // The 1024 px file straight, with no srcset: this is the one place that wants the
  // whole thing, and the browser must not pick a smaller candidate for it.
  img.src = "/assets/ities_icon_1024.png";
  img.width = 512;
  img.height = 512;
  img.alt = t("app.name");
  const caption = document.createElement("figcaption");
  // Two block elements, so the name and the sentence stay on separate lines even
  // before the stylesheet has a say.
  const name = document.createElement("strong");
  name.className = "logo-lightbox-name";
  name.textContent = t("app.name");
  const line = document.createElement("p");
  line.className = "logo-lightbox-line";
  line.textContent = t("app.taglineFull");
  caption.append(name, line);
  figure.append(img, caption);
  dialog.appendChild(figure);
  // A click anywhere closes it, the image included: there is nothing else to do here.
  dialog.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    opener?.focus?.();
    opener = null;
  });
  document.body.appendChild(dialog);
  return dialog;
}

export function openLogoPreview(trigger) {
  const node = build();
  opener = trigger || null;
  if (!node.open) node.showModal();
}

// Makes one element open the preview: a real button when it can be one, a plain click
// target inside a link (the hub tile) when it cannot.
export function wireLogoPreview(element, { keyboard = true } = {}) {
  if (!element) return;
  element.dataset.tooltipKey = "tip.logoZoom";
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openLogoPreview(element);
  });
  if (keyboard) {
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        openLogoPreview(element);
      }
    });
  }
}
