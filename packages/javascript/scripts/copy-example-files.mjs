// Copies the local files the bundled examples reference (./assets/logo.svg and the like) into dist/example-files/, keeping their
// path under examples/. `opf create --example <slug>` copies the ones its deck names next to the new deck, so the deck is
// self-contained. Only files an example names are copied, so nothing unused is published.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = path.resolve(packageRoot, "../../examples");
const destination = path.join(packageRoot, "dist", "example-files");

async function* decks(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* decks(file);
    else if (entry.name.endsWith(".opf.json")) yield file;
  }
}

function* strings(value) {
  if (typeof value === "string") yield value;
  else if (value && typeof value === "object") for (const child of Object.values(value)) yield* strings(child);
}

await fs.rm(destination, { recursive: true, force: true });
const copied = new Set();
for await (const deck of decks(examplesRoot)) {
  const folder = path.dirname(deck);
  for (const text of strings(JSON.parse(await fs.readFile(deck, "utf8")))) {
    if (!text.startsWith("./")) continue;
    const source = path.resolve(folder, text);
    if (path.relative(examplesRoot, source).startsWith("..") || copied.has(source)) continue;
    const stat = await fs.stat(source).catch(() => undefined);
    if (!stat?.isFile()) continue;
    copied.add(source);
    const target = path.join(destination, path.relative(examplesRoot, source));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }
}
console.log(`copy-example-files: ${copied.size} files`);
