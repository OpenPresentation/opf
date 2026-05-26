import assert from "node:assert/strict";
import {
  createCatalogSelect,
  createEditorSession,
  createTextInput
} from "../dist/index.js";
import { createOPFReactComponents } from "../dist/react.js";
import { opfCatalogSelect, opfTextInput } from "../dist/svelte.js";

const documentRef = fakeDocument();
const editor = createEditorSession({
  name: "Component smoke",
  design: {
    theme: "minimal"
  },
  slides: [
    {
      title: "Original title"
    }
  ]
});

const titleInput = createTextInput(editor, {
  document: documentRef,
  path: "slides.0.title",
  label: "Slide title"
});

assert.equal(titleInput.tagName, "input");
assert.equal(titleInput.getAttribute("data-opf-component"), "text-input");
assert.equal(titleInput.getAttribute("data-opf-path"), "slides.0.title");
assert.equal(titleInput.value, "Original title");

titleInput.value = "DOM title";
titleInput.dispatch("input");
assert.equal(editor.get("slides.0.title"), "DOM title");

editor.set("slides.0.title", "Subscribed title");
assert.equal(titleInput.value, "Subscribed title");

const themeSelect = createCatalogSelect(editor, {
  document: documentRef,
  path: "design.theme",
  catalogKind: "themes",
  label: "Deck theme"
});

assert.equal(themeSelect.tagName, "select");
assert.equal(themeSelect.getAttribute("data-opf-component"), "catalog-select");
assert.equal(themeSelect.getAttribute("data-opf-catalog-kind"), "themes");
assert.ok(themeSelect.children.some((option) => option.value === "classic"));

themeSelect.value = "classic";
themeSelect.dispatch("change");
assert.equal(editor.get("design.theme"), "classic");

const React = {
  createElement(tag, props, ...children) {
    return { tag, props, children };
  },
  useSyncExternalStore(_subscribe, getSnapshot) {
    return getSnapshot();
  }
};
const { OPFTextInput, OPFCatalogSelect } = createOPFReactComponents(React);
const reactInput = OPFTextInput({ editor, path: "slides.0.title", label: "Slide title" });
const reactSelect = OPFCatalogSelect({ editor, path: "design.theme", catalogKind: "themes", label: "Deck theme" });

assert.equal(reactInput.tag, "input");
assert.equal(reactInput.props["data-opf-component"], "text-input");
assert.equal(reactInput.props["data-opf-path"], "slides.0.title");
assert.equal(reactSelect.tag, "select");
assert.equal(reactSelect.props["data-opf-component"], "catalog-select");
assert.equal(reactSelect.props["data-opf-catalog-kind"], "themes");

const svelteInput = fakeElement("input", documentRef);
const svelteInputAction = opfTextInput(svelteInput, {
  editor,
  path: "slides.0.title",
  label: "Slide title"
});
assert.equal(svelteInput.getAttribute("data-opf-component"), "text-input");
svelteInput.value = "Svelte title";
svelteInput.dispatch("input");
assert.equal(editor.get("slides.0.title"), "Svelte title");

const svelteSelect = fakeElement("select", documentRef);
const svelteSelectAction = opfCatalogSelect(svelteSelect, {
  editor,
  path: "design.theme",
  catalogKind: "themes",
  label: "Deck theme"
});
assert.ok(svelteSelect.children.some((option) => option.value === "minimal"));
svelteSelect.value = "minimal";
svelteSelect.dispatch("change");
assert.equal(editor.get("design.theme"), "minimal");

titleInput.destroy();
themeSelect.destroy();
svelteInputAction.destroy();
svelteSelectAction.destroy();

console.log("opf-editor component smoke passed");

function fakeDocument() {
  return {
    createElement(tagName) {
      return fakeElement(tagName, this);
    }
  };
}

function fakeElement(tagName, ownerDocument) {
  const handlers = new Map();
  const element = {
    tagName,
    ownerDocument,
    attributes: {},
    children: [],
    value: "",
    textContent: "",
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      return child;
    },
    get firstChild() {
      return this.children[0] ?? null;
    },
    addEventListener(type, listener) {
      handlers.set(type, listener);
    },
    removeEventListener(type) {
      handlers.delete(type);
    },
    dispatch(type) {
      handlers.get(type)?.({ currentTarget: this, defaultPrevented: false });
    }
  };
  return element;
}
