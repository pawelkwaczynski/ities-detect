// A click on the PeakWise mark opens it large enough to look at.
//
// Same behaviour and same markup as the shared preview used by ITIES Detect
// (static/shared/logopreview.js, addendum 4 point GG): one dialog per page, built on
// first use, any click or Escape closes it, focus returns to whatever opened it.
// PeakWise keeps its own copy because the shared module points at the ITIES icon file
// and at the ITIES dictionary, and neither is right here.
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
  // The largest file PeakWise has, straight and with no srcset: this is the one place
  // that wants the whole thing.
  img.src = "/assets/peakwise_icon_512.png";
  img.width = 512;
  img.height = 512;
  img.alt = t("app.name");
  const caption = document.createElement("figcaption");
  const name = document.createElement("strong");
  name.className = "logo-lightbox-name";
  name.textContent = t("app.name");
  const line = document.createElement("p");
  line.className = "logo-lightbox-line";
  line.textContent = t("app.tagline");
  caption.append(name, line);
  figure.append(img, caption);
  dialog.appendChild(figure);
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

export function wireLogoPreview(element) {
  if (!element) return;
  element.dataset.tooltipKey = "tip.logoZoom";
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openLogoPreview(element);
  });
}
