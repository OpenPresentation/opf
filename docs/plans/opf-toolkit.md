# OPF Toolkit — open-source render, edit, and PPTX conversion

Plan for the open-source toolkit that turns OPF documents into pixels and PowerPoint files, and PowerPoint files back into OPF. Everything here is free and MIT, runs in Node and the browser, and has **no hosted service in the critical path**. OpenPresentation ships code and documentation only; downstream applications can wrap these primitives in their own products, services, agents, and workflows.

This repo ([`openpresentation/opf`](https://github.com/openpresentation/opf)) stays **format-only**: schemas, catalogs, examples, types, local validation. The toolkit lives in **separate MIT repos** that depend on [`@openpresentation/opf`](https://www.npmjs.com/package/@openpresentation/opf). This document is the cross-cutting plan; it lives here because the format and the toolkit move together conceptually, and because the build leans hard on the spec assets in [`spec/`](../../spec).

## Executive summary — key decisions

1. **Three new repos, not one package, and not in this repo.** `opf-render` (Phase 1), `opf-editor` (Phase 2), and `opf-pptx` (Phases 3+4). Each is MIT, versions independently, and depends on `@openpresentation/opf` for schemas, catalogs, and types. Rationale and alternative groupings in [§1](#1-repo-topology).

2. **`opf-render` is the foundation and the canonical visual truth.** SVG is the canonical render; PNG and PDF are conversions off the SVG; the PPTX export only has to be *close* to the SVG. Everything downstream (editor overlays, golden tests, export verification) keys off the renderer, so it ships first and the others depend on it.

3. **Determinism is a hard requirement, not a nice-to-have.** Same OPF in → byte-stable SVG out. No browser, no network, no clock, no locale drift, no font fallback roulette in the render path. This is what makes caching, diffing, golden-file tests, and the WYSIWYG round-trip work at all. Treated as a cross-cutting discipline in [§6](#6-cross-cutting-determinism-and-golden-files).

4. **The renderer resolves the catalog system itself.** Layout, theme, colorScheme, fontScheme, chart type (`Chart.type`), audience/purpose/tone references resolve through the documented order (inline `catalogs.<kind>.records[]` → `catalogs.<kind>.source` → engine defaults → default catalog) exactly as [`opf.schema.json`](../../spec/schemas/opf.schema.json) describes. The toolkit bundles the canonical catalogs via `@openpresentation/opf` and ships an `engine-defaults.json` matching [`spec/reference/`](../../spec/reference).

5. **Layout binding follows the placeholder model.** Rendering keys off the `placeholders` array described in [`layout-placeholders.md`](layout-placeholders.md): `title`/`subtitle`/`tag` bind to slide fields, other content binds by `slot` in array order. The renderer is the first real consumer of that model, so building it will validate (or expose gaps in) the placeholder plan.

6. **`data-opf-path` is the whole editor binding.** A one-line change in the renderer — stamp every emitted element with its JSON path — is what makes Phase 2 a thin overlay instead of a second rendering engine. We bake it in from Phase 1, gated behind a render option so production SVG can omit it.

7. **PPTX export starts on `pptxgenjs`, then graduates to a hand-written OOXML emitter.** Working `.pptx` fast, 1:1 fidelity later. Both live behind one stable `toPptx(opf)` API so the swap is invisible to callers.

8. **OpenPresentation boundary.** Making the renderer MIT is a deliberate strategy change: OpenPresentation owns open specs, catalogs, local libraries, and integration seams — not hosted APIs, managed infrastructure, or product workflows. [`PRODUCT.md`](../../PRODUCT.md) is updated in the same change set to reflect render/convert as OpenPresentation OSS primitives.

---

## 1. Repo topology

Three repos under the `openpresentation` org, all MIT, all depending on `@openpresentation/opf`:

| Repo | Phase | Public API (sketch) | Depends on |
|---|---|---|---|
| `openpresentation/opf-render` | 1 | `renderSvg(opf, opts)`, `svgToPng(svg)`, `svgToPdf(svgs)` | `@openpresentation/opf` |
| `openpresentation/opf-editor` | 2 | React/Svelte components + headless `bindEditor(state)` | `opf-render`, `@openpresentation/opf` |
| `openpresentation/opf-pptx` | 3 + 4 | `toPptx(opf)`, `fromPptx(buffer)` | `@openpresentation/opf` (+ `opf-render` for chart rasterization, [§3.4](#34-charts)) |

**Why three, not one.** Each has a distinct dependency footprint and audience: `opf-render` is the universal core (everyone needs pixels); `opf-editor` pulls in a UI framework and is browser-only; `opf-pptx` carries OOXML/ZIP concerns and a heavyweight optional LibreOffice verification path. Splitting keeps install weight honest and lets a consumer take the renderer without the editor.

**Why 3 and 4 share a repo.** OPF→PPTX and PPTX→OPF are the two directions of the same OOXML domain — they share the ZIP packaging code, the `[Content_Types].xml`/`.rels` model, the part graph, the EMU math, and the OOXML↔OPF type maps. Splitting them duplicates that surface.

**The convenience facade.** A thin optional `opf-toolkit` meta-package can re-export `render(opf, "svg"|"png"|"pdf"|"pptx")` and `import(pptx)` over the three repos for the "just give me one import" caller. It carries no logic — pure re-export — so it is not on the critical path of any phase.

**Alternative considered — split Phase 3 from Phase 4 (`opf-pptx-out` / `opf-pptx-in`).** Rejected for v1: the shared OOXML surface is large and the two directions are co-developed. Revisit only if import grows an AI dependency that export shouldn't carry.

---

## 2. Integrator contract

The toolkit is library-first. Downstream applications should be able to embed it in hosted services, agent workflows, custom editors, internal automation, and self-hosted systems without relying on OpenPresentation-hosted functions.

- **Stable APIs.** Keep entry points small and predictable: `renderSvg`, `svgToPng`, `svgToPdf`, editor bindings/components, `toPptx`, and `fromPptx`. Use semver and document compatibility with `@openpresentation/opf`.
- **Offline by default.** No required network calls, hosted callbacks, hidden telemetry, or remote asset fetches in the core runtime path. Catalog, font, image, and media resolution must be injectable so hosts can run offline or use private sources.
- **Host-controlled product surface.** OpenPresentation does not provide auth, storage, collaboration, queues, jobs, previews, analytics, support, or workflow UX. Hosts compose those layers around the OSS primitives.
- **Runtime portability.** Support Node and browser where the package promises it. Server-side APIs must be safe for batch jobs and concurrent requests, avoid global mutable config, and return structured errors.
- **License and project hygiene.** Each repo ships MIT licensing, contribution guidance, security reporting, dependency license policy, font/media licensing notes, trademark/name usage guidance, and a compatibility policy.

---

## Phase 1 — Make it visible. OPF → SVG → PNG + PDF.

**Repo:** `opf-render`. **Goal:** a deterministic renderer — same OPF in, same SVG out — that turns a deck into one SVG per slide, with PNG and PDF as conversions off it.

### 1.1 Validate & resolve

- Parse the OPF JSON and validate against the bundled schemas via `@openpresentation/opf`'s `validatePresentation` (AJV under the hood). Reject invalid input at the boundary; trust it internally thereafter.
- Resolve catalog references in the documented order (inline records → document `source` → engine defaults → default catalog at `pptx.gallery/<kind>`). Bundle the canonical catalogs from `@openpresentation/opf/catalogs`; ship an `engine-defaults.json` mirroring [`spec/reference/engine-defaults.json`](../../spec/reference).
- Pick the layout: resolve `Slide.layout` to a layout record, read its `placeholders` array. Layout = fixed regions on a fixed-size canvas (default 1280×720; EMU-equivalent so Phase 3 shares the geometry).
- Bind content to placeholders per [`layout-placeholders.md`](layout-placeholders.md) §2.2: `title`/`subtitle`/`tag` from slide fields (with presentation-level fallback), the rest by `content[].slot` in array order. The `blocks` form (renderer-positioned, see [`block-composition.opf.json`](../../examples/technical/block-composition.opf.json)) is laid out by a deterministic region allocator rather than fixed placeholders.

### 1.2 Lay out text — the hard part

- Parse the font for glyph metrics, shape the runs, break lines, shrink-to-fit when a box overflows.
- Greedy line-breaking is fine to start; leave a seam for Knuth–Plass later.
- Shrink-to-fit (autofit) mirrors PowerPoint's normAutofit so the SVG and the eventual PPTX agree on whether text fits.
- **Determinism watch:** font selection must be explicit and bundled — never fall back to a system font, because that changes per machine and breaks golden files.

### 1.3 Emit SVG

- `<rect>`, `<text>`, `<image>`, `<path>` into a fixed `viewBox`.
- Every emitted element carries a `data-opf-path` (e.g. `slides.2.title`, `slides.2.content.0`) **when `opts.trace` is set** — this is the Phase 2 binding, baked in now (decision 6). Production SVG can omit it for size.
- Subset and embed fonts in the web SVG so it renders identically off-box.

### 1.4 SVG → PNG

- Rasterize with `resvg-js` (WASM, no browser). Deterministic output at a given scale.

### 1.5 SVG → PDF

- One slide = one vector page. Keep real text + subsetted embedded fonts for fidelity and selectable text; outline glyphs to `<path>` when bulletproof rendering matters more than text selection.
- Start with `svg2pdf.js` + `jsPDF`; SVG path data maps closely onto PDF path operators, so a hand-written content-stream emitter is a viable later step if the libraries constrain us.

### 1.6 Golden-file tests

- Render every deck in [`examples/`](../../examples) to PNG, diff against approved images. The example suite ([`examples/technical/`](../../examples/technical), [`examples/gallery/`](../../examples/gallery)) is the corpus; `scripts/validate-examples.mjs` already gates validity, this adds visual gating.

### 1.7 Key stack

TypeScript · AJV (via `@openpresentation/opf`) · `fontkit` or `opentype.js` for glyph metrics, `harfbuzzjs` (WASM) for proper kerning/ligatures · `resvg-js` for PNG · `svg2pdf.js` + `jsPDF` for PDF (or a hand-written content stream). All permissive; Node + browser.

---

## Phase 2 — Make it human. WYSIWYG.

**Repo:** `opf-editor` (depends on `opf-render`). **Goal:** embeddable editor primitives where editing the slide writes straight back to the OPF JSON, which stays the single source of truth. This is not a hosted product shell; hosts own auth, storage, collaboration, branding, workflow, and UI chrome.

### 2.1 Traceable renderer

- Already delivered by Phase 1's `data-opf-path` (decision 6). The editor renders with `opts.trace: true`. No second rendering engine.

### 2.2 Click-to-edit primitives

- Click an element → read its `data-opf-path` → expose the edit target to the host UI → write the value back into the JSON at that path → re-render. Re-render is cheap because the renderer is pure. Optional components can provide default overlays, but the headless binding is the core API.

### 2.3 Structured controls

- Layout, theme, colorScheme, fontScheme, chart type (`Chart.type`), audience/purpose/tone are **controls that set catalog-id fields**, populated from `@openpresentation/opf/catalogs` or host-supplied catalogs — not freeform manipulation. This is where the catalog system pays off in embedding contexts.

### 2.4 Side-by-side JSON

- Optional CodeMirror/Monaco components can bind to the same state object; edits flow both ways. Hosts may hide JSON entirely, replace the code editor, or use their own state layer. Re-validate with AJV on every change so output stays clean OPF.

### 2.5 Undo/redo as a JSON Patch log

- RFC 6902 JSON Patch operations form a clean, diffable, replayable history. `immer` produces the patches as a side effect of immutable updates.

### 2.6 Key stack

Headless TypeScript core · optional React or Svelte components · optional CodeMirror or Monaco · `immer` (immutable updates + patch generation) · JSON Patch (RFC 6902) · AJV via `@openpresentation/opf`.

---

## Phase 3 — Make it usable. OPF → PPTX.

**Repo:** `opf-pptx`. **Goal:** emit a real, editable `.pptx` PowerPoint opens without complaint through a pure local library API. It only has to be *close* to the SVG — the SVG is canonical.

### 3.1 The package shape

- A `.pptx` is a ZIP of XML parts: `[Content_Types].xml`, `_rels/`, `ppt/presentation.xml`, per-slide XML, slide layouts, masters, `theme1.xml`.
- Map OPF → OOXML: layout placeholders → `<p:ph>` placeholders, OPF `design.theme`/`colorScheme`/`fontScheme` → `<a:theme>`, text runs → `<a:p>`/`<a:r>`. Convert canvas units to EMUs (914400/inch). Reuse Phase 1's geometry so positions agree.

### 3.2 Two paths behind one API

- **v1:** write an OPF→`pptxgenjs` mapping for working output fast.
- **v2:** replace the internals with a hand-written OOXML emitter for a 1:1 mapping (owning the emitter removes the impedance mismatch with `pptxgenjs`'s API).
- Both sit behind one stable `toPptx(opf)` so the swap is invisible. The runtime path has no required network call, AI dependency, LibreOffice dependency, or hosted callback.
- Server and batch callers get reproducible ZIP output, deterministic part ordering, fixed timestamps, bounded resource controls, and structured errors for validation, unsupported features, missing assets/fonts, and packaging failures.

### 3.3 Placeholder mapping caveat

- [`layout-placeholders.md`](layout-placeholders.md) §1 explicitly defers the OOXML round-trip (`title` vs `ctrTitle`, `body`→`<p:ph type="obj">`, `picture`→`<p:ph type="pic">` vs fill). Phase 3 is where those decisions get made and fed back as a follow-on to the placeholder plan.

### 3.4 Charts

- v1: render charts as images (via `opf-render`) and embed as pictures. v2: real chart XML (`<c:chart>`).

### 3.5 Verify against the canonical SVG

- Render the generated `.pptx` with **LibreOffice headless** (free, optional, verification-only — the single non-JS dependency anywhere, and never in the runtime path) and diff against the Phase 1 SVG/PNG. This is a test-suite tool, not a dependency consumers install.

### 3.6 Key stack

TypeScript · `fflate` or `jszip` (packaging) · `pptxgenjs` initially · LibreOffice headless for verification only.

---

## Phase 4 — Make it unavoidable. PPTX → OPF.

**Repo:** `opf-pptx` (same repo as Phase 3). **Goal:** import existing PowerPoint decks into clean, valid OPF JSON.

### 4.1 Mechanical import

- Unzip the `.pptx`, parse the XML parts with `fast-xml-parser`, read slides/shapes/text/theme.

### 4.2 Best-effort semantic mapping

- Recognize common patterns (title+body → bullets, etc.) and map to OPF layouts; fall back to `blocks` with explicit positioning for anything that doesn't fit cleanly. Aim for "editable and recognizable," not pixel-perfect.

### 4.3 Optional AI pass

- A post-import classifier that re-maps slides into proper layouts and tidies text. **Optional and clearly isolated** — the mechanical importer must work fully without it, so the AI dependency never becomes load-bearing for the OSS core. Hosts can add their own classifier without changing the local importer contract.

### 4.4 Output discipline

- Output must validate against the schemas (`validatePresentation`) and **round-trip back out** through Phase 3 — `fromPptx` then `toPptx` is a test invariant.

### 4.5 Key stack

TypeScript · `fflate`/`jszip` · `fast-xml-parser`. All permissive.

---

## 6. Cross-cutting: determinism and golden files

Two disciplines hold across all four phases:

- **Determinism / byte-stability.** No clock, no `Math.random`, no locale-dependent collation, no network fetch, no system-font fallback in any render or emit path. Stable key ordering in emitted JSON/XML. ZIP entries written with fixed timestamps and ordering so `.pptx` bytes are reproducible. This is what makes caching and diffing real.
- **Golden-file tests per phase.** Every example deck in [`examples/`](../../examples) has an approved render (Phase 1 PNG), an approved `.pptx` (Phase 3, verified via LibreOffice), and a round-trip assertion (Phase 4). CI fails on any unreviewed pixel or byte change. The existing [`scripts/validate-examples.mjs`](../../scripts/validate-examples.mjs) and [`scripts/check-text-integrity.mjs`](../../scripts) are the model to extend.

---

## 7. Dependencies between phases

```
opf-render (P1)  ──┬──>  opf-editor (P2)   needs traceable SVG
                   └──>  opf-pptx  (P3)    needs chart rasterization + geometry
opf-pptx (P3) <────────  opf-pptx  (P4)    round-trip invariant
```

Build order: **P1 → (P2 ∥ P3) → P4.** P2 and P3 are independent once P1 lands and can proceed in parallel. P4 depends on P3 for the round-trip test.

---

## 8. Risks / open questions

1. **Text layout fidelity vs PowerPoint.** PowerPoint's line-breaking and autofit are not fully documented. Greedy + normAutofit approximation gets close; exact parity is a long tail. Golden files against LibreOffice-rendered PPTX bound the drift.
2. **`harfbuzzjs` determinism across versions.** Pin the WASM build; shaping output can shift between HarfBuzz versions and silently invalidate golden files. Treat font + shaper versions as part of the golden-file contract.
3. **Placeholder→OOXML map is unspecified today.** Phase 3 must resolve what [`layout-placeholders.md`](layout-placeholders.md) deferred; until then, OPF→PPTX placeholder typing is best-effort. Feed decisions back as a follow-on to that plan.
4. **`blocks` layout is renderer-defined.** The renderer-positioned `blocks` form has no fixed regions, so its layout algorithm *is* the spec for those slides. Two renderers could disagree. Document the allocation rule in `opf-render` and treat it as canonical, or promote it into the spec later.
5. **Import is lossy by nature.** PPTX→OPF can't recover authoring intent perfectly. Set expectations at "editable and recognizable"; the AI pass ([§4.3](#43-optional-ai-pass)) narrows the gap but stays optional.
6. **LibreOffice in CI.** Headless LibreOffice is heavy and occasionally non-deterministic across versions. Pin the container image; keep it verification-only and out of the runtime/install path.

---

## 9. OpenPresentation OSS boundary

Making the renderer and converters MIT changes the boundary described in the current [`PRODUCT.md`](../../PRODUCT.md). The deliberate change:

- **Render and convert become OpenPresentation OSS primitives** (these three repos), siblings of the format and the gallery.
- **OpenPresentation provides code, not hosted functions.** The org does not ship hosted APIs, queues, storage, auth, jobs, previews, SLAs, telemetry, or managed infrastructure.
- **Downstream applications own the product layer.** Hosted services, agent products, internal tools, and self-hosted systems can wrap the OSS libraries in their own environments.
- **The adoption goal is interoperability.** The format, renderer, editor primitives, and converters should be useful to any integrator without forcing a specific product architecture.

`PRODUCT.md` is updated in this change set to reflect render/edit/convert as open primitives and to keep hosted-service concerns outside the OpenPresentation OSS repos. The `legacy/README.md` tombstone is unaffected — those were service-specific clients, distinct from these new local primitives.
