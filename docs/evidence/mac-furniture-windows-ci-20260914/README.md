# Windows furniture failure masked by a successful CI job

The raw logs supersede the successful GitHub status for Windows furniture
acceptance. PPTX run [34900551249](https://github.com/OpenPresentation/opf-pptx/actions/runs/34900551249)
at `9aebec3c5a9a9c26edd821cfda15b76fa0f182ae` reports success, but its Windows
installed furniture workflow throws an assertion at 21:50:28 UTC. PowerShell
continues through subsequent native commands and the step returns their final
successful exit status. The Windows artifact contains `failure.json`, not a
completed furniture report. The assertion and artifact remain unchanged here.

The failing case uses measured Roboto at 16px in a 1280×720 slide, with inherited
furniture. The Canvas-derived ink estimate for `trail  ` begins at
89.52998921348315 while the accepted field starts at 89.60000000000001. The
0.07001078651686px difference exceeds the unchanged 0.05px allowance. Actual SVG
paint must be inspected before attributing this to runtime layout or to a
Canvas-versus-SVG measurement difference. No offset, padding or tolerance fix is
justified by the status badge alone.

All six original run metadata and complete logs are retained, with hashes in
`SHA256SUMS.json`. Reading their actual output establishes:

- Core verification passes 507 tests; Mac/Windows CLI checks pass.
- Core ecosystem passes the 805-slide furniture raster gate, source/installed
  conversion checks, and sixteen installed furniture browser workflows.
- Renderer and editor each complete sixteen installed furniture workflows.
- PPTX Linux completes those workflows; Windows completes the 37 provenance
  imports but fails the subsequent furniture browser containment assertion.
- The reviewed corpus and timeline baseline separation remain accepted. The
  Windows browser gate and overall coordinated acceptance are still open.

The first corrective change selects the Actions Bash wrapper for PPTX steps so
an earlier failing command cannot be hidden by a later success. The core harness
now retains full geometry, browser/font identity, the failed page, and isolated
SVG field paint on failure. Supplementary paint observations do not suppress the
original assertion. Follow-up CI evidence belongs in a new directory.

Native PowerPoint was not run. The separate Office recovery prerequisite in
[the Windows handoff](https://github.com/OpenPresentation/opf/pull/71#issuecomment-5627652201)
remains in force. Native image opening, tab fidelity, physical font/glyph identity,
Akasia marks, new package publication and public-site furniture adoption remain
unresolved. The earlier website JSON/preview releases are independent.
