# Assets (2026-09-16)
- `ities_logo_B.png`, `ities_logo_A.jpg`: original ITIES Detect logos (July 2026).
- `ities_icon_flat_1024.png`: flat macOS-style ITIES Detect icon (ChatGPT, 16.09.2026, from prompt 2). Use as the hub tile and app icon.
- `peakwise_icon_1024.png`: icon for the second tile (PeakWise / V-Peak, ChatGPT, 16.09.2026, prompt 1). Letters "PW" bottom-right.
- `makieta_ekran_analiza_chatgpt.png`: visual REFERENCE for the analysis screen (ChatGPT mockup, prompt 3). Not pixel-binding; the verdict card, mV scale, chart with points 1-4, sidebar grouping by sample are the parts to match.

Hub tiles use derived copies in `static/assets/`: `ities_icon_{256,512}.png` and
`peakwise_icon_{256,512}.png`. Each source is cropped to the bounding box of its opaque
rounded square (the baked-in drop shadow is dropped, the CSS supplies the shadow),
resized with Lanczos, then passed through `magick -selective-blur` to strip the
generation grain. 2.4 MB of sources become 362 KB of tiles.

Owner: Pawel Kwaczynski. Generated images, no third-party rights.
