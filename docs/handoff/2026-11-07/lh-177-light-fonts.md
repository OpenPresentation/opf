# LH-177 and LH-183: lightweight preview fonts

Branch: `codex/lh-177-light-fonts`. Coordination: [#1139](https://github.com/OpenPresentation/opf/issues/1139).

Vetoable decision: keep the authored Segoe UI names in PPTX. Preview their Light/Semilight regular weight with bundled Red Hat Display 300 and bold emphasis with 400. Semilight's declared 350 target uses the nearest bundled face; no new font file or dependency is introduced. Red Hat Display remains a visual replacement; the previous two-style width measurement no longer describes the changed mapping and is no longer asserted in the policy.

Vetoable decision for LH-183: use its explicitly allowed tracker-gap acceptance. The authored font tracker records that Noto Sans JP Regular is heavier than Yu Gothic Regular, including diagram text. The broader font-fidelity gap remains open; native parity is not claimed.

Saved native PowerPoint evidence from wave 8 supplies the comparison. Preview changes need the golden workflow in the v0.34 integration; none are regenerated locally.

The shared rich-text fitter now retains the declared lightweight family when a run explicitly changes bold, so body emphasis uses the same style link as headings. An explicit run family wins. Regression tests cover both flags and preserve Semibold/Arial Black selection. [Before/after/native sheets](../../evidence/lh-177-font-weight/README.md) are committed, and the generated font tracker was rebuilt. Its 38 tests pass, including the existing guard that Yu Gothic own-host fixtures do not clear its retained native visual finding.

Local verification: typecheck, focused lightweight/rich-run/explicit-font tests, the renderer font-policy suite, all 15 core font-policy tests and all 38 tracker tests pass. Initial check:changed identified required null measurement fields, now corrected; its other known failures need sparse evidence or Windows path handling. Full renderer contract is still running for coordinator follow-up. Native witness: `C:/opf-work/lh-177-light-fonts/artifacts/lh-177/stem-lab-funding-proposal.pptx` (four slides), with `artifacts/lh-177/after-{n}.png` previews. Its XML retains Segoe UI Light and Semilight only.
