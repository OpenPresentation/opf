#!/usr/bin/env node
// LH-14: writes the icon-set records of catalog/icon-sets/ from the pinned npm packages (devDependencies of this package), so
// nobody edits them by hand:
//
//   node scripts/build-icon-sets.mjs            write catalog/icon-sets/<id>.json and index.json, then run `npm run rehash`
//   node scripts/build-icon-sets.mjs --check    fail when the records differ from what the pinned packages give
//
// Each set is one record (spec/schemas/icon-set.schema.json): its license, copyright, version and source, the one viewBox and
// style its icons share, and each icon as SVG path data. Every element of an icon (path, circle, ellipse, rect, line, polyline,
// polygon) becomes path commands here, so engines read one form: a string is the path a stroke icon strokes, `{ stroke, fill }`
// separates the parts the source fills (`fill="currentColor"`; also stroked unless `stroke="none"`). An invisible element (stroke
// and fill both none: Tabler's 24 x 24 bounding box) is dropped. `tags` are the source package's search keywords.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(packageRoot, "catalog", "icon-sets");
const SCHEMA = "https://openpresentation.org/schema/opf-icon-set/v1";
const NOTICES = "THIRD-PARTY-NOTICES.md";

/** THIRD-PARTY-NOTICES.md: each bundled set's source, version, license and full license text, as each license asks. */
function notices(sets) {
  const fence = "```";
  const sections = sets.map((set) =>
    [
      `## ${set.name} (\`${set.id}\`)`,
      "",
      `- Package: [${set.package}](https://www.npmjs.com/package/${set.package}) ${set.version}`,
      `- Homepage: ${set.homepage}`,
      `- License: ${set.license}`,
      `- ${set.copyright}`,
      "",
      `${fence}text`,
      set.licenseText,
      fence,
      "",
    ].join("\n"),
  );
  const intro =
    "@openpresentation/gallery is MIT (LICENSE). It bundles these icon sets, generated from their npm packages by scripts/build-icon-sets.mjs, which writes this file (do not edit it by hand). Each record in catalog/icon-sets/ also carries its license, copyright and license text.";
  return `# Third-party notices\n\n${intro}\n\n${sections.join("\n")}`;
}

const n = (value) => {
  const rounded = Math.round(Number(value) * 1000) / 1000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
};

/** Path data for one SVG shape element, as a browser draws it (SVG 2 basic shapes). */
export function elementPath(name, attributes) {
  const a = (key) => Number(attributes[key] ?? 0);
  // The first moveto of a path is absolute even when written "m" (its implicit pairs after it stay relative lines); the parts of an icon
  // are joined into one path, where a leading "m" would move relative to the end of the part before, so it is written "M x y l".
  if (name === "path") {
    const d = String(attributes.d ?? "").trim();
    const first = /^m\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[\s,]*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*,?\s*/.exec(d);
    if (!first) return d;
    const rest = d.slice(first[0].length);
    return `M${first[1]} ${first[2]}${/^[+-.\d]/.test(rest) ? "l" : ""}${rest}`;
  }
  if (name === "line") return `M${n(a("x1"))} ${n(a("y1"))}L${n(a("x2"))} ${n(a("y2"))}`;
  if (name === "polyline" || name === "polygon") {
    const values = String(attributes.points ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (values.length < 4) return "";
    const points = [];
    for (let index = 0; index + 1 < values.length; index += 2) points.push(`${n(values[index])} ${n(values[index + 1])}`);
    return `M${points.join("L")}${name === "polygon" ? "Z" : ""}`;
  }
  if (name === "circle" || name === "ellipse") {
    const cx = a("cx"), cy = a("cy"), rx = name === "circle" ? a("r") : a("rx"), ry = name === "circle" ? a("r") : a("ry");
    if (!(rx > 0 && ry > 0)) return "";
    return `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`;
  }
  if (name === "rect") {
    const x = a("x"), y = a("y"), width = a("width"), height = a("height");
    if (!(width > 0 && height > 0)) return "";
    // SVG 2: a missing rx takes ry and the other way round; each is at most half its side.
    let rx = attributes.rx === undefined ? attributes.ry : attributes.rx, ry = attributes.ry === undefined ? attributes.rx : attributes.ry;
    rx = Math.min(Math.max(0, Number(rx ?? 0)), width / 2);
    ry = Math.min(Math.max(0, Number(ry ?? 0)), height / 2);
    if (!rx || !ry) return `M${n(x)} ${n(y)}H${n(x + width)}V${n(y + height)}H${n(x)}Z`;
    const arc = (dx, dy) => `A${n(rx)} ${n(ry)} 0 0 1 ${n(dx)} ${n(dy)}`;
    return `M${n(x + rx)} ${n(y)}H${n(x + width - rx)}${arc(x + width, y + ry)}V${n(y + height - ry)}${arc(x + width - rx, y + height)}H${n(x + rx)}${arc(x, y + height - ry)}V${n(y + ry)}${arc(x + rx, y)}Z`;
  }
  throw new Error(`An icon element <${name}> is not a shape this script converts.`);
}

/** One icon's nodes ([name, attributes] pairs, as the packages' node JSON lists them) as its path data. */
export function iconPaths(nodes) {
  const stroke = [], fill = [];
  for (const [name, attributes] of nodes) {
    const filled = attributes.fill !== undefined && attributes.fill !== "none";
    const stroked = attributes.stroke !== "none";
    if (!filled && !stroked) continue;
    const d = elementPath(name, attributes);
    if (!d) continue;
    if (stroked) stroke.push(d);
    if (filled) fill.push(d);
  }
  if (!fill.length) return stroke.join("");
  return { ...(stroke.length ? { stroke: stroke.join("") } : {}), fill: fill.join("") };
}

const readPackage = async (name) => {
  // The devDependency in this package's node_modules: @tabler/icons's exports map publishes neither a main entry nor package.json.
  const manifest = path.join(packageRoot, "node_modules", ...name.split("/"), "package.json");
  return { root: path.dirname(manifest), pkg: JSON.parse(await readFile(manifest, "utf8")) };
};
const license = async (root) => (await readFile(path.join(root, "LICENSE"), "utf8")).replace(/\r\n/g, "\n").trim();
/** The license's copyright lines, joined: the notice the license asks every copy to keep. */
const copyrightOf = (text) =>
  text
    .split("\n")
    .filter((line) => /^Copyright \(c\)/i.test(line.trim()))
    .map((line) => line.trim())
    .join("; ");
const sortedKeys = (object) => Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]));

async function lucide() {
  const { root, pkg } = await readPackage("lucide-static");
  const nodes = JSON.parse(await readFile(path.join(root, "icon-nodes.json"), "utf8"));
  const tags = JSON.parse(await readFile(path.join(root, "tags.json"), "utf8"));
  const icons = {}, keywords = {};
  for (const name of Object.keys(nodes).sort()) {
    icons[name] = iconPaths(nodes[name]);
    if (Array.isArray(tags[name]) && tags[name].length) keywords[name] = tags[name];
  }
  return {
    $schema: SCHEMA, id: "lucide", name: "Lucide", summary: "Clean, consistent outline icons on a 24 px grid with 2 px strokes; the default set.",
    version: pkg.version, package: pkg.name, homepage: "https://lucide.dev", license: pkg.license,
    copyright: copyrightOf(await license(root)),
    licenseText: await license(root),
    viewBox: [0, 0, 24, 24], style: "stroke", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
    icons, tags: keywords,
  };
}

async function tabler() {
  const { root, pkg } = await readPackage("@tabler/icons");
  const nodes = JSON.parse(await readFile(path.join(root, "tabler-nodes-outline.json"), "utf8"));
  const meta = JSON.parse(await readFile(path.join(root, "icons.json"), "utf8"));
  const icons = {}, keywords = {};
  for (const name of Object.keys(nodes).sort()) {
    icons[name] = iconPaths(nodes[name]);
    const entry = meta[name];
    const words = [...new Set([...(entry?.category ? [String(entry.category).toLowerCase()] : []), ...(Array.isArray(entry?.tags) ? entry.tags.map(String) : [])])];
    if (words.length) keywords[name] = words;
  }
  return {
    $schema: SCHEMA, id: "tabler", name: "Tabler outline", summary: "Tabler's outline icons on a 24 px grid with 2 px strokes.",
    version: pkg.version, package: pkg.name, homepage: "https://tabler.io/icons", license: pkg.license,
    copyright: copyrightOf(await license(root)),
    licenseText: await license(root),
    viewBox: [0, 0, 24, 24], style: "stroke", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
    icons: sortedKeys(icons), tags: sortedKeys(keywords),
  };
}

/** A record as written: one icon (and one tag list) per line, so a version bump diffs icon by icon. */
export function serializeIconSet(record) {
  const { icons, tags, ...head } = record;
  const block = (object) => `{\n${Object.entries(object).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(",\n")}\n  }`;
  const lines = Object.entries(head).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return `{\n${lines.join(",\n")},\n  "icons": ${block(icons)},\n  "tags": ${block(tags)}\n}\n`;
}

export async function buildIconSets() {
  const sets = [await lucide(), await tabler()];
  const files = {};
  for (const set of sets) files[`${set.id}.json`] = serializeIconSet(set);
  files[NOTICES] = notices(sets);
  let previous;
  try { previous = JSON.parse(await readFile(path.join(outRoot, "index.json"), "utf8")); } catch { previous = undefined; }
  const index = {
    $schema: "https://openpresentation.org/schema/opf-catalog-index/v1",
    kind: "icon-sets",
    version: "1",
    description: "The icon sets an OPF `icon` names as `<set>:<name>` (LH-14). Each record holds a set's license, copyright, version, source, its one viewBox and style, and every icon as SVG path data with its search tags; written by scripts/build-icon-sets.mjs from the pinned npm packages, never by hand. A host registers the sets as `galleryIconSets` (`@openpresentation/gallery/icon-sets`) and loads a set only when a deck uses it.",
    // `npm run rehash` writes the hash.
    contentSha256: previous?.contentSha256 ?? "0".repeat(64),
    records: sets.map((set) => ({ id: set.id, name: set.name, summary: set.summary, license: set.license, version: set.version, icons: Object.keys(set.icons).length, file: `${set.id}.json` })),
  };
  files["index.json"] = `${JSON.stringify(index, null, 2)}\n`;
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const files = await buildIconSets();
  const stale = [];
  for (const [name, text] of Object.entries(files)) {
    const target = name === NOTICES ? path.join(packageRoot, NOTICES) : path.join(outRoot, name);
    let current;
    try { current = await readFile(target, "utf8"); } catch { current = undefined; }
    // The index's hash is the rehash's to write: compare it without the hash.
    const comparable = (value) => name === "index.json" && value ? value.replace(/"contentSha256": "[0-9a-f]{64}"/, "") : value;
    if (comparable(current) === comparable(text)) continue;
    stale.push(name);
    if (!check) await writeFile(target, name === "index.json" && current ? text.replace(/"contentSha256": "[0-9a-f]{64}"/, /"contentSha256": "[0-9a-f]{64}"/.exec(current)?.[0] ?? '"contentSha256": ""') : text);
  }
  if (check && stale.length) {
    process.stderr.write(`Icon sets are stale (${stale.join(", ")}): run node scripts/build-icon-sets.mjs and npm run rehash.\n`);
    process.exit(1);
  }
  process.stdout.write(check ? "Icon sets match the pinned packages.\n" : `Icon sets written: ${stale.length ? stale.join(", ") : "no change"}.\n`);
}
