// Maintenance command (shapes SH-01): rebuild spec/reference/preset-geometry.json, the definitions of the 187 DrawingML
// preset shapes (ECMA-376 Part 1, ST_ShapeType), from the standard's presetShapeDefinitions.xml.
//
//   node scripts/build-preset-geometry.mjs --source <presetShapeDefinitions.xml>
//
// The source is downloaded, never committed. This checkout's table was built from Apache POI's copy (Apache-2.0):
//   https://raw.githubusercontent.com/apache/poi/REL_5_5_1/poi/src/main/resources/org/apache/poi/sl/draw/geom/presetShapeDefinitions.xml
//   (tag REL_5_5_1, commit 6048bedcdf1de60871b4a2fb7cf7cd242752e6c9, sha256 below)
// POI redistributes the file of the ECMA-376 Part 1 electronic attachment (DrawingML geometries) under the Apache License 2.0;
// ECMA-376 itself is available to all interested parties without restriction (Ecma bylaws 9.4). License record:
// docs/shapes.md#preset-geometry-source-and-license.
//
// The output keeps DrawingML's own names and values: guide formulas as written, values in the standard's units
// (1/100000 for adjust fractions, 60000ths of a degree for angles, shape coordinates for positions). The core evaluator
// (packages/javascript/src/shape-geometry.ts) reads it; nothing is converted here.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourcePath = option("--source");
if (!sourcePath) {
  console.error("--source <presetShapeDefinitions.xml> is required");
  process.exit(2);
}
const target = fileURLToPath(new URL("../spec/reference/preset-geometry.json", import.meta.url));

const SOURCE = {
  name: "presetShapeDefinitions.xml (ECMA-376 Part 1 electronic attachment, DrawingML preset geometries)",
  distribution: "Apache POI 5.5.1",
  url: "https://raw.githubusercontent.com/apache/poi/REL_5_5_1/poi/src/main/resources/org/apache/poi/sl/draw/geom/presetShapeDefinitions.xml",
  commit: "6048bedcdf1de60871b4a2fb7cf7cd242752e6c9",
  license: "Apache-2.0",
  licenseUrl: "https://raw.githubusercontent.com/apache/poi/REL_5_5_1/legal/LICENSE",
  notice: "Apache POI. Copyright 2003-2025 The Apache Software Foundation. This product includes software developed at The Apache Software Foundation (https://www.apache.org/).",
  standard:
    "ECMA-376 Part 1 (Office Open XML), DrawingML preset shape definitions. As defined in section 9.4 of the Ecma bylaws, the specification is available to all interested parties without restriction.",
};

const bytes = await readFile(sourcePath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const xml = bytes.toString("utf8");

// A minimal parser for this regular, comment-free file: elements and attributes only.
function parse(text) {
  const root = { name: "#root", attrs: {}, children: [] };
  const stack = [root];
  const tag = /<(\/?)([A-Za-z0-9_:]+)((?:\s+[A-Za-z_:][\w:.-]*\s*=\s*"[^"]*")*)\s*(\/?)>|<\?[^>]*\?>|<!--[\s\S]*?-->/g;
  for (const match of text.matchAll(tag)) {
    if (!match[2]) continue;
    const [, closing, name, rawAttrs, selfClosing] = match;
    if (closing) {
      const open = stack.pop();
      if (open.name !== name) throw new Error(`mismatched </${name}> for <${open.name}>`);
      continue;
    }
    const attrs = {};
    for (const [, key, value] of rawAttrs.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g)) if (key !== "xmlns") attrs[key] = value;
    const node = { name, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (stack.length !== 1) throw new Error("unclosed elements");
  return root;
}

const child = (node, name) => node.children.find((entry) => entry.name === name);
const point = (node) => {
  const pt = child(node, "pt") ?? child(node, "pos");
  return [pt.attrs.x, pt.attrs.y];
};

function shapeOf(node) {
  const shape = {};
  const guides = (list) => (list ? list.children.map((gd) => [gd.attrs.name, gd.attrs.fmla]) : []);
  const avLst = guides(child(node, "avLst"));
  const gdLst = guides(child(node, "gdLst"));
  if (avLst.length) shape.avLst = avLst;
  if (gdLst.length) shape.gdLst = gdLst;
  const ahLst = child(node, "ahLst");
  if (ahLst?.children.length) {
    shape.ahLst = ahLst.children.map((handle) => {
      const entry = { type: handle.name === "ahPolar" ? "polar" : "xy", ...handle.attrs };
      entry.pos = point(handle);
      return entry;
    });
  }
  const cxnLst = child(node, "cxnLst");
  if (cxnLst?.children.length) shape.cxnLst = cxnLst.children.map((cxn) => [cxn.attrs.ang, ...point(cxn)]);
  const rect = child(node, "rect");
  if (rect) shape.rect = [rect.attrs.l, rect.attrs.t, rect.attrs.r, rect.attrs.b];
  shape.pathLst = child(node, "pathLst").children.map((path) => {
    const out = {};
    if (path.attrs.w !== undefined) out.w = Number(path.attrs.w);
    if (path.attrs.h !== undefined) out.h = Number(path.attrs.h);
    if (path.attrs.fill !== undefined) out.fill = path.attrs.fill;
    if (path.attrs.stroke !== undefined) out.stroke = path.attrs.stroke === "true" || path.attrs.stroke === "1";
    if (path.attrs.extrusionOk !== undefined) out.extrusionOk = path.attrs.extrusionOk === "true" || path.attrs.extrusionOk === "1";
    out.commands = path.children.map((command) => {
      switch (command.name) {
        case "moveTo":
        case "lnTo":
          return [command.name, ...point(command)];
        case "arcTo":
          return ["arcTo", command.attrs.wR, command.attrs.hR, command.attrs.stAng, command.attrs.swAng];
        case "quadBezTo":
        case "cubicBezTo":
          return [command.name, ...command.children.flatMap((pt) => [pt.attrs.x, pt.attrs.y])];
        case "close":
          return ["close"];
        default:
          throw new Error(`unknown path command ${command.name}`);
      }
    });
    return out;
  });
  return shape;
}

const document = parse(xml);
const definitions = document.children[0];
const shapes = {};
for (const node of definitions.children) shapes[node.name] = shapeOf(node);
const names = Object.keys(shapes);
if (names.length !== 187) throw new Error(`expected the 187 ST_ShapeType presets, found ${names.length}`);

// Two known errata of the standard's file, corrected to what PowerPoint draws and does (each checked in PowerPoint 365,
// shapes SH-01). Every other value is the file's own.
const ERRATA = [
  {
    shape: "pie",
    field: "rect",
    from: ["il", "ir", "it", "ib"],
    to: ["il", "it", "ir", "ib"],
    note: "The file swaps t and r (l=il t=ir r=it b=ib), a rectangle of negative size; PowerPoint lays out pie text in the ellipse's text rectangle (il, it, ir, ib).",
  },
  {
    shape: "curvedLeftArrow",
    field: "cxnLst",
    index: 2,
    from: ["cd3", "l", "y6"],
    to: ["cd2", "l", "y6"],
    note: "The arrow tip's site names the undefined guide cd3; it faces left (cd2), mirroring curvedRightArrow's tip (0, r, y6).",
  },
];
for (const erratum of ERRATA) {
  const shape = shapes[erratum.shape];
  const current = erratum.index === undefined ? shape[erratum.field] : shape[erratum.field][erratum.index];
  if (JSON.stringify(current) !== JSON.stringify(erratum.from)) throw new Error(`erratum ${erratum.shape}.${erratum.field} no longer applies: ${JSON.stringify(current)}`);
  if (erratum.index === undefined) shape[erratum.field] = erratum.to;
  else shape[erratum.field][erratum.index] = erratum.to;
}

const table = {
  $schema: "./preset-geometry.schema.json",
  description:
    "The 187 DrawingML preset shapes (ECMA-376 Part 1, ST_ShapeType) as reference data for engines (shapes SH-01): per preset, avLst (adjust values and their defaults), gdLst (guides and their formulas), ahLst (adjust handles with their ranges), cxnLst (connection sites), rect (the text rectangle; absent means the whole shape) and pathLst (paths with w/h, fill, stroke and extrusionOk, and the commands moveTo, lnTo, arcTo, quadBezTo, cubicBezTo and close). Values are the standard's own: guide names or integer literals, 1/100000 for adjust fractions and 60000ths of a degree for angles. Generated by scripts/build-preset-geometry.mjs; never edit by hand. The evaluator is packages/javascript/src/shape-geometry.ts.",
  version: 1,
  source: { ...SOURCE, sha256 },
  errata: ERRATA,
  shapes,
};

// One preset per block and one list entry per line, so a change to the source reads as a small diff.
function format(value) {
  const lines = ["{"];
  const top = Object.entries(value);
  top.forEach(([key, entry], index) => {
    const comma = index < top.length - 1 ? "," : "";
    if (key !== "shapes") {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(entry)}${comma}`);
      return;
    }
    lines.push('  "shapes": {');
    const list = Object.entries(entry);
    list.forEach(([name, shape], shapeIndex) => {
      lines.push(`    ${JSON.stringify(name)}: {`);
      const fields = Object.entries(shape);
      fields.forEach(([field, items], fieldIndex) => {
        const fieldComma = fieldIndex < fields.length - 1 ? "," : "";
        if (!Array.isArray(items) || field === "rect") {
          lines.push(`      ${JSON.stringify(field)}: ${JSON.stringify(items)}${fieldComma}`);
          return;
        }
        lines.push(`      ${JSON.stringify(field)}: [`);
        items.forEach((item, itemIndex) => {
          const itemComma = itemIndex < items.length - 1 ? "," : "";
          if (field === "pathLst") {
            const { commands, ...attrs } = item;
            const head = JSON.stringify(attrs).slice(0, -1);
            lines.push(`        ${head}${head.length > 1 ? ", " : ""}"commands": [`);
            commands.forEach((command, commandIndex) => {
              lines.push(`          ${JSON.stringify(command)}${commandIndex < commands.length - 1 ? "," : ""}`);
            });
            lines.push(`        ]}${itemComma}`);
          } else {
            lines.push(`        ${JSON.stringify(item)}${itemComma}`);
          }
        });
        lines.push(`      ]${fieldComma}`);
      });
      lines.push(`    }${shapeIndex < list.length - 1 ? "," : ""}`);
    });
    lines.push(`  }${comma}`);
  });
  lines.push("}", "");
  return lines.join("\n");
}

const text = format(table);
JSON.parse(text);
await writeFile(target, text);
console.log(`wrote ${names.length} presets to spec/reference/preset-geometry.json (${text.length} bytes, source sha256 ${sha256})`);
