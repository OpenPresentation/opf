import {
  createSvgTraceBinding,
  getCatalogOptions,
  setCatalogId
} from "./index.js";

export function opfTextInput(node, params) {
  let cleanup = () => {};

  function connect(nextParams) {
    cleanup();
    const { editor, path, label } = nextParams;
    node.setAttribute?.("data-opf-component", "text-input");
    node.setAttribute?.("data-opf-path", path);
    if (label) node.setAttribute?.("aria-label", label);

    const sync = () => {
      const value = editor.get(path, "");
      node.value = value === undefined || value === null ? "" : String(value);
    };
    const onInput = () => editor.set(path, node.value, { source: "svelte-text-input" });
    const unsubscribe = editor.subscribe(sync);

    node.addEventListener?.("input", onInput);
    sync();
    cleanup = () => {
      node.removeEventListener?.("input", onInput);
      unsubscribe();
    };
  }

  connect(params);

  return {
    update: connect,
    destroy() {
      cleanup();
    }
  };
}

export function opfCatalogSelect(node, params) {
  let cleanup = () => {};

  function connect(nextParams) {
    cleanup();
    const { editor, path, catalogKind, label } = nextParams;
    node.setAttribute?.("data-opf-component", "catalog-select");
    node.setAttribute?.("data-opf-path", path);
    node.setAttribute?.("data-opf-catalog-kind", catalogKind);
    if (label) node.setAttribute?.("aria-label", label);
    replaceOptions(node, getCatalogOptions(catalogKind, {
      catalogs: nextParams.catalogs,
      catalogSources: nextParams.catalogSources,
      presentation: nextParams.presentation ?? editor.document
    }));

    const sync = () => {
      const value = editor.get(path);
      node.value = value && typeof value === "object" ? value.id : value ?? "";
    };
    const onChange = () => setCatalogId(editor, path, catalogKind, node.value, {
      catalogs: nextParams.catalogs,
      catalogSources: nextParams.catalogSources,
      presentation: nextParams.presentation,
      source: "svelte-catalog-select"
    });
    const unsubscribe = editor.subscribe(sync);

    node.addEventListener?.("change", onChange);
    sync();
    cleanup = () => {
      node.removeEventListener?.("change", onChange);
      unsubscribe();
    };
  }

  connect(params);

  return {
    update: connect,
    destroy() {
      cleanup();
    }
  };
}

export function opfTrace(node, params) {
  let binding = createSvgTraceBinding(node, params.editor, params);

  return {
    update(nextParams) {
      binding.destroy();
      binding = createSvgTraceBinding(node, nextParams.editor, nextParams);
    },
    destroy() {
      binding.destroy();
    }
  };
}

function replaceOptions(node, options) {
  while (node.firstChild) node.removeChild(node.firstChild);

  const documentRef = node.ownerDocument ?? globalThis.document;
  for (const option of options) {
    const optionElement = documentRef.createElement("option");
    optionElement.value = option.id;
    optionElement.textContent = option.label;
    node.appendChild(optionElement);
  }
}
