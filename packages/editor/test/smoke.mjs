import assert from "node:assert/strict";
import {
  OPFEditorError,
  applyJsonPatch,
  createEditorSession,
  createSvgTraceBinding,
  getCatalogOptions,
  getValueAtPath,
  invertJsonPatch,
  jsonPointerToOpfPath,
  opfPathToJsonPointer
} from "../dist/index.js";

const presentation = {
  name: "Editor smoke",
  design: {
    theme: "minimal"
  },
  slides: [
    {
      title: "Original title",
      text: "Original body"
    }
  ]
};

const editor = createEditorSession(presentation, { rejectInvalid: true });
assert.equal(editor.validation.valid, true);
assert.equal(opfPathToJsonPointer("slides.0.title"), "/slides/0/title");
assert.equal(jsonPointerToOpfPath("/slides/0/title"), "slides.0.title");

const titleChange = editor.set("slides.0.title", "Edited title");
assert.deepEqual(titleChange.patches, [
  { op: "replace", path: "/slides/0/title", value: "Edited title" }
]);
assert.deepEqual(titleChange.inversePatches, [
  { op: "replace", path: "/slides/0/title", value: "Original title" }
]);
assert.equal(editor.validation.valid, true);

const inverse = invertJsonPatch(presentation, titleChange.patches);
assert.deepEqual(applyJsonPatch(editor.document, inverse), presentation);
const appendPatch = [{ op: "add", path: "/slides/-", value: { title: "Appendix" } }];
const appendInverse = invertJsonPatch(presentation, appendPatch);
assert.deepEqual(appendInverse, [{ op: "remove", path: "/slides/1" }]);
assert.deepEqual(applyJsonPatch(applyJsonPatch(presentation, appendPatch), appendInverse), presentation);
const objectAddPatch = [{ op: "add", path: "/name", value: "Renamed by add" }];
const objectAddInverse = invertJsonPatch(presentation, objectAddPatch);
assert.deepEqual(objectAddInverse, [{ op: "replace", path: "/name", value: "Editor smoke" }]);
assert.deepEqual(applyJsonPatch(applyJsonPatch(presentation, objectAddPatch), objectAddInverse), presentation);

assert.equal(editor.undo()?.document.slides[0].title, "Original title");
assert.equal(editor.redo()?.document.slides[0].title, "Edited title");

const themeOptions = getCatalogOptions("themes");
assert.ok(themeOptions.some((option) => option.id === "classic"));
const themeChange = editor.setCatalog("design.theme", "themes", "classic");
assert.deepEqual(themeChange.patches, [
  { op: "replace", path: "/design/theme", value: "classic" }
]);
assert.equal(editor.get("design.theme"), "classic");
assert.throws(
  () => editor.setCatalog("design.theme", "themes", "made-up-theme"),
  (error) => error instanceof OPFEditorError && error.code === "unknown-catalog-id"
);

const element = fakeElement({ "data-opf-path": "slides.0.text" });
const root = {
  querySelectorAll(selector) {
    assert.equal(selector, "[data-opf-path]");
    return [element];
  }
};

let selectedPath = null;
const binding = createSvgTraceBinding(root, editor, {
  onSelect(selection) {
    selectedPath = selection.path;
  }
});

assert.equal(binding.elements.length, 1);
assert.equal(element.getAttribute("data-opf-bound"), "true");
assert.equal(element.getAttribute("role"), "button");
assert.equal(element.getAttribute("tabindex"), "0");
assert.equal(binding.select(element).value, "Original body");
assert.equal(selectedPath, "slides.0.text");

const boundChange = binding.commit(element, "Edited from trace");
assert.deepEqual(boundChange.patches, [
  { op: "replace", path: "/slides/0/text", value: "Edited from trace" }
]);
assert.equal(getValueAtPath(editor.document, "slides.0.text"), "Edited from trace");

binding.destroy();
assert.equal(element.getAttribute("data-opf-bound"), undefined);

console.log("opf-editor smoke passed");

function fakeElement(attributes = {}) {
  const handlers = new Map();
  return {
    attributes: { ...attributes },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    addEventListener(type, listener) {
      handlers.set(type, listener);
    },
    removeEventListener(type) {
      handlers.delete(type);
    }
  };
}
