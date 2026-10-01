# Prepared font shaping and painting roadmap

Status: deferred implementation, preserved on September 15, 2026. The project
owner asked for validated work to be merged and unfinished work stored in the
roadmap. This PR now changes documentation only relative to its validated main
base; it does not ship the archived runtime or claim its failing gates passed.

## Preserved work

Font containers, fixed variable instances, optional HarfBuzz shaping, accepted glyph paths, source maps and caret metadata.

- Archive branch: [`codex/archive-shaping-20260915`](https://github.com/OpenPresentation/opf-render/tree/codex/archive-shaping-20260915).
- Immutable checkpoint: [`343fb84223f4383ffe546157c6989ccc505c0acb`](https://github.com/OpenPresentation/opf-render/tree/343fb84223f4383ffe546157c6989ccc505c0acb).
- Validated runtime base: `130a2fa68954bd8f28c0c147cca1204f8b18561a`.

The complete implementation, tests, licenses and earlier evidence remain at
that checkpoint. History was preserved with new commits; no force-push or
prototype deletion was needed. The final PR diff contains only documentation
and retained failure evidence. Merging this roadmap is not a feature release.

## Remaining acceptance

The native variable-font browser gate still fails on Linux: Source Serif SmText Bold measures 334.06213682353496px versus 334.193115234375px in Chromium. A tested rounding candidate clears five Linux failures but creates five macOS failures. Source and fresh installed failures are retained in [run35019414738](https://github.com/OpenPresentation/opf-render/actions/runs/35019414738).

**Decision, 2026-10-01 (RR-15):** the owner widened this one variable-font metric gate (Fontkit prediction versus native Chromium advance) from 0.1px to 0.15px. The difference is Chromium on Linux (and Windows) rounding TrueType HVAR advances while Fontkit and macOS Chromium keep the fractional value: the worst retained delta across all 356 Fontkit rows is 0.1346px on Linux and 0.0024px on macOS, and the five rows over 0.1px are 0.111 to 0.135px. The gate is enforced by `npm run test:variable-font-gate` in `ci.yml` (`test/platform-residual-probe.mjs` live, `test/variable-font-retained-gate.mjs` over the retained evidence; constant in `scripts/variable-font-gate.mjs`). The 0.1px reference-pixel gates for static fonts and the 0.02pt native PowerPoint gate are unchanged, and the archive's other gates stay at 0.1px. When the archived `test/font-variations-browser.mjs` is ported, its Fontkit-versus-browser advance assertion uses this constant. The rejected rounding candidate stays rejected; this widens a tolerance, it does not change any metric.

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

[Rejected rounding experiment](https://github.com/OpenPresentation/opf-render/tree/9764ad8f9a7fd497ca2fcea190669cf74d2e2503/docs/evidence/rejected-truetype-rounding-20260915) retains the exact reproduction and original measurements.
