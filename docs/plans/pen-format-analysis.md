# What OPF can learn from the .pen format

A field study of [pen.dev](https://www.pen.dev/)'s `.pen` document format ([docs](https://docs.pen.dev/for-developers/the-pen-format)) and an idea-by-idea evaluation of what would make OPF a better format — ignoring switching costs, per the brief. `.pen` is the strongest recent example of a JSON document format designed *for* LLM/agent authoring in the same "files in git, agents as first-class authors" niche OPF occupies, which makes it the right benchmark even though it models a different layer (design canvases, not presentations).

Method note: `docs.pen.dev` / `docs.pencil.dev` are blocked from this environment's network policy, so this study reconstructs the format from (a) search-indexed excerpts of the official docs page, and (b) the mechanics of the published `.pen` parser (`@open-pencil/pen` 0.14.0 on npm, the parser behind the open-source Pencil implementation), cross-checked against the `pencil-sync` agent-workflow package. Everything mechanical below (property names, reference syntax, resolution behavior) is verified against parser source; statements about docs prose are labeled as such.

## Executive summary — key conclusions

1. **.pen and OPF sit at different altitudes, and OPF's altitude is the right one for decks.** `.pen` is geometry-first: it records exactly what things look like (frames, x/y, fills, flexbox). OPF is intent-first: it records what the deck says and lets engines decide pixels. Copying .pen's node model wholesale would destroy the properties that make OPF valuable — re-theming by changing one line, re-layout by swapping a hint, content that survives redesign. Most of .pen is deliberately *not* worth adopting.

2. **But .pen gets three format-level things right that OPF currently lacks**, and all three transplant cleanly without lowering OPF's altitude:
   - **A general token/reference layer.** In .pen, any value can be a variable reference (`"$--brand"`), variables are typed, and their values can vary along declared theme axes (light/dark, etc.). In OPF today, content cannot reference the design system at all — `TextRun.color` is a raw hex string, so the first colored word breaks the "re-theme in one line" promise.
   - **Addressability.** Every .pen node carries a stable `id`, which is what makes patch-style agent editing (its MCP `batch_design` tools), anchored comments, and instance overrides possible. OPF has optional `id` on slides only; nothing below slide level is addressable, and `extensions` exists only at the document root.
   - **In-document reuse with delta-only instances.** Any .pen subtree can be marked `reusable: true` and instantiated by reference with per-descendant overrides. OPF already has exactly the right merge semantics for this (catalog `id`-base-plus-sibling-overrides) but only applies it to design records — repeated content structures (KPI cards, team cards) must be copy-pasted.

3. **Recommendation: adopt four additive changes** — (1) theme-color references in content, (2) document-level `variables` + `variants` axes, (3) optional `id` and `extensions` below slide level, (4) a flat `components` registry for content payloads. All four are optional surfaces; every existing OPF document remains valid. Details, worked example, and costs in §5–§7.

4. **Explicitly rejected:** the uniform recursive node model, flexbox layout vocabulary, absolute positioning/vector primitives, and mandatory ids. Reasons in §6.

---

## 1. What .pen is

`.pen` is the file format of pen.dev (Pencil), a design tool that lives in the IDE rather than in a browser SaaS. Its pitch overlaps OPF's almost word for word: design files are JSON, they live in the repository next to code, git can diff them, and AI agents read and write them directly (via MCP tools) instead of screen-scraping a canvas. The docs describe a `.pen` file as "a JSON structure that describes an object tree, not unlike HTML or SVG," and reserve the right to make breaking changes — a live, pre-stable posture similar to OPF's 0.x.

A representative `.pen` document, reconstructed from the parser's accepted shapes:

```json
{
  "version": "1",
  "themes": { "mode": ["light", "dark"] },
  "variables": {
    "--brand":   { "type": "color", "value": "#0F4C81" },
    "--surface": { "type": "color", "value": [
      { "value": "#FFFFFF" },
      { "value": "#12161D", "theme": { "mode": "dark" } }
    ]}
  },
  "children": [
    {
      "id": "card", "type": "frame", "reusable": true,
      "layout": "column", "gap": 8, "padding": [16, 20],
      "fill": "$--surface", "cornerRadius": 12,
      "width": "hug_content", "height": "hug_content",
      "children": [
        { "id": "card-title", "type": "text", "content": "Title",
          "fontSize": 18, "fontWeight": "semibold", "fill": "$--brand" }
      ]
    },
    {
      "id": "hero-card", "type": "ref", "ref": "card", "x": 120, "y": 80,
      "descendants": { "card-title": { "content": "Adoption doubled" } }
    }
  ]
}
```

Everything in the file is one primitive: a node with `id`, `type` (`frame`, `rectangle`, `ellipse`, `text`, `path`, `icon_font`, `ref`, `script`, `prompt`), optional geometry, optional style, optional `children`. Top-level nodes sit on an infinite canvas via `x`/`y`; nested nodes are positioned relative to their parent or laid out by the parent's flexbox-style properties.

## 2. How .pen does its format — eight design moves

**2.1 One primitive, applied recursively.** There is no separate concept for page, component, group, or shape — a single node interface with a `type` discriminator covers all of them. The whole format fits in one TypeScript interface. Cost of this move: the format can say nothing about *meaning* (a `frame` full of `text` nodes could be a KPI card or a login form; nothing in the file knows).

**2.2 Mandatory addresses.** Every node must carry a document-unique `id`. This is load-bearing for three features: agents edit by patch (`batch_design` targets ids) instead of re-emitting documents; instance overrides address descendants by id (`descendants: { "card-title": {...} }`); diffs stay stable because identity survives reordering. The docs call ids out in the first paragraph — it is a foundation, not a convenience.

**2.3 Borrowed vocabulary, zero invention.** Layout is flexbox (`layout: "row" | "column"`, `gap`, `padding`, `justifyContent`, `alignItems`), font weights are CSS names or numbers, colors are `#RRGGBB[AA]`, padding and corner radius accept CSS-style shorthand arrays, sizing keywords are Figma's (`fill_container`, `hug_content`). An LLM has seen this vocabulary billions of times in training data; there is nearly nothing to learn and nearly nowhere to hallucinate. Where OPF invents (region grammar, payload kinds), it invents *small* and documents inference — but the training-data prior is real and .pen exploits it harder.

**2.4 Tokens are part of the format, not a feature beside it.** `variables` is a top-level map of typed tokens (`color`, `number`, `string`). Any property that accepts a literal also accepts a reference string (`"$--brand"`), checked by prefix. There is one namespace, one reference syntax, one resolution rule. Fill, stroke color, corner radius, padding, font size — all tokenizable with the same mechanism.

**2.5 Theme axes are declared once and orthogonal to everything.** `themes: { "mode": ["light", "dark"] }` declares an axis; any variable's value can be an array of `{ value, theme: { mode: "dark" } }` entries; any subtree can pin an axis value (`theme: { "mode": "dark" }`). Light/dark, brand A/B, screen/print — all the same mechanism, and switching variant is a render-time mode change, not a document edit.

**2.6 Reuse is reference plus delta.** `reusable: true` turns any subtree into a component; `{ "type": "ref", "ref": "card" }` instantiates it; the instance stores only its deltas (own position, `descendants` overrides, slot content). The base stays in-document — a `.pen` file is fully self-contained. Notably, OPF *already* uses this exact resolve-base-then-override-per-key semantic for catalog references (`{ "id": "cool-horizon", "accent1": "#0F4C81" }`) — .pen just applies it to content, not only to design records.

**2.7 Shorthand ladders.** `fill: "#fff"` → `fill: { type, color, enabled }` → `fill: [ ... ]`; `padding: 8` → `[8, 16]` → `[8, 16, 8, 16]`; stroke thickness number → per-side object. Progressive disclosure keeps the minimal document tiny and the maximal document expressible. OPF shares this virtue and arguably executes it more systematically (string→object ladders on assets, code, metric, quote, timeline, backgrounds, catalog refs).

**2.8 The agent is a first-class author.** Two node types exist purely for the AI workflow: `script` (generative code objects) and `prompt` (annotations pinned to the canvas that renderers skip — authoring instructions living *in the document*). The docs page ends with the full TypeScript schema so it can be pasted into a model's context, and the ecosystem pairs the format with MCP tools for id-addressed reads/writes plus screenshot feedback. The format and the agent editing loop were designed together.

## 3. The altitude difference — why most of .pen should not be copied

| Dimension | .pen | OPF |
| --- | --- | --- |
| Unit of meaning | Geometry (frame at x/y with fill) | Semantics (a metric, a quote, a chart with data) |
| Re-theme a document | Edit many nodes (tokens mitigate) | Change one `colorScheme` line |
| Re-layout a document | Move/resize nodes | Swap a `layout` hint; engines re-place |
| What a chart is | Rectangles and paths | `{ type: "line", data: { columns, rows } }` — data survives |
| Who decides placement | The author, absolutely | The engine, guided by hints |
| Narrative/audience/purpose | Absent | First-class intent layer |
| Round-trip target | Code (React/CSS) | OOXML/PowerPoint slots |
| Nesting | Unbounded recursion | Deliberately flat (blocks are not recursive; list depth via `level`) |

The two formats answer different questions: .pen answers *"what does it look like?"*; OPF answers *"what does it say, to whom, and why?"*. For OPF's job — decks that agents draft, humans revise, engines restyle — the flat, semantic, engine-decides model is the stronger design, and it is also what keeps LLM authoring reliable (bounded shapes, no deep nesting to get lost in). Several .pen strengths are already OPF strengths in different clothes: shorthand ladders (§2.7), resolve-then-override merging (§2.6), schema-as-source-of-truth, git-native plain JSON.

Where OPF is simply ahead for this domain, keep it: the intent layer (`audience`, `purpose`, `tone`, `takeaway`, `narrative` beats), semantic content payloads, data-backed charts (`asset:` CSV/XLSX sources), the warnings-never-errors validation split, the catalog ecosystem, and OOXML slot fidelity. Nothing in .pen replaces any of that.

## 4. All the ideas, evaluated

Every idea the study surfaced, including the rejected ones. Verdicts: **adopt**, **adapt** (right instinct, different shape for OPF), **defer** (real but not yet), **reject**.

### 4.1 — Adopt: let content reference theme colors

**Inspiration:** .pen §2.4 — any literal position accepts a reference.

**Today in OPF:** `TextRun.color` is a raw hex string. A deck with one branded word in a title hardcodes a color that silently stops matching when `colorScheme` changes — the "two-line diff to re-theme" pitch breaks at the first colored run. Meanwhile the format *already* has a color vocabulary (scheme slots `accent1`–`accent6`, `dark1/2`, `light1/2`; roles `primary`, `text`, `surface`, …) and already lets one string field accept slot names (`BackgroundShortcut` takes `"light1"` as shorthand).

**Change:** everywhere content accepts a color (today: `TextRun.color`; later: payload design overrides), accept `#hex` **or a scheme slot/role name**, resolved through the effective color scheme exactly as backgrounds already resolve. (Verified while writing this: the schema places no pattern constraint on `TextRun.color`, so `"color": "accent2"` already *validates* today — it is simply undefined behavior. The change is to specify the resolution rather than leave those strings meaningless, which makes it a docs-and-engines change more than a schema change.)

```json
{ "text": [
  "Two regions at ",
  { "text": "85% utilization", "color": "accent2", "bold": true }
] }
```

**Benefit:** content survives re-theming; agents stop inventing hexes; zero new syntax (the `BackgroundShortcut` precedent generalizes). **Cost:** engines resolve names at render time; validators gain a soft-warning for unknown names (consistent with catalog-id warnings). Smallest change on this list, highest leverage per line of spec.

### 4.2 — Adopt: document-level `variables` and `variants`

**Inspiration:** .pen §2.4–2.5 — typed tokens with axis-conditional values.

**Change (strawman spelling, following OPF conventions):** a top-level `variables` map of typed tokens referenced with a `var:` prefix (the `asset:<id>` precedent, rather than .pen's `$--` sigil), plus a `variants` map declaring axes. Token values may vary by axis via `when`:

```json
{
  "variants": { "output": ["screen", "print"] },
  "variables": {
    "risk":  { "type": "color", "value": [
      "#D92D20",
      { "value": "#7A271A", "when": { "output": "print" } }
    ]},
    "brand": { "type": "color", "value": "#0F4C81" }
  }
}
```

`var:risk` is then legal anywhere 4.1 allows a color name; `design.variant` (deck- or slide-level) or a render-time flag picks the active value per axis.

**Benefit:** one file renders as keynote-dark, projector-light, and print-safe PDF without forking; brand-variant decks (client A/client B) become an axis instead of a copy; `LogoSet`'s twelve hand-rolled light/dark fields are revealed as the special case of a general mechanism (keep `LogoSet`, but stop growing bespoke variant fields elsewhere). **Cost:** the real one on this list — a new resolution layer (variable → conditional value → active variant → fallback) that spec, validators, and every engine must implement identically; plus an authoring-noise risk if agents tokenize everything (mitigation: catalogs remain the primary vocabulary; a format-card authoring rule of "tokens only for values used twice or varied by variant").

### 4.3 — Adopt: `id` and `extensions` below slide level

**Inspiration:** .pen §2.2 — addresses make documents patchable.

**Today in OPF:** `Slide.id` exists (optional, good); content payloads, blocks, and regions have no identity, and `extensions` exists only at the presentation root.

**Change:** optional `id` on `ContentPayload` (hence blocks and region payloads), and optional `extensions` objects on `Slide` and `ContentPayload`, with the same preserved-across-round-trips contract as the root field.

**Benefit:** agents can edit by patch ("set `slides[id=risks].blocks[id=quote].quote.attribution`") instead of re-emitting whole documents — the exact workflow .pen's MCP tooling proves out; external systems can anchor comments, review state, and generation provenance to stable ids that survive reordering; 4.4's instance overrides get an addressing scheme for free. **Cost:** near zero — purely optional fields plus one uniqueness validation per document. This is also the cheapest way to future-proof for the planned `opf-editor`.

### 4.4 — Adopt: a flat `components` registry for content

**Inspiration:** .pen §2.6 — reference plus delta.

**Today in OPF:** repeated structures (a KPI card on six slides, four identical team-member cards) are copy-pasted payloads; consistency edits are N-place edits.

**Change:** a top-level `components` map of named content payloads; any payload position may instead be `{ "use": "<component-id>", ...overrides }`, resolved with the *identical* merge rule OPF already specifies for catalog references: resolve the base, then sibling fields win per key. Deliberately scoped: flat registry, payloads only (not slides — layouts already cover slide-level patterns), no component-in-component in phase 1.

```json
{
  "components": {
    "kpi": { "metric": { "value": "—", "label": "—", "trend": "flat" } }
  },
  "slides": [{
    "title": "Adoption Doubled",
    "left":   { "use": "kpi", "metric": { "value": "2.1x", "label": "Adoption", "trend": "up" } },
    "center": { "use": "kpi", "metric": { "value": "68%",  "label": "Gross margin" } },
    "right":  { "use": "kpi", "metric": { "value": "$4.2M", "label": "Revenue", "trend": "up" } }
  }]
}
```

**Benefit:** delta-only instances keep diffs tiny and consistency single-sourced — the same argument OPF already makes for catalog records, extended to the author's own content. **Cost:** engines must expand references before layout; validators must check unresolved `use`; a real (if bounded) complexity step — this is the one adopt-tier idea worth prototyping in examples before freezing.

### 4.5 — Adapt: payload design overrides should be token-first when they land

OPF deliberately parked per-payload styling (`content-item-design-overrides.md`), and the parking decision is sound. The .pen lesson is about the *shape* it should take when it returns: colors in that surface must accept 4.1's names and 4.2's `var:` refs from day one. If payload styling ships as raw hex, every styled deck re-freezes its palette and the design system stops cascading — .pen without variables had exactly this problem, which is why variables exist. (Amend the parking-lot note now so the requirement is recorded; costs nothing today.)

### 4.6 — Adapt: self-containment as a one-command guarantee

A `.pen` file is always self-contained; an OPF document that references URL or `pkg:` catalog sources is only reproducible where those resolve. The format already supports full vendoring (`catalogs.<kind>.records`) — what's missing is the verb: an `opf bundle` CLI command that resolves every reference a document uses and inlines the records, making "this file renders identically offline, forever" a guarantee instead of a discipline. Tooling + docs change, no schema change.

### 4.7 — Adapt: ship a format card for agent context

The .pen docs end with the complete TypeScript schema, explicitly so it can travel into a model's context window. OPF's `llms.txt` is link-based — good for browsing agents, weak for context injection. Ship a single-file condensed authoring card (top-level shape, payload inference table, region grammar, catalog resolution, 3–4 canonical examples — a few KB) in the repo, the npm package, and `llms.txt`. No schema change; measurable win for authoring reliability on models without fetch access.

### 4.8 — Defer: sizing/emphasis hints on regions

.pen's `fill_container`/`hug_content` and weights solve real layout problems — for a canvas. OPF regions currently have no way to say "sidebar narrow, main wide" beyond span counts (`left` vs `center+right` is already 1:2), and adding ratios or size keywords starts the slide toward geometry. Engines own this today and should keep owning it until `opf-render` produces concrete demand. Revisit with rendering experience in hand.

### 4.9 — Defer: standardized authoring annotations

.pen's `prompt` nodes put agent instructions in the document; OPF's equivalents (beat `instructions`, `notes`, root `extensions`) mostly live elsewhere. With 4.3's per-slide/payload `extensions`, teams can carry `{ "authoring": { "locked": true, "instructions": "keep under 20 words" } }` conventions immediately; standardize a blessed namespace only if real usage converges. Watch, don't spec.

### 4.10 — Defer: variant-conditional assets beyond logos

Generalizing light/dark variants from `LogoSet` to arbitrary assets (background images, slide images) is natural *after* 4.2 lands (a `var:` token of type `asset` is the clean spelling). Sequencing matters: doing it before variables exist would mint another bespoke variant surface, which is the anti-pattern 4.2 retires.

### 4.11 — Reject: the uniform recursive node model

One recursive primitive is what makes .pen expressive and what makes it meaningless to restyle. OPF's fixed payload kinds and deliberately flat composition (blocks non-recursive, list nesting by `level`) are the properties that let engines re-theme, re-layout, and reason about decks — and that keep LLM output reliable (bounded shapes, shallow structure). This is the core of OPF's identity; the study's strongest finding is how much value .pen gives up by not having it.

### 4.12 — Reject: flexbox layout vocabulary for slides

Tempting because of the training-data prior (§2.3), but the 3×3 region grammar is the better slide-level abstraction: bounded, overlap-validatable, layout-hint compatible, and honest about the fact that engines place content. Flexbox on slides invites unbounded nesting and turns every deck into a bespoke layout program. (Non-format note: the 46 enumerated region keys make the *schema* bulky, but the author-facing surface — two axes, `+`, `:` — is small and composable; not worth churning.)

### 4.13 — Reject: absolute positioning, vector primitives, effects, scripts

`x`/`y`, shapes, shadows, and generative script nodes are .pen's reason to exist and OPF's reason not to have them. The parked list in `content-item-design-overrides.md` stays parked; custom graphics enter as assets (SVG referenced or embedded), and an OPF document with per-payload geometry would be a worse Figma file rather than a better deck format.

### 4.14 — Reject: mandatory ids

.pen requires `id` on every node because instances and tools dereference them. OPF should adopt addresses (4.3) but keep them optional — "only `slides` is required" is the format's signature ergonomic, the minimal hand-written deck must stay minimal, and validators can recommend ids where tooling needs them.

## 5. Recommendation

Adopt **4.1 + 4.2 + 4.3 + 4.4** as one coherent proposal — call it the **reference layer**: make design *referenceable* from content (4.1, 4.2) and make content *addressable and reusable* (4.3, 4.4). Sequenced:

- **Now, pre-freeze (tiny, additive, unblock everything):** 4.1 color names in `TextRun.color`; 4.3 ids + extensions. Also the free moves: amend the parking-lot note (4.5), add `opf bundle` to the CLI plan (4.6), write the format card (4.7).
- **Next, as v1.x proposals with examples and validator support first:** 4.2 `variables`/`variants`, then 4.4 `components` (which builds on 4.3's ids and 4.2's resolution machinery).

### Worked example

One deck that presents dark on stage, exports a print-safe PDF, keeps its KPI cards consistent, and is safe for an agent to patch — exercising all four changes together (proposed fields marked †):

```json
{
  "$schema": "https://openpresentation.org/schema/opf/v1",
  "name": "Q3 Business Review",
  "audience": "executives",
  "purpose": "decide",
  "takeaway": "Approve the expanded rollout budget.",
  "design": { "theme": "classic", "colorScheme": "forest-green" },

  "variants":  { "output": ["screen", "print"] },
  "variables": {
    "risk": { "type": "color", "value": [
      "#D92D20",
      { "value": "#7A271A", "when": { "output": "print" } }
    ]}
  },
  "components": {
    "kpi": { "metric": { "value": "—", "label": "—", "trend": "flat" } }
  },

  "slides": [
    {
      "id": "headline",
      "beat": "performance-headline",
      "title": "Adoption Doubled",
      "left":   { "id": "kpi-1", "use": "kpi", "metric": { "value": "2.1x",  "label": "Adoption", "trend": "up" } },
      "center": { "id": "kpi-2", "use": "kpi", "metric": { "value": "68%",   "label": "Gross margin" } },
      "right":  { "id": "kpi-3", "use": "kpi", "metric": { "value": "$4.2M", "label": "Revenue", "trend": "up" } }
    },
    {
      "id": "risks",
      "title": "What Could Go Wrong",
      "items": [
        [ "Two regions at ", { "text": "85% utilization", "color": "var:risk", "bold": true } ],
        [ "Churn risk in the legacy tier — mitigations ship ", { "text": "November", "color": "accent2" } ]
      ],
      "extensions": { "authoring": { "locked": true, "note": "Legal reviewed this wording 2026-08-02." } }
    }
  ]
}
```

† `variants`, `variables`, `components`, `use`, sub-slide `id`, slide-level `extensions`, and non-hex `TextRun.color` values are the proposal; everything else is current OPF v1.

What each change buys, in this file: re-theming still touches one line (`colorScheme`) because the risk color and the accent are references, not hexes; `opf render --variant output=print` produces the handout from the same bytes; the three KPI cards cannot drift apart; and an agent asked to "soften the churn bullet" can patch `slides[id=risks].items[1]` without touching — or being able to touch — the locked wording, re-emitting nothing else.

The same deck without the proposal: three copy-pasted metric payloads, two hardcoded hexes that break on re-theme, a forked `*-print.opf.json` to maintain, and whole-document rewrites for every agent edit.

## 6. Benefits and costs of changing

| Change | Benefit | Cost | Risk if skipped |
| --- | --- | --- | --- |
| 4.1 color names in content | Re-theming survives styled content; no new syntax (extends `BackgroundShortcut` precedent) | Name-resolution in engines; one new soft warning | Every styled deck silently freezes its palette; the core diff-ability pitch erodes |
| 4.2 `variables` + `variants` | One file → dark/light/print/brand variants; retires bespoke variant surfaces (LogoSet pattern) | Largest: new resolution layer in spec + all engines; token-noise risk needs authoring guidance | Variant needs met by file forking — the exact failure mode OPF exists to end |
| 4.3 sub-slide `id` + `extensions` | Patch-style agent edits; durable anchors for comments/review/provenance; prerequisite for 4.4 and `opf-editor` | Near zero (optional fields, uniqueness check) | Agent edits stay whole-document rewrites; external state anchors to array indexes that break on reorder |
| 4.4 `components` | Single-source repeated content; delta-only instances; reuses existing merge semantics | Reference expansion in engines; unresolved-`use` validation; genuine complexity step | Copy-paste drift in real decks; agents regenerate inconsistent variants of the same card |
| 4.5–4.7 (adapt tier) | Future-proofs styling; reproducibility guarantee; agent authoring reliability | Docs/CLI/tooling only — no schema change | Styling ships un-tokenized someday and re-theming dies then; offline fidelity stays informal |

Cross-cutting cost, stated plainly: all four adopt-tier changes grow the spec surface right at the v1 freeze, and each adds a "second way" to say something (hex or name; literal or token; inline or component). That tax is real for LLM authoring and is paid down the same way OPF already pays it — shorthand ladders with documented inference, warnings instead of errors, and the format card (4.7) telling agents which form to prefer. Because every change is additive and optional, no existing document breaks and the minimal deck stays two lines.

## 7. What .pen confirms OPF already gets right

Worth recording, since a benchmark that only produces gaps is suspect: plain JSON in git as the entire collaboration story; schema as source of truth with generated types; string→object shorthand ladders everywhere; resolve-base-then-override-per-key merging; optionality as ergonomics (minimal valid document is trivial); pre-stable honesty (0.x, breaking changes documented); and pairing the format with local tooling rather than a hosted service. The .pen ecosystem's MCP editing loop (read by id → patch → screenshot) is also the strongest available preview of what `opf-render` + `opf-editor` should feel like — 4.3 is the format-side key that unlocks it.

## Sources

- [The .pen Format — official docs](https://docs.pen.dev/for-developers/the-pen-format) (canonical page; also served at [docs.pencil.dev](https://docs.pencil.dev/for-developers/the-pen-format)) — structure, object-tree model, id/type requirements, flexbox layout, reusable-chunks description, live-format disclaimer, TypeScript-schema-as-reference practice; accessed via search-indexed excerpts (domain blocked from this environment).
- [`@open-pencil/pen` 0.14.0](https://www.npmjs.com/package/@open-pencil/pen) — `.pen` parser: `PenDocument`/`PenNode` interfaces, `$--` variable refs, `themes` axes, `fill_container`/`hug_content`, `reusable`/`ref`/`descendants`/`slot` mechanics (primary mechanical source, verified in code).
- [`pencil-sync` 0.5.3](https://www.npmjs.com/package/pencil-sync) — the MCP-based agent editing loop (`batch_get`, `batch_design`, `get_variables`, `set_variables`, `get_screenshot`).
- [pen.dev](https://www.pen.dev/) and the [open-pencil project](https://github.com/open-pencil/open-pencil) — product context; [Figma .pen import plugin](https://www.figma.com/community/plugin/1598187293735675570/pencil-dev-pen-file-import) — ecosystem context.
- OPF sources: `docs/how-opf-works.md`, `docs/schema-reference.md`, `docs/design-resolution.md`, `docs/content-payloads.md`, `docs/content-item-design-overrides.md`, `docs/BACKLOG.md`, `spec/schemas/opf.schema.json`, `spec/catalogs/`, `examples/technical/`, `PRODUCT.md`, `llms.txt`.
