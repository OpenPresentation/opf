import { copyFile, mkdir, rm } from "node:fs/promises";
import './verify-vendor.mjs';

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(new URL("src/index.js", root), new URL("index.js", dist));
await copyFile(new URL('src/code-provenance.js', root), new URL('code-provenance.js', dist));
await copyFile(new URL('src/metric-provenance.js', root), new URL('metric-provenance.js', dist));
await copyFile(new URL('src/card-provenance.js', root), new URL('card-provenance.js', dist));
await copyFile(new URL('src/heading-provenance.js', root), new URL('heading-provenance.js', dist));
await copyFile(new URL('src/text-provenance.js', root), new URL('text-provenance.js', dist));
await copyFile(new URL('src/timeline-provenance.js', root), new URL('timeline-provenance.js', dist));
await copyFile(new URL('src/chart-workbook.js', root), new URL('chart-workbook.js', dist));
await copyFile(new URL("src/index.d.ts", root), new URL("index.d.ts", dist));
await copyFile(new URL("src/image-geometry.js", root), new URL("image-geometry.js", dist));
for (const name of ['image-fallback-node.js', 'image-fallback-browser.js']) {
  await copyFile(new URL(`src/${name}`, root), new URL(name, dist));
}

await copyFile(new URL('src/background.js', root), new URL('background.js', dist));
await copyFile(new URL('src/background-import.js', root), new URL('background-import.js', dist));
await copyFile(new URL('src/image-import.js', root), new URL('image-import.js', dist));

await copyFile(new URL('src/table-import.js', root), new URL('table-import.js', dist));
await copyFile(new URL('src/table-cell-import.js', root), new URL('table-cell-import.js', dist));
await copyFile(new URL('src/table-border-import.js', root), new URL('table-border-import.js', dist));
