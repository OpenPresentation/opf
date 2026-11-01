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

// CE-18: the studio kit is a folder of internal modules (src/studio-kit/), copied as it is; no package subpath exports it yet.
for (const folder of ["studio-kit"]) {
  await mkdir(new URL(`${folder}/`, dist), { recursive: true });
  for (const entry of await readdir(new URL(`${folder}/`, src))) {
    if (entry.endsWith(".js") || entry.endsWith(".d.ts")) {
      await copyFile(new URL(`${folder}/${entry}`, src), new URL(`${folder}/${entry}`, dist));
    }
  }
}

// RR-98: dist/styles.css is the token layer plus the component styles, generated from src/styles/*.css (see scripts/build-styles.mjs).
// CE-29: dist/styles.layered.css is the same file inside `@layer opf`.
const styles = await buildStyles(new URL("styles/", src));
await writeFile(new URL("styles.css", dist), styles.css);
await writeFile(new URL("styles.layered.css", dist), styles.layered);
