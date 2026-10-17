---
type: changed
packages: [opf, cli]
---
RR-95: first-use documentation. Every skill now opens with a short glossary (furniture, composition, implicit blocks, promoted region, catalog record, reflow, provenance), and the `opf-export` skill, the quickstart and the compatibility matrix say plainly that PPTX text is one box per wrapped line, so edits in PowerPoint or Keynote do not reflow and a wrapped title is not the Title placeholder. The `opf-author` skill points at `opf schema` instead of a repository checkout and gains a styled-table example that reads at presentation size (rich runs with `fontSize`, a `padding` object, a numeric column with `format`). New `docs/first-deck/` is a runnable six-slide deck with a README from install to PowerPoint or Keynote. New root check `check:skill-commands` runs every `opf ...` command quoted in `skills/` and `docs/*.md` against the workspace CLI, so a removed command or option fails the build instead of reaching users.
