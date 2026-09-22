# Shipped-train acceptance — September 21, 2026

This corrects documentation and verification pins for existing published
packages: core0.11.0, CLI/renderer0.9.0, PPTX0.9.1 and editor0.8.0. It does not
publish, deploy, change production geometry or update renderer goldens.
All seven checkouts were synchronized first; [repository-sync.json](repository-sync.json)
records exact before/after commits. release-plan.json pins release-tag commits.

## Source and registry checks

On macOS with Node24.21.0 and pnpm10.33.2: locked install, typecheck, build,
588 core tests, CLI checks, text/spec integrity, six skills (17 helper checks),
lint and the independent fresh-registry developer quickstart pass. Retained
logs: install.log.gz, core-and-quickstart.log.gz, registry-and-browser.log.gz.

The complete registry consumer and eight installed-browser suites pass
(276 assertions, eight trusted pointer/keyboard interaction scenarios). This
updated gate now runs published furniture provenance and ColorRef regression
harnesses from immutable release refs. Binary furniture fixtures are read from
those same refs; predecessor plans retain version-gated coverage.

The independent [installed report](installed/README.md) captures a second fresh
five-package consumer, registry identities/lock, all 617 archive-file matches,
19 Node/CLI checks, 16 furniture browser workflows, 12 renderer code cases,
two editor code cases and two blank targets. It includes 37 validated furniture
imports with 12 damaged-tag controls, 16 deterministic OOXML export cases,
ColorRef controls, source preservation, metadata and undo. All runtime files
remain unchanged. Original verifier setup failures and corrected targeted runs
are retained. Browser version and runtime details are in acceptance-summary.json.

Two retained furniture screenshots (wide inherited and portrait local) were
visually spot-checked: furniture and body remain separated, all displayed
content stays visible, and the portrait organization label wraps. This is
fixture review, not a new full-corpus visual approval. The 126-deck corpus and
its reviewed renderer baseline are unchanged.

## PR cleanup and production

[changelog-cleanup/README.md](changelog-cleanup/README.md) records reviewed,
closed editor24/render26/PPTX40 drafts with branches retained. Main release
headings already reflect the newer train. Unique predecessor furniture facts
are retained in the audit and current handoff.

[The production audit](production/REPORT.md) keeps issue88 open with narrower,
verified remaining scope. Thirteen homepage/playground tests pass; gallery
config-to-editor handoff passes and all eight deployed bundle hashes match.
Inspector first-slide edit/undo/redo, semantic metadata and offline last-valid
recovery pass, but later slides are not editable and canvas commits normalize
raw JSON formatting. Live /agents and gallery /llms.txt still contain old pins.
Author shared json-options is wired in source; the audit's cursor probes are
inconclusive, so complete browser choice/apply/undo acceptance remains open.
Covered base-SVG interception is not itself a visible-overlay interaction defect.
Original failed/incomplete probes and corrected frame-aware checks are retained.

Final registry/browser checks pass after making the ColorRef fixture fail closed.
registry-final-and-browser.log.gz retains that rerun; missing-fixture-control.json
proves the deliberate missing-fixture mutation fails rather than using a fallback.
The fixture was restored. Read-only independent review verified docs, refs,
version gates, installed import boundaries and binary fixture handling.
Exact-head CI and final merge state are established by the PR/check receipts;
local checks alone are not remote CI.

## Limits

Native Office and renderer issue24 remain unresolved separate gates, with the
0.1px tolerance unchanged. Controlled XML mutation/reimport is not native
application evidence. Production feature presence does not establish every
issue88 interaction. The ColorRef docs fixture stays outside the 126-deck
renderer corpus. No geometry drafts or native p:hf implementation are included.
