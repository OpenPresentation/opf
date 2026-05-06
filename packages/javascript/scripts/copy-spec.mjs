import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");

const destination = path.join(packageRoot, "dist", "spec");
const source = path.join(repoRoot, "spec");

await fs.rm(destination, { recursive: true, force: true });
await fs.cp(source, destination, { recursive: true });
