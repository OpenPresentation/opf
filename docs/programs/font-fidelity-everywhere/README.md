# Program: font fidelity everywhere

Status: **active** (opened 2026-09-23). Tracker: [burndown.md](burndown.md).
This is the single source of truth for the cross-repository program. Agents and
people resuming work start here, not from chat history or local scratch files.

## Goal

Every [pptx.gallery](https://pptx.gallery) dimension stays faithful end to end,
for developers everywhere. Whatever a developer switches among layouts, color
schemes, font schemes, languages, backgrounds, narratives, charts, themes,
audiences, tones, socials, headers/footers, content blocks and image
treatments:

1. the browser preview updates to match;
2. the exported PPTX opens and saves in PowerPoint; and
3. the exported PPTX contains **only the fonts the developer chose**, including
   theme, master, bullet, chart and notes parts and the East Asian and
   complex-script slots used by non-Latin languages, so PowerPoint can embed
   exactly those fonts.

This holds identically for TypeScript consumers on Windows, macOS and Linux,
locally, in cloud or serverless containers without system fonts, and in the
browser. Export output never depends on host-installed fonts, OS, locale or
timezone.

Carlito is only the openly licensed test stand-in for Calibri-class fonts. It
is not the goal; any chosen font must behave the same way.

## Definition of done

The program is done when every burndown item is `done` with its evidence
linked, and specifically:

1. **Root cause.** The origin of the unexpected `Aptos` reported by PowerPoint
   for a Carlito-only deck is determined by reviewed native evidence, and fixed
   at the exporter/theme layer rather than per document.
2. **Offline matrix.** A pairwise matrix sampling all 14 gallery dimensions
   proves exported typefaces equal the chosen fonts and previews re-render. It
   runs in CI on ubuntu, windows and macos through a packed TypeScript
   consumer.
3. **Native sample.** A bounded PowerPoint sample of that matrix, including CJK
   and right-to-left languages, opens read-only and reports only the chosen
   fonts. One font-embed attempt from merged main is audited, pass or fail.
4. **Published.** Evidence bundles, [compatibility matrix](../../compatibility-matrix.md)
   and handoff are merged.

## Scope

| In scope | Out of scope |
| --- | --- |
| opf core spec/catalog docs, evidence, ecosystem tests | Package publication, version bumps, site deploys (separate release task) |
| opf-pptx export, importer compatibility, native harnesses | Native PowerPoint header/footer objects (`p:hf`); OPF furniture export is in scope |
| opf-render preview font resolution and re-render checks | Deferred geometry drafts (core94, PPTX42, renderer27, editor25) |
| opf-editor switch operations and preview refresh | Archived shaping work |

pptx.gallery, pptx-dev and openpresentation-site only consume released
packages; they change after a release that includes this work.

## Invariants

- Never relax a gate or tolerance: native 0.02 pt, renderer 0.1 reference px,
  the Carlito/chosen-font allowlists.
- Root alone owns PowerPoint and temporary font registrations. One bounded
  worker at a time (45 s default, 60 s max, per the
  [Windows native handoff](../../handoff-windows-native-2026-09-21-wrap-up.md)
  restart prompt). Never kill Office, call
  `Application.Quit`, close unrelated presentations, change Office security, or
  retry a native attempt in place; a new attempt uses a fresh directory.
- Preserve failures as evidence. Font programs are never committed.
- Keep source, packed and registry claims separate, and schema support separate
  from renderer/editor/export fidelity.

## Resume protocol

Any session (root or subagent) resuming this program:

1. Read this file and [burndown.md](burndown.md). The progress log at the end
   of the burndown is the latest state.
2. `git fetch` core, opf-pptx, opf-render and opf-editor. Work only from fresh
   `origin/main` worktrees; never resume a squash-merged branch.
3. List open program PRs:
   `gh pr list -R OpenPresentation/<repo> --state all --search "FF- in:title"`
   for each repo, so merged items show up too. Reconcile any status drift into
   the burndown.
4. Pick the lowest-numbered `todo` item whose dependencies are `done`, or an
   item assigned to you. Branch as `codex/ff-<nn>-<slug>` (for example
   `codex/ff-07-script-slots`) and start the PR title with the ID (`FF-07: `).
   Branches opened before this tracker are grandfathered.
5. Each item has explicit acceptance criteria. An item is `done` only when its
   PR is merged after independent review and green CI on the exact head, and
   its evidence link is recorded.
6. When an item changes state, update its row and append one dated line to the
   progress log in the same PR, or in a small follow-up tracker PR.
7. Native PowerPoint items are root-only on the Windows host. Inspect the host
   first and record preflight and postflight evidence.

Roles: the root session plans, reviews, merges (reviewed and CI-green only)
and runs native attempts. Parallel subagents implement offline items and open
PRs. A separate reviewer agent reviews each PR.

## Environments

| Environment | Covered by |
| --- | --- |
| Linux, Windows, macOS Node 24 | CI matrix (FF-10) |
| Packed TypeScript consumer | Packed consumer typecheck and run (FF-10) |
| Cloud/serverless without system fonts | Determinism checks: no host font, locale or timezone dependence (FF-11) |
| Browser | Existing browser checks plus preview re-render in the matrix (FF-09) |
| Desktop PowerPoint (Windows) | Root-owned native sample and embed attempts (FF-04, FF-12, FF-13) |

## Related

- [Windows native handoff](../../handoff-windows-native-2026-09-21-wrap-up.md)
- [Font fidelity](../../font-fidelity.md)
- Evidence: [mixed-size edit](../../evidence/windows-native-mixed-edit-20260922/README.md),
  [first font-embed attempt](../../evidence/windows-native-font-embed-20260922/README.md)
