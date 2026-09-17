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
    const value = getValueAtPath(snapshot.document, path, "");
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
    selectProps = {},
    ...props
  }) {
    const snapshot = useEditorSnapshot(editor);
    const value = getValueAtPath(snapshot.document, path, "");
    const currentId = value && typeof value === "object" ? value.id : value;
    const options = catalogOptions ?? getCatalogOptions(catalogKind, { presentation: snapshot.document });

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
            setCatalogId(editor, path, catalogKind, event.currentTarget.value, { source: "react-catalog-select" });
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
