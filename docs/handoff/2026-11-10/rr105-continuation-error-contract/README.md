# RR-105: strict continuation error contract

Baseline: fresh origin/main, normally merged reviewed `519dd89a80904907a3d0120f90b732065d99a0b1`; isolated `C:/opf-work/continuation-contract`, branch `codex/rr-105-continuation-error-contract`. PR1260 and every earlier producer/consumer/evidence root remain frozen.

The retained integration log rejected `OPFExportError: Slide content does not fit its composition.` because its predicate expected `export-failed`. A single focused genuine conversion on the already-built, unchanged519 root proves the actual public error has its own enumerable `code:layout-overflow`, is both `OPFExportError` and `OPFApiError`, and retains the original `OPFCompositionError` with two located `layout-unplaced` diagnostics at `slides.1.blocks.6` and `.7`, region `steps`. Before/after seven source/build pins are identical. There is no missing-code product bug; the retained formatter's omission of fields is not evidence that a property is absent.

`asApiError` deliberately preserves an existing string engine code. `export-failed` is used only when the original failure lacks one; the outer public wrapper preserves the typed error. The integration assertion now verifies exact public class, exact `layout-overflow` code, original composition-error class/code and both located diagnostics. It does not accept either code, match only a message, or weaken strict composition. The preceding genuine continuation/paginate:false/invalid-option checks remain intact. `docs/node.md` now names strict overflow and explains code/cause propagation without promising that composition diagnostics become findings.

The normally built focused file passes2/2, including actual SVG/PPTX continuation and public import. The single required mapped run and its original limitations are appended after terminal. No runtime/schema/build-tool/vendor changes, broader tests, rebuild of the retained integration root, Office, CI watcher, release, tolerance changes or local golden changes.

## Vetoable decision

Correct the stale assertion and narrowly clarify the existing error-code contract; preserve the useful engine code and located cause instead of changing runtime wrapping to satisfy an incorrect generic-code expectation. The original519 probe, raw log and exact input remain durable evidence. This is qualification/documentation repair, not a new export behavior.
