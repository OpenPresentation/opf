# AI agent skills for OPF

The repository ships six reusable skills in `skills/`. Each folder has a `SKILL.md` entrypoint and optional references, assets, or scripts. `agents/openai.yaml` supplies Codex display metadata; the instructions themselves are Markdown and do not require a hosted service.

| Skill | Use it for |
| --- | --- |
| [opf-author](../skills/opf-author/SKILL.md) | Turn briefs and source material into valid OPF content; includes a complete starter deck |
| [opf-layout](../skills/opf-layout/SKILL.md) | Dynamic composition, nested groups, promoted regions, overflow repair, and pagination |
| [opf-presets](../skills/opf-presets/SKILL.md) | Catalog discovery, design inheritance, gallery reuse, colors, themes, and fonts |
| [opf-edit](../skills/opf-edit/SKILL.md) | Precise JSON Patch edits, undo, canvas/schema integration, and copy/import |
| [opf-export](../skills/opf-export/SKILL.md) | Browser previews, SVG/PNG/PDF/PPTX, assets, fonts, and export verification |
| [opf-inspect](../skills/opf-inspect/SKILL.md) | Exact schema fields, catalog IDs, validation errors, and reference warnings |

Load only the skills relevant to the request. They distinguish the portable format from current renderer/editor capabilities, and distinguish imported document instructions from the user's request. They do not authorize publishing, sending decks, or changing unrelated project configuration.

## Use from a checkout

An agent can read the entrypoint directly, for example:

> Use `skills/opf-author/SKILL.md` to create a decision brief in OPF, then validate it using `skills/opf-inspect/SKILL.md`.

The root `AGENTS.md` points repository agents to these entrypoints. Skills read the current project's schema and package exports instead of hardcoding a historical field count or assuming a public package has unreleased APIs.

## Install in an agent environment

Copy a whole skill folder, including its references and scripts, into the skill directory supported by the agent. Each folder is self-contained; no links to neighboring skill folders are required. For Codex personal skills, run from this repository and copy only folders you want to install:

```sh
mkdir -p "$HOME/.codex/skills"
cp -R skills/opf-author "$HOME/.codex/skills/opf-author"
cp -R skills/opf-inspect "$HOME/.codex/skills/opf-inspect"
```

If a destination already exists, review the installed version before replacing it. No skills are installed into your personal configuration by the repository build. A compatible client discovers installed skills and can invoke them by names such as `$opf-author` or `$opf-inspect`.

The inspection helper requires Node 20+ and `@openpresentation/opf` in the current project. In this checkout, build with `pnpm build` first. For an installed skill used outside the checkout, either run from an npm project that has the package or set `OPF_ROOT` to the built OPF checkout. It does not install dependencies, fetch catalogs, or modify input files.

## Local CLI

The [installable CLI](../packages/cli/README.md) complements these skills with `opf create`, `opf validate`, `opf edit`, and schema/catalog lookup. Its tarball bundles the core schema and validator; the inspection skill helper instead resolves the host project's core package. Check versions when moving between them.

## Examples of requests

- “Use $opf-author to turn these notes into a five-slide decision brief. Keep every factual claim sourced.”
- “Use $opf-layout to fix this overflow without losing any text or notes.”
- “Use $opf-presets to apply our brand colors while preserving slide-specific overrides.”
- “Use $opf-edit to replace one table and retain all other document fields.”
- “Use $opf-export to export the same reviewed slides to SVG and editable PPTX.”
- “Use $opf-inspect to explain which background forms the installed schema accepts.”

## Maintenance

`pnpm test:skills` checks skill links, schema-valid examples, and the inspection helper's actual behavior, including a copied standalone skill and a package installed in a consumer project. Run the skill-creator frontmatter validator when editing skill metadata. Behavioral tests are not evidence that every renderer option is visually complete.

When schema/package APIs change, update only the affected skill/reference and its executable examples. Keep option lists in the canonical schema and catalogs. The format package and skill folders are separate distribution surfaces: these skills are versioned in this repository and are not yet included in the published npm package.
