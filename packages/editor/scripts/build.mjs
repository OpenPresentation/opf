import { copyFile, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(new URL("src/index.js", root), new URL("index.js", dist));
await copyFile(new URL("src/index.d.ts", root), new URL("index.d.ts", dist));
