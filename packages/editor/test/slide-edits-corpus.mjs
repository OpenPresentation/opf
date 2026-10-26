import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { gallery } from "@openpresentation/gallery";
import { documentHash } from "@openpresentation/opf/ids";
import { checkFormat } from "../dist/checks.js";
import { createEditorSession } from "../dist/index.js";
import { createSlideAdapter } from "../dist/slide-adapter.js";

// CE-19: every structural edit of the slide adapter over the examples corpus. On every slide each applicable edit (reorder, move into a
// group and out of it, move between layout regions, group and ungroup, duplicate, delete, track resize, copy and paste) either applies
// as one step that validates with core and undoes to the exact original (equal documentHash), or is refused with a reason and changes
// nothing. Nothing throws. Each result is checked with core's validate for the format and reference rules (the session's own check;
// the full report with layout is in slide-adapter.mjs, which is fewer edits).
const examples = new URL("../../../examples/", import.meta.url);
const catalogs = [gallery];
const decks = [
  ...readdirSync(new URL("technical/", examples)).filter((name) => name.endsWith(".opf.json")).map((name) => `technical/${name}`),
  ...["presentation-types", "business-functions"].flatMap((folder) => readdirSync(new URL(`gallery/${folder}/`, examples)).filter((name) => name.endsWith(".opf.json")).slice(0, 2).map((name) => `gallery/${folder}/${name}`)),
];
const applied = {}, refused = {};
for (const name of decks) {
  const session = createEditorSession(JSON.parse(readFileSync(new URL(name, examples), "utf8")), { catalogs, rejectInvalid: true });
  session.assignIds();
  const adapter = createSlideAdapter(session);
  const count = session.presentation.slides.length;
  for (let index = 0; index < count; index += 1) {
    adapter.setSlide(index);
    const attempt = (kind, command, ...args) => {
      const start = documentHash(session.presentation), depth = session.snapshot().undoDepth;
      const result = adapter.apply(command, ...args);
      if (!result.ok) {
        assert.equal(typeof result.reason, "string", `${name} slide ${index} ${kind}: a refusal has a reason`);
        assert.equal(documentHash(session.presentation), start, `${name} slide ${index} ${kind}: a refusal changes nothing`);
        refused[kind] = (refused[kind] ?? 0) + 1;
        return;
      }
      if (!result.changed) return;
      applied[kind] = (applied[kind] ?? 0) + 1;
      assert.equal(session.snapshot().undoDepth, depth + 1, `${name} slide ${index} ${kind}: one step`);
      const report = checkFormat(session.presentation, { catalogs });
      assert.equal(report.valid, true, `${name} slide ${index} ${kind}: ${report.findings.filter((finding) => finding.severity === "error").map((finding) => finding.message).join("; ")}`);
      assert.ok(result.keys.every((key) => adapter.pathOf(key) !== null), `${name} slide ${index} ${kind}: the selected keys exist`);
      adapter.undo();
      assert.equal(documentHash(session.presentation), start, `${name} slide ${index} ${kind}: undo restores the exact original`);
      adapter.setSlide(index);
    };
    const scene = adapter.scene();
    const containers = scene.nodes.filter((node) => ["slide", "group", "region"].includes(node.kind));
    for (const container of containers) {
      const children = scene.contentChildren(container.key).filter((node) => node.kind !== "region");
      if (children.length >= 2) {
        attempt("reorder", "move", [children.at(-1).key], container.key, 0);
        attempt("reorder", "move", [children[0].key, children[1].key], container.key, children.length);
        attempt("group", "group", [children[0].key, children[1].key]);
      }
      if (children.length) {
        attempt("duplicate", "duplicate", [children[0].key]);
        attempt("delete", "delete", [children.at(-1).key]);
        attempt("paste", "paste", adapter.copy([children[0].key]), { target: container.key, index: 0 });
      }
      if (container.kind === "group") {
        attempt("ungroup", "ungroup", container.key);
        const parent = scene.node(container.parent);
        attempt("out of a group", "move", [children[0].key], parent.key, 0);
      }
      const group = children.find((node) => node.kind === "group");
      const leaf = children.find((node) => node.kind !== "group");
      if (group && leaf) attempt("into a group", "move", [leaf.key], group.key, 0);
      if (container.can.resizeTracks) attempt("resize", "resizeTracks", container.key, 0, 0.6);
    }
    const regions = scene.contentChildren(scene.slideKey).filter((node) => node.virtual);
    for (const from of regions) for (const to of regions) {
      const child = scene.contentChildren(from.key)[0];
      if (child && from !== to) attempt("between regions", "move", [child.key], to.key, scene.contentChildren(to.key).length);
    }
    if (index === 0) attempt("slides", "moveSlides", [adapter.slides()[0].key], count);
  }
}
for (const kind of ["reorder", "group", "duplicate", "delete", "paste", "ungroup", "out of a group", "into a group", "resize", "between regions", "slides"])
  assert.ok((applied[kind] ?? 0) > 0, `the corpus exercises ${kind} (applied ${JSON.stringify(applied)}, refused ${JSON.stringify(refused)})`);
console.log(`slide edits over ${decks.length} decks: applied ${JSON.stringify(applied)}; refused ${JSON.stringify(refused)}`);
