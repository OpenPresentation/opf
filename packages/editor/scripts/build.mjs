import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { buildStyles } from "./build-styles.mjs";

const root = new URL("../", import.meta.url);
const src = new URL("src/", root);
const dist = new URL("dist/", root);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of await readdir(src)) {
  if (entry.endsWith(".js") || entry.endsWith(".d.ts")) {
    await copyFile(new URL(entry, src), new URL(entry, dist));
  }
}

// RR-98: dist/styles.css is the token layer plus the component styles, generated from src/styles/*.css (see scripts/build-styles.mjs).
await writeFile(new URL("styles.css", dist), (await buildStyles(new URL("styles/", src))).css);
