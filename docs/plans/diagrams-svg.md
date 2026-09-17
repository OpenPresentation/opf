# Mermaid diagrams and general SVG support

Status: accepted product requirement on September 10, 2026. The content-type decision is `diagram` for Mermaid/semantic diagrams and the existing `image` type for general SVG assets; detailed schema/API design, implementation and verification remain open. This extends the [ecosystem objective](ecosystem-objective-2026-09-09.md), [editor coverage plan](spec-editor-coverage.md) and [vector PDF roadmap](pdf-export.md). No Mermaid payload or general SVG import API is published by this plan.

Priority: implement Mermaid/diagram and general SVG support **after the font reliability work is accepted**. Planning and this inventory can be recorded now; do not divert implementation effort from the active font/layout fixes or their verification/release gates. Resolve and document the outstanding font measurement, placement, browser/raster and native PowerPoint findings before starting this feature work. The [font roadmap](font-roadmap.md) remains the prerequisite; no passing diagram screenshot can substitute for that acceptance.

## Current boundary and intended outcome

OPF generates SVG slides, but the current renderer's image path accepts embedded raster images rather than general imported SVG. Diagram labels in catalogs do not establish a diagram payload, editable graph model or Mermaid support.

Support Mermaid as a portable text authoring format and general SVG as a vector asset/interchange format. Humans and external AI agents should be able to supply either format without depending on the chat application that created it. Essential parsing, layout, rendering and editing must work locally with open dependencies, pinned fonts and no model calls, accounts or paid diagram service.

Preserve the original source and maintain an explicit distinction between an editable semantic diagram, editable drawing primitives, and a vector graphic treated as one object. Importing an SVG or inserting it in PowerPoint does not by itself recover nodes, relationships or editable native connectors.

## Content-type decision

| OPF content type | Source representation | Meaning and editing contract |
| --- | --- | --- |
| `diagram` (new, planned) | Mermaid initially; normalized semantics appropriate to each diagram family | A diagram retains relationships, data, labels and source mappings for source/canvas editing and automatic arrangement |
| `image` (existing type, planned SVG support) | SVG vector asset, alongside the existing raster formats | The asset retains its appearance and image metadata; arbitrary SVG paths do not imply diagram relationships |

Rendered SVG is an output representation, not a reason to change a Mermaid diagram's content type. Conversely, importing an SVG flowchart does not automatically turn the `image` into a `diagram`. Recovering semantic elements or converting supported drawing primitives must be an explicit operation with declared limitations. No separate `svg` content type is needed. The exact `diagram` payload fields and source-format discriminator remain schema/API design work.

## Mermaid and diagram model

- Accept Mermaid source from paste, files and supported APIs/CLI. Target the full official diagram catalog below. Flowcharts/process diagrams and sequence diagrams are initial implementation milestones, not the final scope. Validate unsupported syntax and report its source location instead of silently changing the diagram.
- Define the new `diagram` payload's versioned representation with Mermaid as its first supported source format. Preserve family-specific semantics: stable nodes/edges and groups where appropriate, but also lifelines, dates, values, axes, hierarchy and other family-specific structures. Reuse suitable existing OPF data/layout contracts instead of forcing every family into a generic node graph. Preserve source mappings and relationships separately from accepted drawing geometry. Exact payload fields need review before documentation claims they are available.
- Reuse resolved fonts, presentation styles and bounded layout/repair policies. Measure labels, route connectors, detect overlaps/clipping and respect user positioning. Do not shrink below readability limits or delete nodes to make a graph fit. Diagram splitting must be explicit and preserve meaningful relationships.
- Preserve Mermaid source alongside the normalized model. Specify which representation owns a change; unsupported reverse conversion must be reported. Canvas edits must not leave apparently current Mermaid source that no longer describes the diagram. Stable IDs and guarded edits must support undo/redo.
- Evaluate the open Mermaid parser/renderer and layout dependencies before adding a custom engine. Pin versions, configuration, fonts and ID generation; document any browser/runtime requirement. Keep optional adapters separate from the provider-neutral core schema. No hosted Mermaid service is required.

## Full Mermaid coverage target

The official [Diagram Syntax index](https://mermaid.js.org/intro/) lists the following 31 families as inspected on September 10, 2026 (documentation header: Mermaid 12.0.0). All are roadmap targets; none is claimed as implemented by this document. Refresh this inventory when evaluating an upstream version, including experimental status and any separately packaged renderer requirements.

| Family | Semantics to preserve and verify |
| --- | --- |
| Flowchart | Nodes, edges, labels, groups and direction |
| Swimlanes Diagram | Lane membership, order and cross-lane connections |
| Sequence Diagram | Participants, messages, ordering, activations and grouped interactions |
| Class Diagram | Classes, members and relationship types |
| State Diagram | States, transitions, labels and compound states |
| Entity Relationship Diagram | Entities, attributes, keys and relationship cardinalities |
| User Journey | Sections, tasks, actors and scores |
| Gantt | Tasks, dates, duration, dependencies and milestones |
| Pie Chart | Labels, values, proportions and legends |
| Quadrant Chart | Axes, quadrant meanings and point coordinates |
| Requirement Diagram | Requirements, attributes and typed relationships |
| Use Case Diagram | Actors, use cases, boundaries and relationships |
| GitGraph (Git) Diagram | Commits, branches, merges, tags and ordering |
| C4 Diagram | System/container/component boundaries and relationships |
| Mindmaps | Hierarchy, labels and branch grouping |
| Timeline | Periods, events, sections and ordering |
| ZenUML | Participants, messages and control flow |
| Sankey | Nodes, directed flows and conserved values where specified |
| XY Chart | Categories, series, values, scales and axes |
| Block Diagram | Blocks, spans, groups and connections |
| Packet | Field names, bit ranges and ordering |
| Kanban | Columns, cards, metadata and ordering |
| Architecture | Services, groups, connection points and relationships |
| Radar | Axes, series, values and scales |
| Event Modeling | Events, commands, views and their relationships |
| Treemap | Hierarchy, values, areas and labels |
| Venn | Sets, overlaps, labels and any supplied values |
| Ishikawa | Effect, cause categories and cause hierarchy |
| Wardley | Components, relationships and map coordinates |
| Cynefin | Domains, labels and assigned items |
| TreeView | Hierarchy, branches and labels |

Track source parsing/preservation, SVG preview, source editing, semantic canvas editing, vector PDF, native PPTX editing and reimport separately for every family. Each capability needs a versioned status, supported syntax, fixtures, limitations and evidence; broad preview support must not be advertised as complete native editing. Prioritize useful families while retaining the rest in the roadmap. A Mermaid-authored pie/XY/timeline remains `diagram` source unless the user explicitly converts it to an existing OPF `chart` or `timeline` payload with verified semantic preservation.

The inspected Mermaid deployment documentation specifies Node 22.12 or later. Verify actual selected package/adapter requirements against OPF's supported Node 20/24 matrix; do not silently raise OPF's runtime minimum or assume every listed family is available in an older compatible version. Browser adapters, optional preparation tooling or an explicit future runtime-policy decision need review before integration.

## General SVG assets

Extend the existing `image` content type and asset handling to support standalone SVG files and SVG markup from diagramming tools or external agents, including SVG not generated by Mermaid. Preserve SVG media type, source, accessible descriptions and image placement/crop behavior. Define a versioned supported subset covering paths, basic shapes, text/tspan, groups, transforms, viewBox/units, fills/strokes, gradients, clipping, masks, opacity and embedded raster content. Test imported CSS and font handling rather than assuming browser display establishes export support.

Normalize and validate imported SVG before rendering. Disable scripts, event handlers and execution through embedded HTML; reject or explicitly convert unsupported `foreignObject`, animation and filters. Do not fetch external fonts, images or styles without an explicit host resolver. Bound resource use and keep original source as inert data. Report every unsupported feature or conversion with an element/source path; never silently discard visible content.

Preserve general SVG as vector artwork where supported. Conversion into OPF/native drawing primitives is a separate operation with declared coverage. Text kept as text should share resolved font bytes and accepted placement; glyph paths remain outlines and cannot be advertised as selectable text. If a fallback rasterizes an effect or graphic, identify it explicitly and allow strict export to reject the loss of vector content.

## Delivery milestones

| Milestone | Deliverable | Acceptance gate |
| --- | --- | --- |
| Contracts and corpus | Diagram/source representation, SVG subset and capability matrix; representative fixtures | Schema/API review distinguishes source support, preview support, drawing editability and native export fidelity |
| Local preview | Mermaid flow/process diagrams and general SVG import, normalization and vector rendering | Offline repeatable output with pinned inputs; malformed and unsupported content produces actionable diagnostics |
| Human editing | Paste/import controls, source editor, label/node/connector editing, arrange preview and undo | Actual browser workflows preserve IDs, source mappings, relationships, human adjustments and undo/redo; source/model synchronization rules tested |
| Exports | Browser SVG, selectable/vector PDF and editable native PPTX for supported diagram primitives | Shared accepted geometry and fonts; PDF extraction/appearance checks; native PowerPoint edit/save/reopen/reimport checks; vector-only and raster fallbacks clearly identified |
| Broader coverage and adoption | Additional Mermaid families and SVG features; CLI/skills/site documentation and demos | Published support matrix, clean registry installs and public author/import/preview/edit/export/reimport workflows |

## Verification and evidence

Test sparse and dense graphs, cycles, disconnected nodes, nested groups, long labels, multiple dimensions, mixed fonts/scripts, malformed syntax and resource-limit exhaustion. Use SVG fixtures from multiple tools as well as generated edge cases; include transforms, clipping, gradient/mask interactions and embedded images. Preserve source, IDs, labels and relationships through supported operations.

Inspect real browser rendering and independent vector-PDF rasterization, alongside document structure, selectable text and logical reading order. Native PPTX tests must show that supported text, shapes and connectors can actually be edited and saved in PowerPoint; an embedded SVG image alone is not sufficient. Compare reopened/reimported output and retain explicit limitations for arbitrary SVG and PowerPoint round-tripping.

Record fixture, font and dependency hashes, accepted geometry, diagnostics, rendered artifacts and exact environments. Separate schema acceptance, Mermaid parsing, SVG appearance, canvas behavior, PDF semantics and native fidelity. No diagram family or SVG feature is marked complete solely because it produced a valid file or a stable screenshot.

## Format references

- [Mermaid introduction and diagram families](https://mermaid.js.org/intro/).
- [Open Mermaid CLI](https://github.com/mermaid-js/mermaid-cli), which can generate SVG, PNG and PDF locally.
- [Claude artifact formats](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude) explicitly include Mermaid and SVG; [its in-chat visuals](https://support.claude.com/en/articles/9002504-can-claude-produce-images) use HTML/SVG.
- [ChatGPT visualizations](https://learn.chatgpt.com/docs/visualizations) support diagrams, but export formats vary. Interoperability should request and validate source files rather than depend on a particular chat preview or screenshot.
