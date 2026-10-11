# Held patch dependency audit

Read-only/API0. Compared each held head against its merge-base with current local main, excluding broad ancestor changes. No manifests/releases changed.

| Change | Reviewed local head | Runtime delta | Consequence |
| --- | --- | --- | --- |
| core585 | 59bf7f7f3096248b38305772d91ef479a422b913 | spec/reference/font-policy.json: new measured sizeAdjust/lineAscent data, generated into shipped core fontPolicyFor/FONT_POLICY | Real core patch0.18.4 after0.18.3 |
| renderer219 | ba9d3db | src/script-fonts.js: whitespace remains in preceding adjusted run | Renderer patch |
| renderer217 | 01b0459 | Script-name fixture/Node/browser tests only | No separate runtime patch requirement |
| renderer222 | eac8366 | src/raster-text.js/raster.js: existing fonts outlines.shape supplies HarfBuzz pens for raster clusters | Renderer patch; no225 prerequisite |
| renderer229 | 3363727 | src/player.js: system Highlight under forced colors | Renderer patch |
| renderer230 | 012e448 | src/font-subset.js: reference glyph coverage | Renderer patch |
| editor155 | 6e11f2b | Fixture and test/font-gate-script-names.mjs only; expectations read installed renderer | No editor runtime patch requirement |

Minimal publication order for this set: merge/qualify core585 and release core0.18.4; merge/qualify independent renderer fixes/tests and release renderer0.18.2 against core0.18.4. Renderer dependency ^0.18.4 is the correct floor to guarantee the reviewed new policy contract; lower core still supplies the API but omits new policy rows, so is insufficient for that acceptance claim. This is behavior coupling, not a newly introduced export.

No held renderer head above contains v2renderer9fbddcb or HBmeasurement96d7debd (git merge-base --is-ancestor checks all exit1). Renderer222 calls outlines.shape that already exists and local sha256Bytes; it does not need225. These patches can remain on the v1/0.18 lane, separate from215/227/228/225. Core585 changes reference policy without changing layout schema or introducing v2 API dependencies.

Editor/CLI/PPTX minimum compatibility does not require a further patch from these reviewed deltas. Existing editor/PPTX core^0.18.1 and CLI core^0.18.1 admit0.18.4; renderer optional peer^0.18.0 admits0.18.2. Editor155 is tests only; CLI has no delta; PPTX uses renderer through src/image-fallback-node.js toPng for SVG fallback with the existing call signature. No native PPTX text size-adjust migration follows from this preview-only policy. Existing published consumer manifests may still allow older versions, so do not describe their ranges as guaranteeing the new corrections. If the release decision requires that guarantee, update minimum metadata in separately reviewed consumer patch releases after upstream publication (core^0.18.4, renderer^0.18.2 where actually consumed); no need to invent a higher PPTX floor just to consume renderer repairs.

Core/CLI optional peer policy constants in packages/javascript/src/node/peers.ts and manifests currently remain^0.18.0. Raising those would be an intentional dependency guarantee change requiring synchronized constants/core/CLI metadata and a CLI release; it is not forced by a new callable API in these patches. Release-train raises sibling floors to declared train targets during prep, so avoid including unnecessary consumer packages/targets if pursuing the minimal two-package train. All required package/browser/native acceptance and release gates still apply; this audit does not declare them green.

Previous prerelease-order report corrected: candidate configuration/declarations and genuine gallery2 registry range/lock adoption belong in a separate reviewed registry-adoption PR BEFORE stable release-prep; no expansion of release-prep allowlist.

## Required geometry floors (supervisor correction, 2026-10-11)

The earlier minimal two-runtime-package conclusion above establishes API compatibility only. It does not satisfy the [geometry-moving release rule](../../release-process.md#geometry-moving-core-releases-lockstep-floors). Changed `sizeAdjust` and `lineAscent` values affect measured geometry even though the implementation is policy data. The supervisor therefore requires core **0.18.4 → renderer 0.18.2 → PPTX 0.18.2 → editor 0.18.2** in dependency order. The PPTX/editor additions are metadata releases guaranteeing the reviewed geometry graph; no new runtime API or unrelated feature is inferred.

Renderer and PPTX must raise core floors to `^0.18.4`; editor must raise its core floor too and adopt renderer `^0.18.2` and PPTX `^0.18.2` where declared. Refresh locks from actual published upstream artifacts, qualify packed/installed/browser/OS gates, then use reviewed merged release prep and trusted publishing with independent provenance verification. No invented registry locks or skipped native limitations. CLI remains **0.18.1** initially; its optional-peer policy/constants are unchanged.

Final release-plan verification references, compatibility records and all three sites must adopt core 0.18.4, renderer/PPTX/editor 0.18.2, and CLI 0.18.1 after actual publication. This correction preserves the historical audit/evidence and supersedes only its minimal-release recommendation. It does not claim any required patch has been published.
