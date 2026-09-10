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

const dynamicEditor = createEditorSession({ slides: [{ blocks: [{ text: "A" }, { text: "B" }] }] });
const originalComposition = dynamicEditor.composeSlide(0);
dynamicEditor.setComposition(0, { mode: "column", weights: [2, 1] });
assert.equal(dynamicEditor.composeSlide(0).composition.mode, "column");
dynamicEditor.undo();
assert.deepEqual(dynamicEditor.composeSlide(0), originalComposition);
dynamicEditor.redo();
assert.equal(dynamicEditor.composeSlide(0).composition.mode, "column");
assert.throws(() => dynamicEditor.setComposition(0, { mode: "invalid" }));
assert.throws(() => dynamicEditor.applyPatch([{ op: "replace", path: "/slides/01", value: {} }]));
const specialKey = applyJsonPatch({}, [{ op: "add", path: "/__proto__", value: { safe: true } }]);
assert.equal(Object.hasOwn(specialKey, "__proto__"), true);
assert.equal(Object.getPrototypeOf(specialKey), Object.prototype);

const nestedSession = createEditorSession({ slides: [{ blocks: [{ blocks: [{ text: "One" }, { text: "Two" }] }] }] });
const nestedOriginal = nestedSession.document;
nestedSession.setGroupComposition('slides.0.blocks.0', { mode: 'column' });
assert.equal(nestedSession.composeSlide(0).groups[0].composition.mode, 'column');
nestedSession.undo(); assert.deepEqual(nestedSession.document, nestedOriginal);
nestedSession.redo(); assert.equal(nestedSession.get('slides.0.blocks.0.composition.mode'), 'column');
assert.throws(() => nestedSession.setGroupComposition('slides.0.blocks.0.blocks.0', { mode: 'row' }));
assert.throws(() => nestedSession.setGroupComposition('slides.0', { mode: 'row' }));
assert.throws(() => nestedSession.setGroupComposition('slides.0.blocks.0', { mode: 'invalid' }));

const longText = 'Keep these words on readable slides. '.repeat(150);
const pageEditor = createEditorSession({slides:[{id:'draft',title:'Draft',text:longText},{id:'draft--2',text:'Later slide'}]});
const pageBefore = pageEditor.document;
const pageResult = pageEditor.paginateSlide(0);
assert.ok(pageResult.pagination.slides.length>1);
assert.equal(pageEditor.document.slides.slice(0,-1).map(slide=>slide.text).join(''),longText);
pageEditor.undo(); assert.deepEqual(pageEditor.document,pageBefore);
pageEditor.redo(); assert.equal(pageEditor.document.slides.length,pageResult.pagination.slides.length+1);
pageEditor.undo();
assert.throws(()=>pageEditor.paginateSlide(0,{maxSlides:1}));
assert.deepEqual(pageEditor.document,pageBefore);
assert.ok(pageEditor.paginateSlide(1).change);
assert.equal(pageEditor.document.slides[1].composition.minFontSize,24);
assert.equal(pageEditor.paginateSlide(1).change,null,'An already persisted policy is a no-op');
pageEditor.undo(); assert.deepEqual(pageEditor.document,pageBefore,'One-page policy changes are undoable');
pageEditor.redo(); assert.equal(pageEditor.document.slides[1].composition.minFontSize,24);

const quoteEditor=createEditorSession({design:{fontScheme:'roboto'},slides:[{quote:{text:'Keep the source readable.',attribution:'Reviewer',source:'Recorded interview'}}]});
const quoteBefore=quoteEditor.document;
const quotePage=quoteEditor.paginateSlide(0);
assert.equal(quotePage.pagination.slides.length,1);
assert.ok(quotePage.change);
assert.equal(quoteEditor.composeSlide(0).items[0].quoteLayout.parts[1].fit.fontSize,24);
assert.equal(quoteEditor.paginateSlide(0).change,null);
quoteEditor.undo(); assert.deepEqual(quoteEditor.document,quoteBefore);
quoteEditor.redo(); assert.equal(quoteEditor.composeSlide(0).items[0].quoteLayout.parts[1].fit.fontSize,24);

// Object order is not an editorial change. Test ordinary JSON variants through
// the public operation and retain an existing redo entry across the no-op.
const reverseKeys=value=>Array.isArray(value)?value.map(reverseKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,child])=>[key,reverseKeys(child)])):value;
const orderedSlide={title:'Keep history',composition:{mode:'column',minFontSize:24},blocks:[{composition:{mode:'column',minFontSize:24},blocks:[{quote:{text:'Keep the body.',attribution:'Reviewer',source:'Source'}}]}]};
for(const slide of [orderedSlide,reverseKeys(orderedSlide)]){
  const session=createEditorSession({slides:[slide]});
  session.set('slides.0.title','Redo this title');session.undo();
  const before=JSON.stringify(session.document);
  assert.equal(session.paginateSlide(0).change,null,'Already persisted nested policies are unchanged in either JSON key order');
  assert.equal(JSON.stringify(session.document),before,'No-op pagination must preserve the original document including key order');
  assert.equal(session.redo()?.document.slides[0].title,'Redo this title','No-op pagination must preserve an existing redo entry');
}
