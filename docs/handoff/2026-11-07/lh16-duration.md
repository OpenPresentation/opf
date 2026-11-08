# LH-16: proportional timeline periods

Implementation is on `codex/lh-16-duration-timeline`, for the v0.34 integration. The superseded WIP checkpoint remains linked for continuity; this note describes the current contract and review.

`TimelineEvent.duration` is a finite positive relative number. Omission is one unit. It never parses or rewrites `when`. Shared geometry draws exact consecutive horizontal/vertical ranges. Their leader-linked label track keeps readable type independently of a short period's width/height; portrait timelines can fill the body vertically. Labels do not shrink, including compacting hints. A period smaller than a visible stroke or text that cannot fit reports overflow; unrepresentable arithmetic ratios are refused. Vertical prose uses a readable line measure. Existing milestones without durations retain their geometry and native bytes.

SVG draws the exact shared rectangles/links; PPTX writes editable native rectangles, lines and source-backed text. Import preserves explicit numeric periods and current edited native text. Missing or changed range geometry that breaks provenance falls back to ordinary current-native import, with a finding. Native geometry edits report reflow rather than infer new durations. Markdown embeds numeric periods losslessly; text/list/table conversions report their duration loss.

## Review and validation

- Locked build and focused core cases pass, including validation, 1–9 counts, scales, both directions, exact ratios, intrinsic measurement, lossless Markdown, conversion-loss reporting, no-shrink hints and overflow.
- The 36 existing timeline behavior tests passed during implementation.
- New real SVG/native tests pass in true widescreen and portrait dimensions and LTR/RTL: exact shared geometry, leader bounds, duration/current-text roundtrip, damaged provenance and the runnable object-form example.
- Six complete [before/after pairs and two sheets](../../evidence/lh16-duration/) were rendered with pinned real fonts and inspected. Every pair preserves its exact font sizes. The portrait now uses the body height; nine unequal periods retain 32px labels. No Claude Design counterpart exists for these new numeric-field fixtures, so none is invented.
- Reproducible default controls: 324 varied ordinary milestone geometries are deep-equal to main; one native PPTX is byte-identical. The review receipt records exact hashes and source identity. Run `node scripts/review-lh16-duration.mjs <built unchanged baseline checkout> docs/evidence/lh16-duration`.

The baseline is main core `d19c4bb6172b703d132ebba3fd006e4ec5cdf845`, through the frozen built RR-107 checkout; its core/render/PPTX/gallery source is identical. The complete changed-scope check ran in 776.5 seconds: build, typecheck and 17 root mappings passed. The existing Windows browser-safe path test failed; core also hit the sparse corpus and two spawn UNKNOWN controls; PPTX passed 77 files before the unchanged Keynote symlink EPERM. Its source example initially lacked embedded catalog records; that defect was fixed. A rebuilt focused rerun passed all 247 example/timeline tests, the restored script corpus tests, all 137 portable decks (905 slides), actual SVG ranges and actual native edit/roundtrip controls. The standalone production browser-safe audit passed. No assertion was weakened. Final merging with released 0.33 and the reviewed 0.34 assembly, the integration golden workflow/full CI and final native qualification remain required. No local golden was regenerated. The public example adds a new fixture for the integration workflow to baseline.

## Vetoable decisions

Use one explicit numeric field rather than guessing from localized dates. Keep periods exact and use leaders to readable labels instead of making short periods dictate text size. Do not infer schedule changes from dragged native rectangles. Preserve omitted fields through roundtrip rather than writing synthetic defaults. Source changes, a fragment, burndown row/log, runnable example and review tooling belong to this single item PR.

Preserve the localized status lookup of LH-121 / #1144 when combining composition edits. No new layout ID is introduced. LH-34 is a separate item/worktree.
