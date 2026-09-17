// Partner logos for the footer of the hub and both analysers.
//
// Grey by default, full colour on hover, no outgoing links: this is a lab tool, not a
// page that sends anyone anywhere. A file that is not on the server removes its own
// node instead of leaving an empty frame, so the row never shows a placeholder.
import { onLangChange, t } from "./i18n.js";

// The row is 28 px tall; each file gets its own optical height in ui.css, because the
// white margin baked into a logo is not the same in all three.
const LOGO_HEIGHT = 28;

const PARTNERS = [
  { id: "ul", key: "partner.ul", file: "ul-logo.png", width: 940, height: 330 },
  { id: "ahe", key: "partner.ahe", file: "ahe-logo-pl.png", width: 249, height: 96 },
];

export function mountPartners(host) {
  if (!host) return;
  const paint = () => {
    host.innerHTML = "";
    host.className = "partner-logos";
    for (const partner of PARTNERS) {
      const img = document.createElement("img");
      img.className = "partner-logo partner-" + partner.id;
      img.src = `/assets/partners/${partner.file}`;
      img.height = LOGO_HEIGHT;
      img.width = Math.round((partner.width / partner.height) * LOGO_HEIGHT);
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = t(partner.key);
      img.dataset.tooltipKey = partner.key;
      img.addEventListener("error", () => img.remove(), { once: true });
      host.appendChild(img);
    }
  };
  paint();
  onLangChange(paint);
}
