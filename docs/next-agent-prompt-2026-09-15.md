# Copy/paste prompt for the next project owner

Start with [the current handoff](handoff-2026-09-21.md), [quickstart](quickstart.md)
and [compatibility matrix](compatibility-matrix.md). The filename is historical;
this entrypoint was updated 21 September 2026. The broad ecosystem goal and the
developer-ready milestone remain incomplete.

Published Node 24 train: `@openpresentation/opf@0.11.0`, `cli@0.9.0`,
`opf-render@0.9.0`, `opf-pptx@0.9.1`, `opf-editor@0.8.0`. ColorRef and shared
furniture are shipped. Do not publish another version to correct these docs.
Use release-plan.json for exact versions and immutable harness commits. Check
actual registry/remote/deployment state before relying on older dated evidence.

Repositories: OpenPresentation/{opf,opf-render,opf-editor,opf-pptx} and
Data-Advantage/{openpresentation-site,pptx-gallery,pptx-dev}. Defaults are main
except pptx-dev/master. Sync clean checkouts first, preserving local work.
Use Node 24, pinned package managers/lockfiles, AGENTS.md and relevant OPF skills.
The schema/catalogs are authoritative for format support; renderer/editor/native
fidelity requires separate evidence.

The public sites carry the shipped train and issue88 features. Verify remaining
acceptance from the current handoff before closing issue88. Preserve appearance.
Leave the five geometry drafts together: core94, renderer27, editor25, PPTX42,
site40. Do not merge the site half alone. Native Header/Footer docs drafts
core92/PPTX41 remain roadmap; do not implement p:hf in this milestone. Furniture
exports as editable tagged slide shapes (OPF_FURNITURE_V1), not native HF.

Renderer issue24 stays deferred at the unchanged 0.1px gate. Do not round away
residuals, add platform offsets or rewrite goldens to hide failures. Preserve
remote codex/archive-shaping-20260915 branches: core36ff66b3d62b39d7d27dcda022b7e79e541bd603,
renderer343fb84223f4383ffe546157c6989ccc505c0acb,
editor ae4cc6426b04c7ca428c1b4acacea2e11d99fa84,
PPTX fbe9a73d012dbd51d65a39251e405e488651a70b. Port bounded changes from current
main; never merge these unfinished prototypes wholesale. The archived editor's
packed rich-input assertion expects ten while thirteen workflows pass; repair
and rerun when resuming it.

Native Office issue87 retains picture open/save/reopen, current-content
provenance, tabs, notes-master order and physical font identity/embedding gaps.
Do not retry Windows COM or kill Office processes before owner-confirmed host
recovery. Restricted Aptos4.40 requires compatible explicit permission.
Serialization and controlled reimport do not certify Office.

Later, not in this checkpoint: move docs/fixtures/color-references.opf.json
into examples with reviewed renderer golden/corpus growth (126 to 127+),
optional PPTX schemeClr/theme writing, and editor canvas named-color fidelity.
Broader IME/bidi/fonts, bounded repair, full visual-editor coverage, selectable
vector PDF and semantic SVG/Mermaid remain roadmap work. PDF is raster-backed.

Keep essential work local, offline and provider-neutral without account/model
calls. Preserve authored content, whitespace, rich formatting, metadata, source
mappings, reading order, explicit adjustments and undo. Bound layout repair and
return actionable diagnostics instead of dropping content. Review visual changes.
Separate source, fresh installed packages, browser/CI, deployment, native and
font gates. Keep evidence and handoffs current; do not mark the overall goal
complete while required compatibility or release work remains unresolved.
