# SH-26 RTL native qualification — evidence only

**NEVER MERGE THIS BRANCH.** Producer/importer is clean unreleased source473d3fff623bda3f191ae2669824f1b02a5d90f8; the evidence branch base is independent. Integration67dd9ec10 contains the reviewed source, without a final-green or release claim.

All13complete inputs were exported through the shipped CLI:30previewPNGs byteexact,11wholePPTXarchives byteexact,2expectedchanged,13canonicalimportcomparisons exact. Only the2changed archives were opened in PowerPoint:6slides,2owned read-only/SaveCopyAs/reopen passes. Current/saved imports and named text/geometry/font states are exact; no shrink tags. Root visually inspected all6preview/native pairs and all4previouslyreversed numbered Latin pages now read correctly. Stress inputs literally end in “around th”; no export truncation is implied.

The raw strict review remains exit1 for a pre-existing phase-image difference:2291pixels atx132–587/y389–420. Old/current original and edited image hashes are byteidentical, so no new variance or tolerance change was accepted. Native font names/sizes are observations, not font-file/glyph identity or Arabic/crossplatform/arbitraryedit qualification.

The first batch stopped at its fresh-process guard before the second case entered Office. Preserve that refusal. After observing no PowerPoint process, the previously unstarted case ran in a new output and completed; no failed COM operation was retried, no running instance attached and no Office process killed. Both supervisors report cleanup; the final OS snapshot is in the review archive.

All source/raw data are losslessly retained in the5tar.gz archives with per-file SHA256 and extraction verification in assessment.json. Producers are exact copies; visible comparison sheets are under visual/. Original24-slide/11-archive native witnesses are eligible for reuse only because those whole inputs and all30previews remain byteexact; legacy evidence is eb3b3cbb815e39db2e06ec3ae3ec06f25be7e94f.

Overall candidate/native/release acceptance is still held:11additional RTL contrasts (one known scalar-import structure drift), final combined/full/slow CI, archive/golden review and site adoption remain. No publication or deployment is established by this packet.
