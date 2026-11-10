# Controlled 36-slide cold-start trial

The candidate was roughly at parity with the whole-font control for preparation plus the first SVG batch in this one small trial. Means were 3.461 s for whole, 3.735 s for old demand and 3.417 s for new demand. The fastest whole sample, 3.4050814 s, was faster than BOTH candidate samples, 3.4067869 s and 3.4276156 s. There is no universal or statistically established speed win.

Root ran exactly six fresh Node24.20.0 children once in its declared team-quiet window,11:21:47–11:22:32Z, and the actual parent terminal was 0. Order was whole→old demand→new demand→new demand→old demand→whole. Each process rendered the same 36-slide deck once, then twice warm; each child retained the unchanged 45 s bound and retries 0. This sealing lane did not run a trial, renderer, build, font installation or Office.

| Arm (two fresh processes each) | Preparation mean | First batch mean | Preparation + first mean [range] | Mean of two process warm medians |
| --- | ---: | ---: | ---: | ---: |
| Whole, 131 faces |302.8 ms |3158.2 ms |3461.0 ms [3405.1–3516.9] |2059.9 ms |
| Old demand, 3 faces |1938.6 ms |1796.4 ms |3735.0 ms [3717.6–3752.4] |1635.7 ms |
| Candidate demand, 3 faces |1716.8 ms |1700.4 ms |3417.2 ms [3406.8–3427.6] |1514.6 ms |

The candidate's mean preparation-plus-first was 8.51% lower than old demand and 1.27% lower than the whole mean in these samples. The overlap and n=2 limitation matter: this supports rough first-use parity with whole for this input, not a general performance guarantee. The earlier historical 13.6% penalty remains a separate trial at runtime ed29; these current-source measurements do not rewrite its samples or establish an additive improvement across unrelated changes. This current old-demand control was 7.92% slower than its current whole control.

| Arm | Preparation CPU mean | First-batch CPU mean | Their CPU sum mean | Warm CPU mean |
| --- | ---: | ---: | ---: | ---: |
| Whole |484.0 ms |3594.0 ms |4078.0 ms |2261.8 ms |
| Old demand |2726.5 ms |2226.5 ms |4953.0 ms |1828.3 ms |
| Candidate demand |2312.0 ms |2125.5 ms |4437.5 ms |1655.8 ms |

CPU is process user+system time, not wall latency. The candidate's preparation-plus-first CPU sum remained higher than whole here. The full six sample vectors and exact arithmetic are in statistics.json; warm CPU averages the two warm batches within each process, then the two processes. No glyph-level timing or profiler attribution is inferred.

| Arm | Render-recorded cumulative process HWM [range] | Final post-GC JS heap [range] |
| --- | ---: | ---: |
| Whole |487.47–488.86 MiB |99.825–99.836 MiB |
| Old demand |318.41–319.51 MiB |59.336–59.337 MiB |
| Candidate demand |305.64–306.07 MiB |53.290–53.294 MiB |

These are whole-process observations, not raw-font-only attribution or leak/cloud-memory qualification. HWM is cumulative since process start, read after each rendering batch; it can include prior setup, hashing and GC. It is not an isolated per-phase peak. Final heap is after storage work, clearing the final output array and GC, while the deck, font handle, hashes and result metadata remain live. RSS, external memory and arrayBuffers are preserved individually in each report.

Module imports were measured separately, with means 225.84/235.02/225.58 ms for whole/old demand/candidate; they are excluded from the preparation-plus-first sums above. Those sums are not complete application startup. Fresh processes do not reset the OS file cache; inspect-only source/dependency hashing occurred before the trial and can warm that cache. No physical cold-device, browser/GPU, mobile or cloud-provider result is claimed.

All 648 slide outputs were hash-guarded during execution (36 slides × 3 batches × 6 children). Each child asserts repeated byte stability and the parent compares the final vectors across arms. The raw reports retain the final 36 digests per child: 216 entries, not all earlier transient vectors or complete SVG strings. There are no pending faces or diagnostics, and both demand arms hold exactly Intos 400/700 and Intos Display 700. Whole holds 131 faces. Font-file counts match face counts. Output size 2,084,780 bytes, summed gzip 923,187 bytes and Brotli-quality5 size 887,643 bytes match all six reports. The source-bound loader verifies actual selected font bytes against its manifest; no font binaries are in this packet.

Source identity is separate from the evidence branch:

- Baseline producer d4bb1a56a54cd60565aae16ef9417ee80ca70147, tree 373520af376a313af20e220dc116a1b92243745e, C:/opf-work/hb-clusters.
- Candidate producer d6d9bcac6ddb7727668333d227451179fbb98b9a, tree c090c8f02e16e5e892a1ee539f9308bf18fe1ab3, C:/opf-work/glyph-probe.
- Both before/after snapshots are exact. Each has 208 built files; 205 have identical hashes across arms and ONLY font-demand.js/font-registry.js/fonts-node.js differ. All 24 external dependency package records / 1977 files and the lock hash are identical. Nine exact source/build-copy records per arm, including the font manifest, are retained as code/data; no dependency or font binaries were copied.
- Input 98,976 bytes / SHA256 249a8912ce59d7d55988d04b41909033017eb285b239960cb7fba6fab8d62599 is unchanged. Runtime source, driver and child/input pins are checked before and after in the actual run. The original historical child and exact derivation diff prove measurement/render/GC/storage code unchanged after the four declared setup/label edits.
- The evidence worktree started at main a52dc9441f7eec9dc6f72debb174339758e1761e. Driver files were authored/untracked there during the trial and bound by their actual SHA checks, not a falsely claimed pre-run evidence commit. The later evidence commit only makes those exact bytes durable.

The builtins-only verifier reads and hashes retained data; it never imports or executes archived drivers, product modules or benchmarks. Archived raw child stdout/stderr/reports, full before/after dependency inventories, inspect-only receipt and root stdout/terminal are lossless. No separate parent stderr file existed at the supplied path; the six child stderr files are present and empty. Post-trial source-only peer/sealing notes and both local setup refusals remain explicit. Actual product adoption, broader source/native/release gates and publication belong to the coordinator; this evidence branch is NEVER MERGE and publication remains held pending review.
