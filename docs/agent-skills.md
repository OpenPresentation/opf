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

The installer introduced in CLI 0.5.0 bundles all six complete skill folders. Use Node 24 for this checkout and the next release. From your project directory:

```sh
npx @openpresentation/cli@latest skills install
```

The default installs copies into `.agents/skills` in the current project, suitable for agents including Codex. It does not change AGENTS.md or any agent configuration. No symlink privileges, paid service, API key or AI provider is required. npm downloads the CLI on first use; the installed CLI then installs its bundled skills without network access. Pin `@openpresentation/cli@0.5.0` for a repeatable version. This command requires the 0.5.0 release; when testing its release branch before publication, use `node packages/cli/dist/index.js skills install` after building.

| Target | Project directory | Personal directory with `--global` |
| --- | --- | --- |
| Default / `--agent universal` | `.agents/skills` | `~/.agents/skills` |
| `--agent codex` | `.agents/skills` | `~/.codex/skills` |
| `--agent claude-code` | `.claude/skills` | `~/.claude/skills` |
| `--agent cursor` | `.cursor/skills` | `~/.cursor/skills` |

For example, `npx @openpresentation/cli@latest skills install --agent codex --global` installs personal Codex skills. For another compatible agent use `--directory <its-skills-directory>`; this option cannot be combined with `--agent` or `--global`. Restart or reload your agent if its skill discovery requires it. A compatible client can invoke the installed skills with names such as `$opf-author` or `$opf-inspect`.

Inspect or update the same destination:

```sh
npx @openpresentation/cli@latest skills status
npx @openpresentation/cli@latest skills update
```

Supply the same target options used for installation. `status` is read-only and compares against the invoked CLI's bundled version; it does not query npm for newer releases. Repeated installation is idempotent. Updates check every installed file before changing any skill. Modified, added, deleted or unmanaged files cause the command to stop and list the conflicting folders; keep your customizations, move those folders outside the active skills directory, then retry. There is no force-overwrite option. A successful update returns backup paths outside the active skills directory for recovering the previous managed versions. Keep those backups until you have reviewed the update. Do not run concurrent writers: the installer lock coordinates other installer runs, but cannot lock an external editor.

No skills are installed by the repository build. Manual installation remains supported: copy whole folders from `skills/`, including references and scripts, to your agent's skill directory. Each folder is self-contained. The managed installer treats existing manual copies as unmanaged and preserves them.

The inspection helper requires Node 24 and `@openpresentation/opf` in the current project. In this checkout, build with `pnpm build` first. For an installed skill used outside the checkout, either run from an npm project that has the package or set `OPF_ROOT` to the built OPF checkout. It does not install dependencies, fetch catalogs, or modify input files.

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

When schema/package APIs change, update only the affected skill/reference and its executable examples. Keep option lists in the canonical schema and catalogs. The format package and skill folders are separate distribution surfaces: CLI 0.5.0 includes the six skills; the core `@openpresentation/opf` package does not install agent configuration.
