// OpenPresentation/opf#898: the layout pickers (JSON field menu, completions, slide manager) group a layout by its catalog
// record's group (the Gallery's index group), never by a list of ids in the editor, so a layout the Gallery adds is grouped at once.
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { catalogIndexes, gallery } from "@openpresentation/gallery";
import { getJsonFieldContext } from "../dist/json-options.js";
import { completionResult } from "../dist/source-completions.js";
import { listSwitchOptions } from "../dist/switches.js";
import { CUSTOM_LAYOUTS_GROUP, groupLayoutChoices, layoutGroupName } from "../dist/layout-templates.js";

const index = catalogIndexes.layouts.records;
const groupOf = new Map(index.map((entry) => [entry.id, entry.group]));
const indexGroups = [...new Set(index.map((entry) => entry.group))];
assert.ok(index.length >= 30 && groupOf.get("agenda-split") === "Openers and closers" && groupOf.get("three-column") === "Text", "the layouts of #898 are in the index");

// Slide manager picker: every Gallery layout lands in its index group, the groups follow the index order, none is Custom.
const choices = listSwitchOptions({ slides: [] }, "layouts", { catalogs: [gallery] });
assert.deepEqual(choices.map((choice) => choice.id), index.map((entry) => entry.id), "the picker lists the index's layouts in its order");
const groups = groupLayoutChoices(choices);
assert.deepEqual(groups.map((group) => group.name), indexGroups, "groups in index order, with no Custom layouts group");
for (const group of groups) for (const choice of group.choices) assert.equal(groupOf.get(choice.id), group.name, `${choice.id} is grouped under ${groupOf.get(choice.id)}`);
assert.equal(groups.flatMap((group) => group.choices).length, index.length);
assert.ok(!groups.some((group) => group.name === CUSTOM_LAYOUTS_GROUP));

// JSON field menu: each option's layoutGroup is its index group (the current layout is listed as "Current layout").
const menuGroups = (current) => {
  const source = JSON.stringify({ slides: [{ layout: current, title: "A" }] }, null, 2);
  return getJsonFieldContext(source, source.indexOf(`"${current}"`) + 1, [gallery]).options;
};
const seen = new Set();
for (const current of ["cover", "text"]) {
  for (const option of menuGroups(current)) {
    if (option.value === current) { assert.equal(option.layoutGroup, "Current layout"); continue; }
    seen.add(option.value);
    assert.equal(option.layoutGroup, groupOf.get(option.value), `${option.value} in the JSON menu`);
  }
}
assert.deepEqual([...seen].sort(), [...groupOf.keys()].sort());
const order = menuGroups("cover").map((option) => option.layoutGroup);
assert.deepEqual([...new Set(order)], ["Current layout", ...indexGroups], "menu groups follow the index order and none is Custom");

// Completions: the layout values are ordered by index group, then by the index's own order within a group.
const text = '{"slides":[{"layout":"|"}]}';
const at = text.indexOf("|");
const completed = completionResult(EditorState.create({ doc: text.replace("|", "") }), at, { explicit: true, catalogs: [gallery], format: "json" });
const labels = completed.options.filter((option) => groupOf.has(option.label)).map((option) => option.label);
const rank = (id) => indexGroups.indexOf(groupOf.get(id)) * 1000 + index.findIndex((entry) => entry.id === id);
assert.deepEqual(labels, [...labels].sort((a, b) => rank(a) - rank(b)), "completions in index order");
assert.equal(labels.length, index.length);

// A layout the editor has never heard of is grouped by its record; custom stays custom.
const added = { ...gallery, layouts: { ...gallery.layouts, "brand-new": { ...gallery.layouts.text, name: "Brand new", tags: ["Fresh group"] }, untagged: { ...gallery.layouts.text, name: "Untagged", tags: undefined } } };
delete added.layouts.untagged.tags;
const extra = groupLayoutChoices(listSwitchOptions({ slides: [], catalogs: { custom: { layouts: { mine: { name: "Mine", regions: [{ name: "title" }] } } } } }, "layouts", { catalogs: [added] }));
assert.deepEqual(extra.map((group) => group.name), [...indexGroups, "Fresh group", CUSTOM_LAYOUTS_GROUP]);
assert.deepEqual(extra.at(-1).choices.map((choice) => choice.id).sort(), ["mine", "untagged"], "a record with no group and the deck's own layout are custom");
assert.equal(layoutGroupName({ id: "x", label: "x" }), CUSTOM_LAYOUTS_GROUP);
assert.equal(layoutGroupName({ id: "x", label: "x", record: { tags: [""] } }), CUSTOM_LAYOUTS_GROUP);

console.log("Layout pickers group every Gallery layout by its Gallery group; no default layout is Custom.");
