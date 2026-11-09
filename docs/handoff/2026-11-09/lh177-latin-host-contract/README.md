# LH-177 Latin-host test contract correction

Isolated worktree C:/opf-work/light-weight, branch codex/lh-177-browser-face-contract. The guarded helper fetched main 9545016583ccfa151077cda4d51043ac6505a140, then this branch normally fast-forwarded to reviewed integration a1126f6b7d08a24ca9b76303e22ac9316685c301. The coordinator owns publication/folding. No API/provider/Office/release action occurred.

## Diagnosis and authority

The unchanged complete Latin browser host reproduces the pre-golden CI failure at latin-family-hosts-browser.mjs:94: named Segoe UI Light requested 700 resolves 400, while the older independent fixture predicts 700. This is a stale independent test model after the accepted LH-177 behavior change, not a newly demonstrated runtime regression. The existing lh-177-light-fonts.mjs passes unchanged and checks the public registry and actual SVG, including explicit Red Hat Display bold 700. The November 8 LH-177 burndown decision and separately archived native witness establish modest Light/Semilight emphasis rather than parent-family Bold.

The bounded baseline comparison evaluates the actual main pickFace function over the pinned manifest with each revision's own encoded policy weights. Main Light selects300/700 and unweighted Semilight400/700; the accepted integration selects300/400 for both. It is a selector comparison, not a full baseline build or new native pass. Its first attempt incorrectly asserted complete policy-row equality (the integration adds Semilight 350 and clears old measurements); the second had a PowerShell quoting setup error. Both refused diagnostics are retained. Corrected probe 03 passes; no failed attempt is relabeled green.

## Vetoable decision

Correct only the shared independent Latin-host fixture and add a literal contract regression. Named lightweight families keep 300 for normal text and 400 for requested bold, headings and inherited rich emphasis, with real italic variants. Explicitly authored Red Hat Display 700 stays 700. Semibold/Black direct and normalized rich-run behavior stays covered. The fixture does not call pickFace or derive expectations from actual resolution. No production source, font policy/binary, tolerance, browser assertion, budget or golden changes.

## Qualification

Genuine before-browser and new literal-regression RED are retained. The unchanged LH-177 acceptance test passes. After the fixture correction, the complete Node host passes 87 families / 348 style checks / 333 real font-file paint controls. The complete browser host passes 87 families, exactly 94 on-demand files / 24.5 MiB, exact pending/ensure/request completeness, loaded FontFaces, and natural versus measured advances within the unchanged 0.1 px. It uses the maintained local Windows Edge channel; this is not a pinned Linux CI replay. All 87 maintained browser screenshots are retained; the Light and Semilight PNGs are byte-identical SHA-256 4a8ab43be8b7148fb2fd19cda2963ced9b983f8dbfdcb54b472a230edb488b70. The Light image was visually inspected: complete heading/body, regular/bold/italic/bolditalic legible; the identical bytes bind that observation to Semilight. Viewer presentation differences are not treated as product defects.

The existing guarded exact-HEAD sparse-input helper restored 4,356 tracked files / 113,711,152 bytes before required mapped checks. No generated substitutes, tracker refresh or index edits. Required changed-branch validation is terminal exit 1: 8 steps pass, the renderer contract fails its inherited layout-template golden hash, and typecheck correctly skips because no TypeScript changed. The maintained table reports 445.3 s (outer wrapper 446.47 s). Renderer scripts 1-69 pass, script 70/178 fails, and all 108 unrun scripts remain explicit. Actual template fixture hash 864ee4d83f3ddd056db23709d15faf8ab17ac6e60618ee3fb8bc5a711f641841 differs from the old deac9f7d92499675ae98c059fa2e0d660b1d469f3886452b984a9619d788abe4. This is not an overall green claim. Full focused host checks ran against the working test payload subsequently committed unchanged as b9a7; the required mapped run used that exact source commit. Combined exact-head CI is owed. The coordinator's one managed golden run targets the integration runtime; this test-only repair requires no additional regeneration. Chart agreement/native/full original release and site acceptance remain open.

## Frozen source and retained evidence

Test source b9a7f46a75e244b60dc2c3e09f4e2e3b9a3f4172, tree 13af232bdf1da4564441fba3b0b42f56190653ef. checks.json binds both test blobs and 20 protected objects, including all renderer runtime/fonts, complete other public packages, schemas, pins/workflows and both unchanged original host test bodies. checks.zip retains 134 raw files / 4,124,948 bytes, including all 87 screenshots, genuine failures and every initial mapped step. Archive 2,883,949 bytes / SHA-256 c0273c1bb2715458f85a7766eb7085c8f082a0a093e0e5b9a18821156dc27a7d. The first source snapshots normalize line endings; the causal probe reads actual Git source directly. No unsuccessful diagnostic is treated as bug proof.

Run the offline verifier with pinned Node 24 from this checkout:

    node docs/handoff/2026-11-09/lh177-latin-host-contract/verify.mjs

It verifies source ancestry, protected objects, frozen test blobs and every raw archive byte. Its PASS is distinct from the retained mapped exit 1. Final evidence-only descendants may change only this dated handoff; no further test/runtime changes.
