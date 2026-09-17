# Editor and transfer APIs

These entrypoints require compatible builds. Check the installed package exports; current local prereleases may precede a public release.

## Atomic patching

```js
import { createEditorSession } from '@openpresentation/opf-editor';
const editor = createEditorSession(document, {rejectInvalid: true});
const index = editor.document.slides.findIndex(slide => slide.id === targetId);
if (index < 0) throw new Error('Slide ID not found');
editor.applyPatch([
  {op: 'test', path: `/slides/${index}/id`, value: targetId},
  {op: 'replace', path: `/slides/${index}/title`, value: newTitle},
], {source: 'agent', rejectInvalid: true});
// Read editor.document for saving; editor.undo() reverses this transaction.
```

The patch assumes `title` already exists; use `add` or `createValuePatch` for optional fields. A stable-ID `test` detects a moved/replaced target, not every concurrent content change; add an expected-value test or host revision check as needed. Never build pointer paths by joining unescaped user keys.

## Canvas and optional properties

```js
import { createCanvasEditor } from '@openpresentation/opf-editor/canvas';
import { createSchemaInspector } from '@openpresentation/opf-editor/schema-inspector';
const canvas = createCanvasEditor(slideContainer, {editor, slideIndex: 0, renderOptions});
await canvas.ready;
const inspector = createSchemaInspector(propertyContainer, {
  editor,
  path: '/slides/0',
  onDraft: ({document: draft}) => previewDraft(draft),
});
// inspector.commit() validates and applies one undoable change.
// On unmount: inspector.destroy(); canvas.destroy();
```

Containers, render options, and `previewDraft` belong to the host. Mount after DOM creation. A schema-inspector draft is deliberately staged; avoid creating a second authoritative document. When the session changes concurrently, stale drafts must be discarded/rebased. Nonvisual metadata is edited as properties, not drawn as slide text.

## Copy and import

```js
import { parseOpfTransfer, serializeOpfTransfer, prepareOpfImport } from '@openpresentation/opf-editor/transfer';
const copied = serializeOpfTransfer(editor.document, {scope: 'slide', slideIndex: 0, format: 'markdown'});
const parsed = parseOpfTransfer(copied);
const proposed = prepareOpfImport(editor.document, parsed, {mode: 'insert', slideIndex: 0});
// Preview proposed.document, then apply the intended import as one transaction.
editor.applyPatch([{op: 'replace', path: '', value: proposed.document}], {source: 'import', rejectInvalid: true});
```

Copy scopes are presentation, slide, and selection; formats are pretty, compact, and markdown. Selection needs `path`. Import modes are insert, replace, and selection; selection also needs `path`.

Slide copies retain design/catalog/asset context. Insertion namespaces inline catalog IDs and conflicting slide/asset IDs while preserving primary source design defaults. It does not merge root speaker/organization/narrative metadata. Use replace to retain the complete imported document. Conflicting external catalog sources require resolution or a separate presentation. Recompute the proposed import against the latest document before applying if the host can change during review.


## Rich text ranges

Use `formatRichTextRange`, `replaceRichTextRange`, and `richTextContent` from `@openpresentation/opf-editor/rich-text` for immutable edits inside rich `text` payloads. Offsets use UTF-16 with whole-grapheme boundaries. Preserve the original array and select only the requested range; avoid flattening runs to plain text. Apply the returned runs with one validated `editor.set` or CLI JSON Patch, and use an expected-value guard for concurrent work. A `null` format value removes that override; `false` explicitly turns a boolean style off. Replacement inherits the first selected run’s style, or the preceding run for an insertion at a boundary.

The canvas toolbar selects and formats the actual SVG glyphs. `beginEdit(path)` selects all text for a rich payload; `editProperties(path)` explicitly opens run fields. Continuous rich-text typing/caret support is still separate work.


## Moving complete blocks

Use `prepareBlockMove(document, fromPath, toContainerPath, toIndex)` from `@openpresentation/opf-editor/layout`. Choose complete block paths, not their text/data subfields. `toIndex` is an insertion position before removal. The helper accounts for shifted group addresses, preserves nested content and metadata, validates the full result, and returns guarded remove/add patches with the new `path`. No-op moves return no patches. Apply the prepared patches atomically; do not discard their test guards. Parent weights remain attached to positions. Empty source containers and moves into a group's own descendants are rejected. Render the candidate before applying to catch strict overflow or unavailable fonts. `listBlockContainers` discovers eligible existing groups/slides without traversing arbitrary extension data.

For list formatting, edit the exact entry or description path, such as `slides.0.items.1.text` or `slides.0.items.1.description`. Strings edit inline; rich arrays support range formatting. The parent `items` or `bullets` array is structural content, not a text-run array. Preserve each item's level and description when moving or replacing entries.

## Creating and removing content

Use `prepareBlockInsert(document, containerPath, block, index?)`, `prepareBlockDuplicate(document, blockPath)` and `prepareBlockRemove(document, blockPath)` from the editor's `/layout` export. `createContentBlock(kind, {source?})` supplies small starting points; image/video kinds need a source. `listBlockContainers(document, {includeImplicit:true})` also discovers implicit slides and named-region leaves that can become groups. Insertion preserves existing root metadata while normalizing payload fields to blocks. Deletion prunes empty ancestor groups, never the slide; weights stay positional. All helpers return guarded patches and a validated candidate. Render that candidate before applying, then commit one transaction. The browser exposes the same operations through Add content and Arrange handles. Video-source insertion does not establish playback or export fidelity.
