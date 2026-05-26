import { copyFile, mkdir, readdir, rm } from "node:fs/promises";

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
