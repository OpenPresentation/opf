# CE-20-PORTRAIT: complete manager and sorter thumbnails

Branch `codex/ce-20-portrait-thumbnail-fit`, worktree `C:/opf-work/ce20-portrait-fit`, fresh main `9545016583ccfa151077cda4d51043ac6505a140`. Cache prerequisite `49da7ea85e6bf70bcba62ee8c3a43ef7aa6646a8` was normally merged as `b00d275c4d230d2d77d529a21898a1dd8a79e30a`. The frozen cache branch was not edited.

## Vetoable decision CE20-THUMBNAIL-CONTAIN

Keep manager/sorter grid frames at 16:9. Size their real SVG viewport to both dimensions of that frame; its verified native xMidYMid meet transform contains the complete slide with letterboxing for other ratios. The previous `width: 100%` / `height: auto` SVG exceeded the landscape clip, hiding the portrait title. Only one CSS value changes runtime behavior. Cache/source/strip/canvas/lifecycle code stays at the prerequisite.

## Regression and evidence scope

The separate real-renderer browser helper is invoked by the existing workspace-browser runner. It measures the complete viewBox through getScreenCTM, verifies a uniform unskewed scale and actual preserveAspectRatio semantics, and transforms actual title/body getBBox bounds into screen coordinates. Those painted bounds must fit the frame; viewBox equality alone cannot pass. It exercises manager wide/portrait/4:3/wide edits and three later sorter openings after same-title source metadata changes. The default canvas/strip keep current dimensions, and the exact source verdict remains bound to the committed document.

Original CSS fails on manager-portrait with complete painted slide outside its frame; raw failure and screenshot remain in artifacts/ce20-portrait-fit/before. The one-value CSS fix passes all seven phases. Before portrait, forward portrait manager and forward later-sorter portrait screenshots have been inspected. The maintained pnpm check:changed completed with 7/9 steps passing. check:text hit an existing fixture missing from the standard sparse checkout; editor contract stopped at the unchanged Windows codemirror symlink EPERM (18 passed,125 unrun). Both failures are retained, not bypassed. The coordinator stopped further local runs and owns one combined remote CI wave for the independent cache and fit fixes.

This is a separate visual bug fix, not a performance claim or explanation of every hosted preview delay. No chart/schema/catalog/generated fixture/golden changes, full site build, provider/API/CI/push/Office/release action. Coordinator owns review and publication.


## Frozen source and sealed evidence

Source commit `1ef603961af054e1071a031349de19963eb8fd25`, tree `af549353429a055dd6423b6e20095d1fb67eb0c9`. The fragment, separate CE-20-PORTRAIT row and regression are included in that clean source. This handoff descendant adds evidence only. `receipt.json` records exact scope, controls and limitations; `files.json` hashes every retained original log, geometry observation and screenshot. Run `node docs/handoff/2026-11-08-portrait-thumbnail-fit/verify.mjs` to check artifact/source bindings.

No full-local-green or merged/released claim is made. The initial before failure is preserved alongside the seven-phase forward success. The failed manual formatter attempt changed no files and is recorded honestly as a transcribed diagnostic; the maintained Biome step passed with its existing imported-package exclusions.


## Exact-input setup correction

At the coordinator's direction, the bounded restore-tracked-evidence-inputs helper materialized only missing exact tracked evidence inputs (4,097 files, 109,233,812 bytes) from the same frozen source. No source/index/test change or substituted data was made. The original sparse-input failure remains sealed. Rerunning only maintained pnpm check:text then passed 6/6 and scanned 10,890 files, including 61 compressed text inputs. The original aggregate mapped run remains recorded red; the unchanged Windows codemirror symlink EPERM and 125 unrun editor cases remain explicit. No other optional run or 125-case remainder was performed.
