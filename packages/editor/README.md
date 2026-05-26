# OPF Editor

Embeddable local editor primitives for Open Presentation Format documents. The package turns traced `@openpresentation/opf-render` SVG output into JSON-path-aware edits, validates OPF after each change, and records undo/redo as JSON Patch operations.

## Scope

- Package: `@openpresentation/opf-editor`
- Repository: `OpenPresentation/opf-editor`
- License: MIT
- Compatibility target: `@openpresentation/opf`
- Renderer relationship: built on `@openpresentation/opf-render` trace output
- Headless JSON edit bindings for renderer trace attributes
- Structured catalog controls that only commit known catalog IDs
- JSON Patch state transitions with inverse patches for undo/redo
- Optional DOM controls plus React and Svelte bindings in separate embeddable entry points

## Runtime Policy

The package runtime must stay local and deterministic:

- No hosted service in the critical path
- No telemetry or hidden analytics
- No commercial SDK dependency in the critical path
- No required network calls
- Host applications own auth, storage, queues, analytics, collaboration, branding, and product workflow

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run validate
```

## Headless Editing

```js
import {
  createEditorSession,
  createSvgTraceBinding
} from "@openpresentation/opf-editor";
import { renderSvg } from "@openpresentation/opf-render";

const editor = createEditorSession(opfDocument, { rejectInvalid: true });
const svg = renderSvg(editor.document, { trace: true });

preview.innerHTML = svg;
const binding = createSvgTraceBinding(preview.querySelector("svg"), editor, {
  onSelect(selection) {
    inspector.open({
      path: selection.path,
      value: selection.value,
      commit(value) {
        binding.commit(selection.element, value);
      }
    });
  }
});
```

Every change returns JSON Patch operations plus inverse operations:

```js
const change = editor.set("slides.0.title", "Quarterly plan");

change.patches;
// [{ op: "replace", path: "/slides/0/title", value: "Quarterly plan" }]

change.inversePatches;
// [{ op: "replace", path: "/slides/0/title", value: "Old title" }]

editor.undo();
editor.redo();
```

`createSvgTraceBinding` only reads `data-opf-path`; it does not require a hosted service, a second renderer, storage, analytics, auth, or product chrome. Host applications decide how selected paths appear in their own inspector UI.

## Catalog Controls

Catalog helpers commit catalog IDs from the OPF catalog registry instead of accepting freeform incompatible values:

```js
import {
  createCatalogSelect,
  getCatalogOptions
} from "@openpresentation/opf-editor";

getCatalogOptions("themes").map((option) => option.id);

const themeSelect = createCatalogSelect(editor, {
  path: "design.theme",
  catalogKind: "themes",
  label: "Theme"
});

toolbar.append(themeSelect);
```

Invalid IDs throw before they reach the document. Existing object-form references keep their sibling override fields and replace only `id`.

## Optional React Bindings

React bindings are isolated under `@openpresentation/opf-editor/react` and require the host app to pass its React runtime. The core package does not add React to the critical path.

```jsx
import { createOPFReactComponents } from "@openpresentation/opf-editor/react";

const { OPFTextInput, OPFCatalogSelect } = createOPFReactComponents(React);

function Inspector({ editor }) {
  return (
    <>
      <OPFTextInput editor={editor} path="slides.0.title" label="Slide title" />
      <OPFCatalogSelect editor={editor} path="design.theme" catalogKind="themes" label="Theme" />
    </>
  );
}
```

## Optional Svelte Bindings

Svelte bindings are isolated under `@openpresentation/opf-editor/svelte` as actions. They bind host-owned controls, so the package does not ship product chrome or require the Svelte runtime in the core entry point.

```svelte
<script>
  import { opfCatalogSelect, opfTextInput } from "@openpresentation/opf-editor/svelte";

  export let editor;
</script>

<input use:opfTextInput={{ editor, path: "slides.0.title", label: "Slide title" }} />
<select use:opfCatalogSelect={{ editor, path: "design.theme", catalogKind: "themes", label: "Theme" }} />
```

## Release Lane

Public npm package publication is handled by `.github/workflows/release.yml` with npm provenance.

Required first-publish setup:

1. An npm owner for the `@openpresentation` scope must run the first publish or reserve/grant the `@openpresentation/opf-editor` package.
2. Configure npm Trusted Publishing for GitHub repository `OpenPresentation/opf-editor` and workflow `.github/workflows/release.yml`.
3. Publish by creating a GitHub Release or manually running the Release workflow after CI passes.

This repo does not require an npm automation token when Trusted Publishing is configured.
