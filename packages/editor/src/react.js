import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { commitCatalogControl } from "./catalog-control.js";
import {
  getCatalogOptions,
  getValueAtPath,
  setCatalogId
} from "./index.js";

export function createOPFReactComponents(React) {
  if (!React || typeof React.createElement !== "function") {
    throw new TypeError("createOPFReactComponents requires a React-compatible object.");
  }

  function useEditorSnapshot(editor) {
    if (typeof React.useSyncExternalStore === "function") {
      return React.useSyncExternalStore(
        (notify) => editor.subscribe(notify),
        () => editor.snapshot(),
        () => editor.snapshot()
      );
    }

    const [snapshot, setSnapshot] = React.useState(editor.snapshot());
    React.useEffect(() => editor.subscribe(() => setSnapshot(editor.snapshot())), [editor]);
    return snapshot;
  }

  function OPFTextInput({
    editor,
    path,
    label,
    multiline = false,
    inputProps = {},
    ...props
  }) {
    const snapshot = useEditorSnapshot(editor);
    const value = getValueAtPath(snapshot.presentation, path, "");
    const tag = multiline ? "textarea" : "input";
    return React.createElement(tag, {
      ...props,
      ...inputProps,
      "aria-label": label ?? props["aria-label"] ?? inputProps["aria-label"],
      "data-opf-component": "text-input",
      "data-opf-path": path,
      type: multiline ? undefined : props.type ?? inputProps.type ?? "text",
      value: value === undefined || value === null ? "" : String(value),
      onChange(event) {
        inputProps.onChange?.(event);
        props.onChange?.(event);
        if (!event.defaultPrevented) editor.set(path, event.currentTarget.value, { source: "react-text-input" });
      }
    });
  }

  function OPFCatalogSelect({
    editor,
    path,
    catalogKind,
    label,
    catalogOptions,
    onError,
    selectProps = {},
    ...props
  }) {
    const snapshot = useEditorSnapshot(editor);
    const value = getValueAtPath(snapshot.presentation, path, "");
    const currentId = value && typeof value === "object" ? value.id : value;
    const options = catalogOptions ?? getCatalogOptions(catalogKind, { presentation: snapshot.presentation, catalogs: editor.catalogs });

    return React.createElement(
      "select",
      {
        ...props,
        ...selectProps,
        "aria-label": label ?? props["aria-label"] ?? selectProps["aria-label"],
        "data-opf-component": "catalog-select",
        "data-opf-catalog-kind": catalogKind,
        "data-opf-path": path,
        value: currentId ?? "",
        onChange(event) {
          selectProps.onChange?.(event);
          props.onChange?.(event);
          if (!event.defaultPrevented) {
            const node = event.currentTarget;
            commitCatalogControl(node, onError, () => { node.value = currentId ?? ""; }, () =>
              setCatalogId(editor, path, catalogKind, node.value, { source: "react-catalog-select" }));
          }
        }
      },
      options.map((option) => React.createElement("option", { key: option.id, value: option.id }, option.label))
    );
  }

  return {
    useEditorSnapshot,
    OPFTextInput,
    OPFCatalogSelect
  };
}

// ---- CE-06: the embeddable editor for React 18 and 19 ----------------------------------------------------------------------------------
// `<OpfEditor>` mounts `createOpfEditor` (src/workspace.js) in an effect and destroys it in the cleanup, so it is correct under StrictMode's
// mount, unmount, mount: the editor module is loaded on demand (an import that resolves after both effects), the first effect's request is
// cancelled by its cleanup, and only the second creates an editor. The server renders an empty container; nothing of the editor
// (and none of its code) runs there. React is an optional peer: only this entry point needs it.

const NO_STOP = () => {};
const isRef = (value) => value !== null && typeof value === "object" && "current" in value;

/** `slots` whose values are React refs (`useRef`) resolve to their elements when the editor mounts, after the commit that attached them. */
function resolveSlots(slots) {
  if (!slots) return undefined;
  const resolved = {};
  for (const [name, value] of Object.entries(slots)) resolved[name] = isRef(value) ? value.current : value;
  return resolved;
}

// The props that are not editor options.
const COMPONENT_PROPS = new Set(["className", "style", "id", "onEditor", "children", "slots", "onChange", "onSelection", "onError", "onReady"]);

function splitProps(props) {
  const options = {};
  const rest = {};
  for (const [name, value] of Object.entries(props)) (COMPONENT_PROPS.has(name) ? rest : options)[name] = value;
  return { options, rest };
}

/**
 * Create and destroy one editor in the element `container.current` points at. The options are read once, when the editor mounts (change the
 * `key` of the component to mount another); `theme`, `readOnly`, `view`, `density` and `exportMode` follow later renders. The callbacks
 * (`onChange`, `onSelection`, `onError`, `onReady`) always call the latest function passed. Returns the editor once it is mounted, else `null`.
 */
function useMountedEditor(container, props, onEditor) {
  const [editor, setEditor] = useState(null);
  const latest = useRef(props);
  latest.current = props;
  const report = useRef(onEditor);
  report.current = onEditor;
  useEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    let cancelled = false;
    let created = null;
    import("./workspace.js").then(({ createOpfEditor }) => {
      if (cancelled) return;
      const { options } = splitProps(latest.current);
      const current = () => latest.current;
      created = createOpfEditor(element, {
        ...options,
        slots: resolveSlots(latest.current.slots),
        onChange: (detail) => current().onChange?.(detail),
        onSelection: (detail) => current().onSelection?.(detail),
        onError: (error, detail) => current().onError?.(error, detail),
        onReady: (detail) => current().onReady?.(detail),
      });
      setEditor(created);
      report.current?.(created);
    }, (error) => {
      if (!cancelled) latest.current.onError?.(error instanceof Error ? error : new Error(String(error)), {});
    });
    return () => {
      cancelled = true;
      if (!created) return;
      created.destroy();
      created = null;
      setEditor(null);
      report.current?.(null);
    };
    // The editor mounts once per element: later options are applied by the effects below, or by a new `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container]);
  const { theme, readOnly, view, density, exportMode } = props;
  // A theme written inline in JSX is a new object on every render; it is applied again only when its content changed.
  const themeKey = theme === undefined ? undefined : JSON.stringify(theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (editor && theme !== undefined) editor.setTheme(theme); }, [editor, themeKey]);
  useEffect(() => { if (editor && readOnly !== undefined) editor.setReadOnly(readOnly); }, [editor, readOnly]);
  useEffect(() => { if (editor && view !== undefined && editor.view !== view) editor.setView(view); }, [editor, view]);
  useEffect(() => { if (editor && density !== undefined) editor.setDensity(density); }, [editor, density]);
  useEffect(() => { if (editor && exportMode !== undefined) editor.setExportMode(exportMode); }, [editor, exportMode]);
  return editor;
}

/**
 * The editor in a `<div>`. Every prop that is not `className`, `style`, `id`, `slots` or a callback is an option of `createOpfEditor`;
 * `ref` is the editor handle once mounted, and `onEditor(editor | null)` tells the parent when it is created and destroyed (for the hooks below).
 */
export const OpfEditor = forwardRef(function OpfEditor(props, ref) {
  const container = useRef(null);
  const editor = useMountedEditor(container, props, props.onEditor);
  useImperativeHandle(ref, () => editor, [editor]);
  const { rest } = splitProps(props);
  return createElement("div", { ref: container, id: rest.id, className: rest.className, style: rest.style, "data-opf-react": "" });
});

/**
 * The editor as a hook, for a host that renders its own element: `const { ref, editor } = useOpfEditor(options)` and `<div ref={ref} />`.
 * `editor` is `null` on the server and until the client has mounted it. Options are read once, as for `<OpfEditor>`.
 */
export function useOpfEditor(options = {}) {
  const ref = useRef(null);
  const editor = useMountedEditor(ref, options);
  return { ref, editor };
}

const subscribeTo = (editor, event) => (notify) => (editor ? editor.on(event, notify) : NO_STOP);

/** The document of an editor, replaced on every change (it is frozen, so it works as a store snapshot). `undefined` until there is an editor. */
export function useOpfDocument(editor) {
  const subscribe = useCallback(subscribeTo(editor, "change"), [editor]);
  return useSyncExternalStore(subscribe, () => (editor ? editor.getDocument() : undefined), () => undefined);
}

/** The content last selected on the canvas, `{ path, value }`, or `null`. */
export function useOpfSelection(editor) {
  const subscribe = useCallback(subscribeTo(editor, "selection"), [editor]);
  return useSyncExternalStore(subscribe, () => (editor ? editor.selection : null), () => null);
}
