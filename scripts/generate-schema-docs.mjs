import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = path.join(repoRoot, "spec", "schemas");
const docsRoot = path.join(repoRoot, "docs");

function clean(value, max = 320) {
  if (!value) return "";
  const text = String(value)
    .replace(/\r?\n/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

function refName(ref) {
  return ref.split("/").at(-1) ?? ref;
}

function typeOf(schema) {
  if (!schema || typeof schema !== "object") return "unknown";
  if (schema.$ref) return `ref:${refName(schema.$ref)}`;
  if (schema.const !== undefined) return `const:${JSON.stringify(schema.const)}`;
  if (schema.enum) return `enum:${schema.enum.map(String).join(" | ")}`;
  if (schema.oneOf) return `oneOf:${schema.oneOf.map(typeOf).join(" / ")}`;
  if (schema.anyOf) return `anyOf:${schema.anyOf.map(typeOf).join(" / ")}`;
  if (schema.allOf) return `allOf:${schema.allOf.map(typeOf).join(" + ")}`;
  if (schema.type === "array") return `array<${typeOf(schema.items)}>`;
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (schema.type) return schema.type;
  if (schema.properties) return "object";
  if (schema.additionalProperties) return "object map";
  return "schema";
}

function requiredSet(schema) {
  return new Set(Array.isArray(schema.required) ? schema.required : []);
}

function propertyRows(schema) {
  if (!schema?.properties) return [];
  const required = requiredSet(schema);
  return Object.entries(schema.properties).map(([name, property]) => ({
    name,
    required: required.has(name) ? "yes" : "no",
    type: typeOf(property),
    description: clean(property.description, 220),
  }));
}

function table(rows) {
  if (rows.length === 0) return "_No named properties._\n";
  const lines = [
    "| Field | Required | Type | Notes |",
    "| --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(`| \`${row.name}\` | ${row.required} | \`${row.type.replaceAll("|", "\\|")}\` | ${row.description || ""} |`);
  }
  return `${lines.join("\n")}\n`;
}

function definitionDoc(name, schema) {
  const lines = [];
  lines.push(`### ${name}`);
  lines.push("");
  lines.push(`- Type: \`${typeOf(schema)}\``);
  const required = Array.isArray(schema.required) && schema.required.length > 0
    ? schema.required.map((field) => `\`${field}\``).join(", ")
    : "none";
  lines.push(`- Required fields: ${required}`);
  const description = clean(schema.description, 500);
  if (description) lines.push(`- Purpose: ${description}`);
  if (schema.anyOf) {
    const options = schema.anyOf
      .map((option) => option.required?.map((field) => `\`${field}\``).join(" and "))
      .filter(Boolean)
      .join(" or ");
    if (options) lines.push(`- Conditional requirement: ${options}`);
  }
  lines.push("");
  lines.push(table(propertyRows(schema)));
  return lines.join("\n");
}

async function loadSchema(file) {
  return JSON.parse(await readFile(path.join(schemaRoot, file), "utf8"));
}

async function writePresentationReference() {
  const schema = await loadSchema("opf.schema.json");
  const lines = [
    "# OPF Presentation Schema Reference",
    "",
    "This reference documents the author-facing shape of a complete `*.opf.json` presentation document. It summarizes the canonical schema in `spec/schemas/opf.schema.json`; the schema remains the source of truth for validators.",
    "",
    "## Document Contract",
    "",
    `- Schema id: \`${schema.$id}\``,
    `- Required top-level fields: ${(schema.required ?? []).map((field) => `\`${field}\``).join(", ")}`,
    `- Additional top-level fields: ${schema.additionalProperties === false ? "not allowed" : "allowed"}`,
    "",
    "## Top-Level Fields",
    "",
    table(propertyRows(schema)),
    "## Object And Type Reference",
    "",
  ];

  for (const [name, def] of Object.entries(schema.$defs ?? {})) {
    lines.push(definitionDoc(name, def));
    lines.push("");
  }

  await writeFile(path.join(docsRoot, "schema-reference.md"), `${lines.join("\n").trimEnd()}\n`, "utf8");
}

async function writeCatalogReference() {
  const files = (await readdir(schemaRoot))
    .filter((file) => file.endsWith(".schema.json") && file !== "opf.schema.json")
    .sort((a, b) => a.localeCompare(b));

  const lines = [
    "# OPF Catalog Schema Reference",
    "",
    "Catalog records are reusable presets that OPF documents reference by id. This page summarizes every companion schema in `spec/schemas/` except the top-level presentation schema.",
    "",
    "OPF documents usually reference these records with string ids such as `design.theme = \"minimal\"`, `tone = \"formal\"`, or `chart.type = \"line\"`. Dense examples may also embed catalog sources or inline records under `catalogs`.",
    "",
  ];

  for (const file of files) {
    const schema = await loadSchema(file);
    const title = clean(schema.title || file.replace(".schema.json", ""), 120);
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(`- File: \`spec/schemas/${file}\``);
    lines.push(`- Schema id: \`${schema.$id ?? "none"}\``);
    lines.push(`- Type: \`${typeOf(schema)}\``);
    const required = Array.isArray(schema.required) && schema.required.length > 0
      ? schema.required.map((field) => `\`${field}\``).join(", ")
      : "none";
    lines.push(`- Required fields: ${required}`);
    const description = clean(schema.description, 500);
    if (description) lines.push(`- Purpose: ${description}`);
    lines.push("");
    lines.push(table(propertyRows(schema)));

    const defs = Object.entries(schema.$defs ?? {});
    if (defs.length > 0) {
      lines.push("### Nested Types");
      lines.push("");
      for (const [name, def] of defs) {
        lines.push(`#### ${name}`);
        lines.push("");
        lines.push(`- Type: \`${typeOf(def)}\``);
        const defRequired = Array.isArray(def.required) && def.required.length > 0
          ? def.required.map((field) => `\`${field}\``).join(", ")
          : "none";
        lines.push(`- Required fields: ${defRequired}`);
        const defDescription = clean(def.description, 420);
        if (defDescription) lines.push(`- Purpose: ${defDescription}`);
        lines.push("");
        lines.push(table(propertyRows(def)));
      }
    }
  }

  await writeFile(path.join(docsRoot, "catalog-schema-reference.md"), `${lines.join("\n").trimEnd()}\n`, "utf8");
}

async function countExampleDecks() {
  const examplesRoot = path.join(repoRoot, "examples");
  let count = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".opf.json")) count += 1;
    }
  }
  await walk(examplesRoot);
  return count;
}

async function writeExamplesGuide() {
  const deckCount = await countExampleDecks();
  const lines = [
    "# OPF Examples Guide",
    "",
    "The `examples/` directory has two shipped layers, plus a docs fixture kept outside the catalog:",
    "",
    "- `examples/technical/` contains compact fixtures that isolate one or two schema behaviors.",
    "- `examples/gallery/` contains scenario-oriented decks that show OPF working across industries, functions, education, government, international, presentation-type, and design/media use cases.",
    `- The representative deck for [the published-package quickstart](quickstart.md) lives at [\`docs/quickstart/developer-quickstart.opf.json\`](quickstart/developer-quickstart.opf.json), outside the catalog, so \`@openpresentation/opf/examples\` stays at the published example count (currently ${deckCount} decks); the renderer golden corpus tracks that catalog on its own release cadence.`,
    "- The examples root is kept as an organizing directory rather than a home for standalone OPF files.",
    "",
    "## Technical Fixtures",
    "",
    "Use `examples/technical/` when you want a small file that exercises a specific schema surface:",
    "",
    "- content payloads, rich text, blocks, charts, tables, media, metrics, quotes, and timelines",
    "- promoted region keys and span combinations",
    "- asset string/object forms and asset-backed chart data",
    "- design backgrounds, logo sets, headers, footers, watermarks, and slide-level overrides",
    "- metadata array forms, language metadata, narrative beats, and catalog overrides",
    "",
    "## Gallery Folders",
    "",
    "| Folder | What It Demonstrates |",
    "| --- | --- |",
    "| `industries/` | Vertical market decks with operating plans, investment briefs, readiness reviews, and launch coordination. |",
    "| `business-functions/` | Department-specific decks for sales, marketing, product, engineering, finance, HR, legal, security, support, procurement, and strategy. |",
    "| `education/` | K-12, higher education, research, advising, workforce, advancement, and student services scenarios. |",
    "| `government/` | Public health, transit, emergency management, utilities, regulators, courts, parks, workforce, tax, and civic engagement decks. |",
    "| `presentation-types/` | Reusable deck archetypes such as pitches, board updates, QBRs, conference talks, workshops, postmortems, launches, policy briefings, training, and research reports. |",
    "| `international/` | Region- or language-specific decks, including examples of language object metadata and right-to-left direction. |",
    "| `design-and-media/` | Decks that emphasize design controls, image/video assets, data storytelling, and self-running orientation patterns. |",
    "",
    "## Patterns To Look For",
    "",
    "- Technical fixtures that isolate validator and renderer behavior.",
    "- Sparse gallery documents that use shorthand catalog references and a small slide list.",
    "- Medium documents with schema ids, metadata, organization and speaker records, design overrides, assets, and richer slide payloads.",
    "- Dense documents with inline `catalogs` sources and records, promoted region keys, `blocks`, media assets, code payloads, header/footer configuration, logo sets, watermarks, and extensions.",
    "- Mixed content payloads across text, bullets, lists, image, video, chart, table, code, metric, quote, and timeline slides.",
    "- Catalog references across narratives, layouts, chart types, themes, color schemes, font schemes, languages, audiences, purposes, tones, and social platforms.",
    "",
    "## Validation",
    "",
    "Run the example validator after changing any `*.opf.json` file:",
    "",
    "```sh",
    "node scripts/validate-examples.mjs",
    "```",
    "",
    "The script walks every OPF document under `examples/` and reports schema or semantic validation issues with file paths.",
  ];

  await writeFile(path.join(docsRoot, "examples.md"), `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  await writePresentationReference();
  await writeCatalogReference();
  await writeExamplesGuide();
  console.log("wrote schema and examples docs");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
