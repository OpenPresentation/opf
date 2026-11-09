# CE-20-PORTRAIT: complete manager and sorter thumbnails

Branch `codex/ce-20-portrait-thumbnail-fit`, worktree `C:/opf-work/ce20-portrait-fit`, fresh main `9545016583ccfa151077cda4d51043ac6505a140`. Cache prerequisite `49da7ea85e6bf70bcba62ee8c3a43ef7aa6646a8` was normally merged as `b00d275c4d230d2d77d529a21898a1dd8a79e30a`. The frozen cache branch was not edited.

## Vetoable decision CE20-THUMBNAIL-CONTAIN

Keep manager/sorter grid frames at 16:9. Size their real SVG viewport to both dimensions of that frame; its verified native xMidYMid meet transform contains the complete slide with letterboxing for other ratios. The previous `width: 100%` / `height: auto` SVG exceeded the landscape clip, hiding the portrait title. Only one CSS value changes runtime behavior. Cache/source/strip/canvas/lifecycle code stays at the prerequisite.

## Regression and evidence scope

The separate real-renderer browser helper is invoked by the existing workspace-browser runner. It measures the complete viewBox through getScreenCTM, verifies a uniform unskewed scale and actual preserveAspectRatio semantics, and transforms actual title/body getBBox bounds into screen coordinates. Those painted bounds must fit the frame; viewBox equality alone cannot pass. It exercises manager wide/portrait/4:3/wide edits and three later sorter openings after same-title source metadata changes. The default canvas/strip keep current dimensions, and the exact source verdict remains bound to the committed document.

Original CSS fails on manager-portrait with complete painted slide outside its frame; raw failure and screenshot remain in artifacts/ce20-portrait-fit/before. The one-value CSS fix passes all seven phases. Before portrait, forward portrait manager and forward later-sorter portrait screenshots have been inspected. Required mapped/existing controls and final sealed evidence are pending.

This is a separate visual bug fix, not a performance claim or explanation of every hosted preview delay. No chart/schema/catalog/generated fixture/golden changes, full site build, provider/API/CI/push/Office/release action. Coordinator owns review and publication.
