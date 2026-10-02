import { copyFile, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(new URL("src/index.js", root), new URL("index.js", dist));
await copyFile(new URL("src/index.d.ts", root), new URL("index.d.ts", dist));

for (const name of ["svg.js","svg.d.ts","charts.js","raster.js","raster-text.js","raster-images.js","pdf-vector.js","pdf-text.js","pdf-fonts.js","pdf-subset.js","pdf-style.js","pdf-xml.js","pdf-writer.js","fonts-browser.js","fonts-browser.d.ts","font-compatibility.js","font-manifest.js","font-policy.js","lazy-font-list.js","symbol-fonts.js","symbol-encodings.js","color-fonts.js","lazy-fonts.js","script-fonts.js","script-font-pack.js","fonts.js","fonts.d.ts","fonts-node.js","fonts-node.d.ts","sha256.js","export-browser.js","export-browser.d.ts"]) await copyFile(new URL(`src/${name}`,root),new URL(name,dist));

// RR-28: the player and the <opf-deck> element (`/player`, `/element`, `/element/define`), kept on their own line so other work on the list above does not collide.
for (const name of ["deck-runtime.js","preview-fonts.js","preview-fonts-node.js","preview-fonts-cli.js","element.js","element.d.ts","element-define.js","element-define.d.ts","player.js","player.d.ts","preview-fonts.d.ts","preview-fonts-node.d.ts"]) await copyFile(new URL(`src/${name}`,root),new URL(name,dist));
