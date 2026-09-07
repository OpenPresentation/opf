import { copyFile, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(new URL("src/index.js", root), new URL("index.js", dist));
await copyFile(new URL("src/index.d.ts", root), new URL("index.d.ts", dist));

for (const name of ["svg.js","svg.d.ts","raster.js","fonts-browser.js","fonts-browser.d.ts","font-compatibility.js","fonts.js","fonts.d.ts","fonts-node.js","fonts-node.d.ts"]) await copyFile(new URL(`src/${name}`,root),new URL(name,dist));
