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

The coordinator's original full 519 aggregate stays RED: renderer stopped at glyph script 57 with 126 scripts unrun; PPTX stopped at quote script 112 with 178 scripts unrun. This leaf does not relabel those tails as passed. Own required changed-check and durable packet are pending. Diagnostic-authoring syntax/dependency/optional-field mistakes are retained as setup failures, distinct from genuine baseline regressions. No Office, CI dispatch, benchmark or release was run.
