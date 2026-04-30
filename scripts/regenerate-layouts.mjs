import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const layoutsDir = path.join(repoRoot, "spec", "layouts");
const extractDir = path.join(layoutsDir, "extract");

const schema = "https://pptx.dev/schema/opf-layout/v1";

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readJsonIfExists(file, fallback) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function nameToId(name) {
  return name.replace(/_/g, "-").toLowerCase();
}

function labelFromName(name) {
  return name.replace(/_/g, " ");
}

function lowerNone(value) {
  if (!value || value === "None") return undefined;
  return String(value).toLowerCase();
}

function countFromMultiple(value) {
  if (!value || value === "None") return 1;
  const match = /^(\d+)x$/.exec(value);
  return match ? Number(match[1]) : 1;
}

function groupByLayoutId(placeholders) {
  const byLayout = new Map();
  for (const placeholder of placeholders) {
    const group = byLayout.get(placeholder.layout_id) ?? [];
    group.push(placeholder);
    byLayout.set(placeholder.layout_id, group);
  }
  for (const group of byLayout.values()) {
    group.sort((a, b) => a.id - b.id);
  }
  return byLayout;
}

function isTitleCover(layout, contentPlaceholders) {
  return layout.content_type === "Title" && contentPlaceholders.some((placeholder) => placeholder.type === "BODY");
}

function toOpfPlaceholderType(type) {
  switch (type) {
    case "BODY":
      return "body";
    case "OBJECT":
      return "content";
    case "CHART":
      return "chart";
    case "PICTURE":
      return "picture";
    default:
      throw new Error(`Unsupported content placeholder type: ${type}`);
  }
}

function extractPlaceholders(layout, placeholdersByLayout) {
  const contentPlaceholders = (placeholdersByLayout.get(layout.id) ?? []).filter(
    (placeholder) =>
      placeholder.type !== "SLIDE_NUMBER" &&
      placeholder.type !== "DATE_AND_TIME" &&
      placeholder.type !== "FOOTER",
  );

  const placeholders = [];
  let bodySeen = 0;
  const titleCover = isTitleCover(layout, contentPlaceholders);

  for (const placeholder of contentPlaceholders) {
    if (placeholder.type === "BODY" && titleCover && bodySeen === 0) {
      placeholders.push({ type: "subtitle" });
      bodySeen += 1;
      continue;
    }
    if (placeholder.type === "BODY") bodySeen += 1;
    placeholders.push({ type: toOpfPlaceholderType(placeholder.type) });
  }

  if (layout.slide_title) {
    placeholders.unshift({ type: "title" });
  }
  if (layout.slide_tag) {
    placeholders.unshift({ type: "tag" });
  }

  return placeholders;
}

function legacyRecord(layout, placeholdersByLayout, overrides) {
  const id = nameToId(layout.name);
  const placeholders = extractPlaceholders(layout, placeholdersByLayout);
  const titleCover = placeholders.some((placeholder) => placeholder.type === "subtitle");

  return {
    $schema: schema,
    id,
    name: layout.name,
    label: labelFromName(layout.name),
    contentAlignment: layout.content_alignment,
    contentBox: layout.content_box,
    contentMultiple: layout.content_multiple,
    contentTypeChartPrimary: layout.content_type_chart_primary,
    contentTypeImageFill: layout.content_type_image_fill,
    contentTypeListBullet: layout.content_type_list_bullet,
    contentTypeListHeading: layout.content_type_list_heading,
    contentType: layout.content_type,
    groupDefault: layout.group_default,
    groupHash: layout.group_hash,
    master: layout.master,
    masterSlideIndex: layout.index,
    slideImage: layout.slide_image,
    slideImageAlignment: layout.slide_image_alignment,
    slideLayoutDirection: layout.slide_layout_direction,
    slideSubtitle: titleCover,
    slideTitle: layout.slide_title,
    slideTitleAlignment: layout.slide_title_alignment,
    bleed: layout.name.startsWith("Image_Only_"),
    placeholders,
    ...(overrides[id] ?? {}),
  };
}

function canonicalRecord(canonical) {
  return {
    $schema: schema,
    id: canonical.id,
    name: canonical.name,
    placeholders: canonical.placeholders,
  };
}

function indexRecord(record) {
  return {
    id: record.id,
    name: record.name,
    file: `${record.id}.json`,
  };
}

async function cleanLayoutFiles() {
  const files = await fs.readdir(layoutsDir);
  await Promise.all(
    files
      .filter((file) => file.endsWith(".json") && file !== "index.json")
      .map((file) => fs.rm(path.join(layoutsDir, file))),
  );
}

async function writeCatalog(records) {
  await cleanLayoutFiles();
  const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));
  await Promise.all(sorted.map((record) => writeJson(path.join(layoutsDir, `${record.id}.json`), record)));
  await writeJson(path.join(layoutsDir, "index.json"), {
    $schema: "https://pptx.dev/schema/opf-layout-index/v1",
    version: "1",
    description:
      "Catalog of slide layouts available in the pptx.dev library. Each entry is a lightweight summary; full layout records live in the per-id JSON files alongside this index.",
    records: sorted.map(indexRecord),
  });
}

async function regenerateLegacyPlaceholders({ layouts, placeholdersByLayout, overrides }) {
  const records = layouts.map((layout) => legacyRecord(layout, placeholdersByLayout, overrides));
  await writeCatalog(records);
  return records;
}

async function regenerateCanonical({ canonical }) {
  const records = canonical.map((record) => canonicalRecord(record));
  await writeCatalog(records);
  return records;
}

const mode = process.argv.includes("--legacy-placeholders") ? "legacy-placeholders" : "canonical";
const canonical = await readJson(path.join(extractDir, "canonical.json"));
const layouts = await readJsonIfExists(path.join(extractDir, "layout.json"), []);
const placeholders = await readJsonIfExists(path.join(extractDir, "placeholder.json"), []);
const placeholdersByLayout = groupByLayoutId(placeholders);
const overrides = await readJsonIfExists(path.join(extractDir, "overrides.json"), {});

if (mode === "legacy-placeholders" && (layouts.length === 0 || placeholders.length === 0)) {
  throw new Error("--legacy-placeholders requires spec/layouts/extract/layout.json and placeholder.json");
}

const records =
  mode === "legacy-placeholders"
    ? await regenerateLegacyPlaceholders({ layouts, placeholdersByLayout, overrides })
    : await regenerateCanonical({ canonical });

console.log(`Regenerated ${records.length} layout records in ${mode} mode.`);
