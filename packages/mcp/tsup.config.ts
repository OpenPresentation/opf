import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const root = fileURLToPath(new URL("../../", import.meta.url));

// The skills the server serves as resources: SKILL.md and the references and assets of each, not the scripts and agent manifests
// (the server runs no script). Inlined as OPF_MCP_SKILLS.
function skillFiles(directory: string, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((entry) => {
        const file = path.join(directory, entry.name);
        const relative = prefix + entry.name;
        if (entry.isDirectory()) return /^(scripts|agents)$/.test(entry.name) && prefix === "" ? [] : Object.entries(skillFiles(file, `${relative}/`));
        if (!entry.isFile()) throw new Error("Bundled skills cannot contain symlinks or special files");
        return [[relative, readFileSync(file, "utf8").replaceAll("\r\n", "\n")]];
      }),
  );
}
const skills = Object.fromEntries(["opf-author", "opf-layout", "opf-presets", "opf-edit", "opf-export", "opf-inspect"].map((name) => [name, skillFiles(path.join(root, "skills", name))]));

// The recent release notes: the last few version sections of the root CHANGELOG (core's: the format, the validators and the engine).
// Package changelogs (CLI, renderer, PPTX, editor, gallery) have their own; this is the one an agent learning OPF needs.
const NOTES = 5;
function whatsNew(): string {
  const text = readFileSync(path.join(root, "CHANGELOG.md"), "utf8").replaceAll("\r\n", "\n");
  const sections = text.split(/^(?=## )/m).filter((section) => /^## \d+\.\d+\.\d+/.test(section));
  return `# What's new in OPF\n\nThe last ${Math.min(NOTES, sections.length)} releases from the CHANGELOG of @openpresentation/opf (the format, the validators and the engine), newest first. The renderer, PPTX, editor, CLI and gallery packages have their own changelogs, with the same version numbers.\n\n${sections.slice(0, NOTES).join("").trim()}\n`;
}

// Four entries: `index` (the server with its bundled data), `server` (the same without it), `stdio` (the Node wrapper) and `bin`
// (opf-mcp). `index` and `server` import no Node builtin: tests/mcp-workerd.test.mjs bundles them for a Worker and runs them in workerd.
export default defineConfig({
  entry: { index: "src/index.ts", server: "src/server.ts", stdio: "src/stdio.ts", bin: "src/bin.ts" },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts", server: "src/server.ts", stdio: "src/stdio.ts" } },
  define: { MCP_VERSION: JSON.stringify(manifest.version), OPF_CORE_VERSION: JSON.stringify(JSON.parse(readFileSync(path.join(root, "packages/javascript/package.json"), "utf8")).version), OPF_MCP_SKILLS: JSON.stringify(skills), OPF_MCP_WHATS_NEW: JSON.stringify(whatsNew()) },
  sourcemap: true,
  clean: true,
  target: "node24",
  platform: "node",
});
