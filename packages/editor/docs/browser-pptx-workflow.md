# Local browser PowerPoint workflow

The playground now imports `.pptx` through the existing preview/insert/open dialog and exports editable `.pptx` through the PowerPoint button. The current canvas draft is committed before export. Conversion uses a snapshot and the same font measurement provider as preview, with strict asset handling. Export notes/errors remain visible; stale asynchronous results are discarded after closing. Import is a validated single undoable transaction. OPF download and clipboard transfer remain available.

This is an example/application change. Core 0.7.0, renderer 0.5.0, editor 0.4.0 and PPTX 0.5.1 remain published and immutable. The playground test uses this checkout's editor source plus installed published core/render/PPTX packages. Gallery deployment must separately pin the reviewed example commit while bundling published editor 0.4.0; this local result is not deployed-registry evidence.

## Repeatable checks

`npm ci && npm run test:playground` builds a self-contained local demo and starts its own contained static server. Local Windows uses installed Edge; CI installs Chromium with `npx playwright install --with-deps chromium`. After loading the application, the test disables browser networking and exercises:

- JSON authoring and live preview of a weighted layout with a styled merged table.
- Active inline title editing committed by opening PowerPoint export.
- Actual download, native table XML/merge inspection, and schema validation of its converted OPF.
- File import preview, application, full-document equality with the Node converter, and undo/redo.
- OPF download preserving the imported document and malformed PPTX rejection preserving current state.
- A PPTX under the 20 MB file cap whose embedded image expands beyond 20 MB of OPF JSON: conversion bypasses the unrelated paste-byte cap while retaining full schema, nesting and item validation; undo restores the previous document.

The tests pass on Windows Node 20 and 24 with Edge 152.0.4191.66. Full editor model/component/transfer/schema/rich-text/layout/styled-table suites pass on both runtimes. Generated output is under ignored `artifacts/`; regenerate it from GitHub source rather than depending on another machine's artifacts.

On a Windows machine with PowerPoint, run `test/native-playground.ps1` after the browser test, then `node test/native-playground-verify.mjs`. The scripts open only the fixture, edit its native title, save/reopen, export a 1280×720 PNG and validate/reimport the native-saved file. They preserve other open presentations. The checked [native report](evidence/browser-pptx/native.json) records the browser source hash and native-saved hash: one editable table and the changed title survive native save/reopen/reimport in PowerPoint 16.0. The resulting raster was visually inspected for readable title, body and merged table.

This targeted check does not establish pixel equivalence or lossless arbitrary PowerPoint import. Native positions, theme/font mapping and unsupported features may change when converted into dynamic OPF layout. Fonts must be installed in PowerPoint; binaries are not embedded. No account, AI service, upload or paid API participates in this workflow.
