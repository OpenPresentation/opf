# RR-114 needed font contracts and Latin own-run coverage

Base: reviewed staging `519dd89a80904907a3d0120f90b732065d99a0b1`. This isolated source contribution addresses three distinct failures. It does not modify the frozen 069 consumer, current RTL exports, schemas, fixtures, goldens, package pins or native application state.

## Causes and change

1. The renderer glyph test expected four Noto Sans styles on the presentation-aware Node demand path. Actual CJK/Greek title preparation needs exactly the upright 700 face. The no-presentation explicit whole-pack four-face assertion stays unchanged. Added checks use the prepared handle's own real advances/outlines and actual CJK/Greek drawing, then require one explicit bold-italic addition, an honest unprepared-style refusal and duplicate-free repeated ensure.
2. The measured quote test prepared an unresolved `roboto` catalog reference without Gallery, obtaining zero faces, then synchronously composed with Gallery. Prepare against the same catalog. A separate actual public `toPptx` control proves its existing async preparation handles an initially empty caller handle, retains exact quote import and adds no duplicates on repeated export; no manual test ensure is inserted.
3. The complete localized reference example failed in public CLI and `toPptx`: Arial Black 700 correctly resolves to Montserrat 900, but Latin own-run coverage kept only the resolved family name and incorrectly requested Montserrat 700. The one runtime line now probes the original family/style used by the returned `own:true` run. Emoji exclusion, null/error semantics, script fallback and all preparation limits remain unchanged.

## Vetoable decision RR114-OWN-RUN-COVERAGE

Coverage for a Latin own run must measure that run's actual chosen-family selection. Do not load an unrelated weight to accommodate a lossy family-name projection, or weaken missing-glyph/unprepared errors. This changes native layout measurement for affected non-ASCII Latin encoded-weight aliases; native output keeps the developer's typeface. No physical PowerPoint appearance is certified.

## Evidence and qualification

Own clean 519 build and untouched glyph/quote failures are preserved separately from the localized product failure. The new focused encoded-weight and real localized public-API regressions fail before the source change. After it, the real seven-slide CLI conversion passes, complete whole/demand PPTX bytes match, seven actual path-SVG pairs match, German title XML retains Arial Black/bold/4050, and demand remains exactly Arimo 400/700 plus Montserrat 900. No new 700 Montserrat file is loaded.

The coordinator's original full 519 aggregate stays RED: renderer stopped at glyph script 57 with 126 scripts unrun; PPTX stopped at quote script 112 with 178 scripts unrun. This leaf does not relabel those tails as passed. Own required changed-check at source `7c7ccda85b57904d8ebead8ae52eb1f843d19737` completed in 241.6 seconds with 10 PASS, 2 RED and typecheck SKIP. The selected three PPTX files pass; renderer glyph script 57 passes, then golden-gate script 58 refuses seven raster differences and leaves 126 later scripts UNRUN. The seven differences are UNATTRIBUTED; its maintained cleanup deleted the temporary diff. Gallery tracker has nine test failures from missing sparse historical inputs. Neither failure is waived, and the aggregate was not restarted. Diagnostic-authoring syntax/dependency/optional-field mistakes are retained as setup failures, distinct from genuine baseline regressions. No Office, CI dispatch, benchmark or release was run.

## Durable replay

The lossless packet contains 93 records / 1,196,323 raw bytes: original root logs, own baseline and positive controls, setup failures, actual CLI output, one-slide whole-pack native contrast, source and built-module identities, all mapped logs and protected-tree equality. receipt.json keeps exact outcomes and source identity. The diagnostic SVG containing embedded font programs is hash-bound but excluded from upload; no font programs are published. This does not weaken the seven path-SVG equality assertions.

Run with Node 24: `node docs/handoff/2026-11-10/rr114-needed-font-contracts/verify.mjs`. It verifies every record, source blobs and unchanged protected objects. Source review, combined CI/managed golden review, fresh consumer and physical native acceptance remain separate. No additional package suite or aggregate retry was performed.

The separate metadata-only delta check at `4f5607d4` was 6 PASS / 1 sparse-gallery RED / typecheck SKIP in 27.7 seconds. Its nine lossless records are in `metadata-checks.json.gz` and are included by the same offline verifier. No package suite or original aggregate was repeated.
