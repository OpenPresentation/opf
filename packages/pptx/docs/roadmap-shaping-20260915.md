# Rich-source shaping and native tab export roadmap

Status: deferred implementation, preserved on September 15, 2026. The project
owner asked for validated work to be merged and unfinished work stored in the
roadmap. This PR now changes documentation only relative to its validated main
base; it does not ship the archived runtime or claim its failing gates passed.

## Preserved work

Original rich-run formatting from shared shaping groups, literal tab preservation and accepted line-relative tab positions in editable native text.

- Archive branch: [`codex/archive-shaping-20260915`](https://github.com/OpenPresentation/opf-pptx/tree/codex/archive-shaping-20260915).
- Immutable checkpoint: [`fbe9a73d012dbd51d65a39251e405e488651a70b`](https://github.com/OpenPresentation/opf-pptx/tree/fbe9a73d012dbd51d65a39251e405e488651a70b).
- Validated runtime base: `c077b7a426f6ebb04ae53102400d488fc2278f2b`.

The complete implementation, tests, licenses and earlier evidence remain at
that checkpoint. History was preserved with new commits; no force-push or
prototype deletion was needed. The final PR diff contains only documentation
and retained failure evidence. Merging this roadmap is not a feature release.

## Remaining acceptance

Coordinated Linux and Windows checks pass at the archived head, but the geometry contract depends on the unreleased core/renderer stack. Native mixed-size table tab positions and Office edit/save/reopen acceptance remain in [core issue87](https://github.com/OpenPresentation/opf/issues/87). Do not introduce offsets or turn soft wraps into hard paragraphs.

Track coordinated font/measurement work in [renderer issue24](https://github.com/OpenPresentation/opf-render/issues/24).
Follow the [central deferred-work plan](https://github.com/OpenPresentation/opf/blob/main/docs/plans/deferred-shaping-20260915.md)
and [project handoff](https://github.com/OpenPresentation/opf/blob/main/docs/handoff-2026-09-15.md).

Resume from current main in a new branch and port a bounded supported subset.
Do not merge the entire archive to bypass release fixes. Preserve original
text, whitespace, UTF-16 source spans, formatting, undo, physical-font identity
and licenses. Use the same accepted geometry through rendering/editing/export.
Test actual candidate packages and the intended registry dependency graph;
keep original native failures visible. Publish new coordinated versions only
after the declared scope passes its acceptance gates.
