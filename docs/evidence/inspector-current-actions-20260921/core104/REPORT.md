# Core104 exact postmerge outcome

Accepted squash `3d301f1bef2c5d55e7e2a58f1aa53632d9ec8ab1` (merged 19:15:09UTC) has the same tree `b05d325025d72def9afe2f5c70039f3ae416a249` as reviewed `a3859bacb9672eb8e450afdd9cda5aa918867175`. All **60** reviewed documentation/evidence blobs are byte-identical. The frozen **43-file premerge audit** and its SHA256 manifest `fd97c1ab7b4f28e39e15d32e0141b22e5a9292212326b6ed9e93f53b0447f9bd` remain unchanged.

| Exact accepted-commit push gate | Run / job | First outcome |
| --- | --- | --- |
| [OPF CI](https://github.com/OpenPresentation/opf/actions/runs/35643637673) | 35643637673 / 106478717021 | SUCCESS, attempt 1 |
| [Coordinated public packages](https://github.com/OpenPresentation/opf/actions/runs/35643638022) | 35643638022 / 106478717994 | CANCELLED, attempt 1 |

OPF CI completed its package, packed-install, CLI and published-registry quickstart checks. Coordinated CI passed build/link and model/geometry/font/CLI/TypeScript/bundle checks, then was canceled during installed-tarball browser interactions. Subsequent source-whitespace, physical-font, metric-outline, published-registry and checkout-measurement stages were skipped. Its full postmerge gate is **incomplete**, not green. No rerun was requested or performed.

The observed successor is core105 merge `84e914710520a7b0e777fce30e5758ee64a64924`, whose first parent is core104's accepted commit. Its push created runs 35644048902/35644048907 at 19:19:01UTC. The current workflow uses `ecosystem-${github.ref}` with `cancel-in-progress: true`; the canceled job logged `context canceled` at 19:20:15UTC. Configuration and timing support supersession by the later main push; the run metadata does not explicitly identify a cancellation action or actor. Successor checks are separate evidence under `../ci-descendant105/` and must not be relabeled as successful exact-core104 postmerge checks.

## Public PPTX47 ownership checkpoint

The new timestamped receipt `pptx47-ownership-checkpoint.json` records [PPTX47](https://github.com/OpenPresentation/opf-pptx/pull/47) merged at 18:56:47UTC as `8c7908e7eb02cb4dda52d2fac951c919c60841a5`. Linux/Windows premerge CI 35640710197 and postmerge CI 35641678935 succeeded, first attempt. Its latest status was read only; no native branch or Office session was touched. Core104's earlier recorded open-PR snapshot remains unchanged.

PPTX package CI is not independent native Office acceptance. The user's Windows supervisor retains sole Office ownership. Native tab and physical-font limits, held App54 acceptance and the overall unfinished goal remain separate. No package publication, deployment, browser run or repository mutation was performed by this audit.
